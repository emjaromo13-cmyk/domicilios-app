import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'
import './App.css'

import L from 'leaflet'

const API_URL = 'https://domicilios-app-kfj4.onrender.com'
const SOCKET_URL = API_URL

const socket = io(SOCKET_URL)

const MAPA_CENTRO = [2.9273, -75.2819]

const ESTADOS = [
  'PENDIENTE',
  'ASIGNADO',
  'EN CAMINO',
  'ENTREGADO',
  'CANCELADO',
]

const crearIconoMoto = (nombre) =>
  L.divIcon({
    className: 'icono-moto',
    html: `
      <div class="moto-contenedor">
        <div class="moto-marker">
          🛵
        </div>

        <div class="nombre-moto">
          ${nombre || 'Domiciliario'}
        </div>
      </div>
    `,
    iconSize: [140, 65],
    iconAnchor: [70, 23],
    popupAnchor: [0, -28],
  })

const crearIconoPedido = () =>
  L.divIcon({
    className: 'icono-pedido',
    html: `
      <div class="pedido-marker">
        <span>📍</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  })

function CentrarMapa({ posicion }) {
  const map = useMap()

  useEffect(() => {
    if (posicion) {
      map.setView(posicion, 16)
    }
  }, [posicion, map])

  return null
}

function SeleccionarUbicacion({ posicion, onSeleccionar }) {
  useMapEvents({
    click(e) {
      onSeleccionar([
        e.latlng.lat,
        e.latlng.lng,
      ])
    },
  })

  return posicion ? (
    <Marker
      position={posicion}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target
          const nuevaPosicion = marker.getLatLng()

          onSeleccionar([
            nuevaPosicion.lat,
            nuevaPosicion.lng,
          ])
        },
      }}
    />
  ) : null
}

function App() {
  // =========================================================
  // ESTADOS GENERALES
  // =========================================================

  const [posicionesDomiciliarios, setPosicionesDomiciliarios] =
    useState({})

  const [rutasDomiciliarios, setRutasDomiciliarios] =
    useState({})

  const [posicion, setPosicion] = useState(null)
  const [precision, setPrecision] = useState(null)
  const [error, setError] = useState(null)
  const [conexion, setConexion] = useState('Conectando...')

  const [domicilios, setDomicilios] = useState([])
  const [sedes, setSedes] = useState([])
  const [domiciliarios, setDomiciliarios] = useState([])
  const [turnosActivos, setTurnosActivos] = useState({})

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false)


  const [domicilioActivo, setDomicilioActivo] =
    useState(null)

const [domicilioEditandoUbicacion, setDomicilioEditandoUbicacion] =
  useState(null)

const [guardandoUbicacion, setGuardandoUbicacion] =
  useState(false)
  


  // =========================================================
  // FILTROS DEL MODO SEDE
  // =========================================================

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] =
    useState('TODOS')

  const [filtroSede, setFiltroSede] =
    useState('TODAS')

  // =========================================================
  // NUEVO DOMICILIO
  // =========================================================
const [resultadosUbicacion, setResultadosUbicacion] =
  useState([])

const [buscandoUbicacion, setBuscandoUbicacion] =
  useState(false)
  const [nuevoDomicilio, setNuevoDomicilio] =
    useState({
      cliente: '',
      telefono: '',
      direccion: '',
      barrio: '',
      latitud: '',
      longitud: '',
      sede_id: '',
      domiciliario_id: '',
      metodo_pago: '',
      valor_pedido: '',
      valor_domicilio: '',
    })


  // =========================================================
  // CARGAR DOMICILIOS
  // =========================================================

  const cargarDomicilios = async () => {
    try {
      const respuesta = await fetch(
        `${API_URL}/api/domicilios`
      )

      if (!respuesta.ok) {
        throw new Error(
          'No se pudieron cargar los domicilios'
        )
      }

      const datos = await respuesta.json()

      console.log(
        'Domicilios recibidos del backend:',
        datos
      )

      setDomicilios(
        Array.isArray(datos) ? datos : []
      )
    } catch (error) {
      console.error(
        'Error cargando domicilios:',
        error
      )

      setError(
        'No se pudieron cargar los domicilios.'
      )
    }
  }

  // =========================================================
  // CARGAR SEDES
  // =========================================================

  const cargarSedes = async () => {
    try {
      const respuesta = await fetch(
        `${API_URL}/api/sedes`
      )

      if (!respuesta.ok) {
        throw new Error(
          'No se pudieron cargar las sedes'
        )
      }

      const datos = await respuesta.json()

      console.log(
        'Sedes recibidas del backend:',
        datos
      )

      setSedes(
        Array.isArray(datos) ? datos : []
      )
    } catch (error) {
      console.error(
        'Error cargando sedes:',
        error
      )
    }
  }

  // =========================================================
  // CARGAR DOMICILIARIOS
  // =========================================================

  const cargarDomiciliarios = async () => {
    try {
      const respuesta = await fetch(
        `${API_URL}/api/domiciliarios`
      )

      if (!respuesta.ok) {
        throw new Error(
          'No se pudieron cargar los domiciliarios'
        )
      }

      const datos = await respuesta.json()

      console.log(
        'Domiciliarios recibidos del backend:',
        datos
      )

      setDomiciliarios(
        Array.isArray(datos) ? datos : []
      )
    } catch (error) {
      console.error(
        'Error cargando domiciliarios:',
        error
      )
    }
  }

  useEffect(() => {
    cargarDomicilios()
    cargarSedes()
    cargarDomiciliarios()
  }, [])

  // =========================================================
  // CONSULTAR TURNOS DE TODOS LOS DOMICILIARIOS
  // =========================================================

  const consultarTurnos = async () => {
    if (!domiciliarios.length) {
      return
    }

    try {
      const resultados = await Promise.all(
        domiciliarios.map(async (domiciliario) => {
          try {
            const respuesta = await fetch(
              `${API_URL}/api/turnos/activo/${domiciliario.id}`
            )

            if (!respuesta.ok) {
              return {
                id: domiciliario.id,
                turnoActivo: false,
              }
            }

            const datos = await respuesta.json()

            return {
              id: domiciliario.id,
              turnoActivo: Boolean(
                datos.turnoActivo
              ),
              turno: datos.turno || null,
            }
          } catch {
            return {
              id: domiciliario.id,
              turnoActivo: false,
            }
          }
        })
      )

      const mapa = {}

      resultados.forEach((resultado) => {
        mapa[resultado.id] = resultado
      })

      setTurnosActivos(mapa)

    } catch (error) {
      console.error(
        'Error consultando turnos:',
        error
      )
    }
  }

  useEffect(() => {
    consultarTurnos()
  }, [domiciliarios])

  // Actualizar estado de turnos periódicamente
  useEffect(() => {
    const intervalo = setInterval(() => {
      consultarTurnos()
    }, 15000)

    return () => clearInterval(intervalo)
  }, [domiciliarios])

  // =========================================================
  // BUSCAR UBICACIÓN DEL DOMICILIO
  // =========================================================

const buscarUbicacionDomicilio = async () => {
  if (
    !nuevoDomicilio.direccion.trim() ||
    !nuevoDomicilio.barrio.trim()
  ) {
    alert('Primero escribe la dirección y el barrio.')
    return
  }

  try {
    setError(null)
    setBuscandoUbicacion(true)
    setResultadosUbicacion([])

    const consulta =
      `${nuevoDomicilio.direccion.trim()}, ${nuevoDomicilio.barrio.trim()}, Neiva, Huila, Colombia`

    const parametros = new URLSearchParams({
      format: 'jsonv2',
      limit: '5',
      addressdetails: '1',
      countrycodes: 'co',
      q: consulta,
    })

    const respuesta = await fetch(
      `https://nominatim.openstreetmap.org/search?${parametros.toString()}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    if (!respuesta.ok) {
      throw new Error(`Error de búsqueda: ${respuesta.status}`)
    }

    const datos = await respuesta.json()

    const resultados = datos
      .filter((item) => item.lat && item.lon)
      .map((item, indice) => ({
        id: `${item.place_id ?? indice}`,
        nombre: item.display_name,
        latitud: Number(item.lat),
        longitud: Number(item.lon),
      }))

    setResultadosUbicacion(resultados)

    if (resultados.length === 0) {
      alert(
        'No se encontraron coincidencias. Puedes buscar con una dirección más completa o seleccionar el punto directamente en el mapa.'
      )
    }
  } catch (error) {
    console.error('Error buscando ubicación:', error)
    alert(
      'No se pudo consultar la ubicación. Inténtalo nuevamente.'
    )
  } finally {
    setBuscandoUbicacion(false)
  }
}

  // =========================================================
  // ASIGNAR DOMICILIARIO
  // =========================================================

  const asignarDomiciliario = async (
    domicilioId,
    domiciliarioIdSeleccionado
  ) => {
    if (!domiciliarioIdSeleccionado) {
      return
    }

    try {
      const respuesta = await fetch(
        `${API_URL}/api/domicilios/${domicilioId}/asignar`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            domiciliario_id:
              Number(
                domiciliarioIdSeleccionado
              ),
          }),
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
            'No se pudo asignar el domiciliario'
        )
      }

      await cargarDomicilios()

      setError(null)
    } catch (error) {
      console.error(
        'Error asignando domiciliario:',
        error
      )

      alert(
        error.message ||
          'No se pudo asignar el domiciliario.'
      )

      await cargarDomicilios()
    }
  }

  // =========================================================
  // ACTUALIZAR ESTADO
  // =========================================================

  const actualizarEstado = async (
    domicilioId,
    nuevoEstado
  ) => {
    try {
      const respuesta = await fetch(
        `${API_URL}/api/domicilios/${domicilioId}/estado`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            estado: nuevoEstado,
          }),
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
            'No se pudo actualizar el estado'
        )
      }

      setDomicilios((actuales) =>
        actuales.map((domicilio) =>
          domicilio.id === domicilioId
            ? {
                ...domicilio,
                ...datos,
              }
            : domicilio
        )
      )

      await cargarDomicilios()
    } catch (error) {
      console.error(
        'Error actualizando estado:',
        error
      )

      alert(
        error.message ||
          'No se pudo actualizar el estado.'
      )
    }
  }

  // =========================================================
  // ELIMINAR DOMICILIO
  // =========================================================

  const eliminarDomicilio = async (id) => {
    const confirmar = window.confirm(
      `¿Seguro que quieres eliminar el domicilio #${id}?`
    )

    if (!confirmar) {
      return
    }

    try {
      const respuesta = await fetch(
        `${API_URL}/api/domicilios/${id}`,
        {
          method: 'DELETE',
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
            'No se pudo eliminar el domicilio'
        )
      }

      setDomicilios((actuales) =>
        actuales.filter(
          (domicilio) =>
            domicilio.id !== id
        )
      )

      if (domicilioActivo === id) {
        setDomicilioActivo(null)
      }
    } catch (error) {
      console.error(
        'Error eliminando domicilio:',
        error
      )

      alert(
        error.message ||
          'No se pudo eliminar el domicilio'
      )
    }
  }

  // ==========================================
  // EDITAR UBICACIÓN DE UN DOMICILIO EXISTENTE
  // ==========================================

  const abrirEditorUbicacion = (domicilio) => {
    if (
      domicilio.latitud == null ||
      domicilio.longitud == null ||
      !Number.isFinite(Number(domicilio.latitud)) ||
      !Number.isFinite(Number(domicilio.longitud))
    ) {
      alert('Este domicilio no tiene coordenadas válidas para mostrar en el mapa.')
      return
    }

    setDomicilioEditandoUbicacion({
      id: domicilio.id,
      direccion: domicilio.direccion,
      barrio: domicilio.barrio,
      latitud: Number(domicilio.latitud),
      longitud: Number(domicilio.longitud),
    })
  }

  const guardarUbicacionDomicilio = async () => {
    if (!domicilioEditandoUbicacion || guardandoUbicacion) {
      return
    }

    const { id, latitud, longitud } = domicilioEditandoUbicacion

    if (
      !Number.isFinite(Number(latitud)) ||
      !Number.isFinite(Number(longitud)) ||
      Number(latitud) < -90 ||
      Number(latitud) > 90 ||
      Number(longitud) < -180 ||
      Number(longitud) > 180
    ) {
      alert('Selecciona un punto válido en el mapa.')
      return
    }

    try {
      setGuardandoUbicacion(true)
      setError(null)

      const respuesta = await fetch(
        `${API_URL}/api/domicilios/${id}/ubicacion`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitud: Number(latitud),
            longitud: Number(longitud),
          }),
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje || 'No se pudo guardar la ubicación.'
        )
      }

      setDomicilios((actuales) =>
        actuales.map((domicilio) =>
          Number(domicilio.id) === Number(id)
            ? {
                ...domicilio,
                latitud: Number(datos.domicilio.latitud),
                longitud: Number(datos.domicilio.longitud),
              }
            : domicilio
        )
      )

      setDomicilioEditandoUbicacion(null)

      alert('La ubicación del domicilio se actualizó correctamente.')
    } catch (error) {
      console.error('Error guardando la ubicación:', error)
      alert(error.message || 'No se pudo guardar la ubicación.')
    } finally {
      setGuardandoUbicacion(false)
    }
  }

  // =========================================================
  // CREAR DOMICILIO
  // =========================================================

  const crearDomicilio = async () => {
    if (
      !nuevoDomicilio.cliente.trim() ||
      !nuevoDomicilio.telefono.trim() ||
      !nuevoDomicilio.direccion.trim() ||
      !nuevoDomicilio.barrio.trim() ||
      !nuevoDomicilio.sede_id
    ) {
      alert(
        'Completa cliente, teléfono, dirección, barrio y sede.'
      )

      return
    }

    if (
      nuevoDomicilio.latitud === '' ||
      nuevoDomicilio.longitud === ''
    ) {
      alert(
        'Debes seleccionar la ubicación exacta del domicilio en el mapa.'
      )

      return
    }

    try {
      setError(null)

      const respuesta = await fetch(
        `${API_URL}/api/domicilios`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            cliente:
              nuevoDomicilio.cliente,
            telefono:
              nuevoDomicilio.telefono,
            direccion:
              nuevoDomicilio.direccion,
            barrio:
              nuevoDomicilio.barrio,
            latitud:
              Number(
                nuevoDomicilio.latitud
              ),
            longitud:
              Number(
                nuevoDomicilio.longitud
              ),
            sede_id:
              Number(
                nuevoDomicilio.sede_id
              ),
            domiciliario_id:
              nuevoDomicilio.domiciliario_id
                ? Number(
                    nuevoDomicilio.domiciliario_id
                  )
                : null,
            metodo_pago:
              nuevoDomicilio.metodo_pago ||
              null,
            valor_pedido:
              nuevoDomicilio.valor_pedido
                ? Number(
                    nuevoDomicilio.valor_pedido
                  )
                : null,
            valor_domicilio:
              nuevoDomicilio.valor_domicilio
                ? Number(
                    nuevoDomicilio.valor_domicilio
                  )
                : null,
          }),
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
            'No se pudo crear el domicilio'
        )
      }

      console.log(
        'Domicilio creado:',
        datos
      )

      await cargarDomicilios()

      setNuevoDomicilio({
        cliente: '',
        telefono: '',
        direccion: '',
        barrio: '',
        latitud: '',
        longitud: '',
        sede_id: '',
        domiciliario_id: '',
        metodo_pago: '',
        valor_pedido: '',
        valor_domicilio: '',
      })

      setMostrarFormulario(false)

      alert(
        'Domicilio creado correctamente.'
      )
    } catch (error) {
      console.error(
        'Error creando domicilio:',
        error
      )

      alert(
        error.message ||
          'No se pudo crear el domicilio.'
      )
    }
  }

  // =========================================================
  // CONEXIÓN SOCKET.IO
  // =========================================================

  useEffect(() => {
    const manejarConexion = () => {
      console.log(
        'Conectado al backend:',
        socket.id
      )

      setConexion(
        'Conectado al servidor'
      )
    }

    const manejarDesconexion = () => {
      console.log(
        'Desconectado del backend'
      )

      setConexion(
        'Desconectado del servidor'
      )
    }

    socket.on(
      'connect',
      manejarConexion
    )

    socket.on(
      'disconnect',
      manejarDesconexion
    )

    return () => {
      socket.off(
        'connect',
        manejarConexion
      )

      socket.off(
        'disconnect',
        manejarDesconexion
      )
    }
  }, [])

  // =========================================================
  // RECIBIR GPS DESDE EL BACKEND
  // =========================================================

  useEffect(() => {
    const manejarUbicacion =
      (ubicacion) => {
        console.log(
          'Ubicación recibida:',
          ubicacion
        )

        if (
          ubicacion.latitud === undefined ||
          ubicacion.longitud === undefined ||
          ubicacion.domiciliario_id === undefined
        ) {
          return
        }

        const nuevaPosicion = [
          Number(ubicacion.latitud),
          Number(ubicacion.longitud),
        ]

        setPosicion(
          nuevaPosicion
        )

        setPosicionesDomiciliarios(
          (actuales) => ({
            ...actuales,
            [ubicacion.domiciliario_id]:
              ubicacion,
          })
        )

        setRutasDomiciliarios(
          (rutasActuales) => {
            const rutaActual =
              rutasActuales[
                ubicacion.domiciliario_id
              ] || []

            const nuevaRuta = [
              ...rutaActual,
              nuevaPosicion,
            ]

            return {
              ...rutasActuales,
              [ubicacion.domiciliario_id]:
                nuevaRuta.slice(-500),
            }
          }
        )

        if (
          ubicacion.precision !== null &&
          ubicacion.precision !== undefined
        ) {
          setPrecision(
            Number(
              ubicacion.precision
            )
          )
        }

        setError(null)
      }

    socket.on(
      'ubicacion_actualizada',
      manejarUbicacion
    )

    return () => {
      socket.off(
        'ubicacion_actualizada',
        manejarUbicacion
      )
    }
  }, [])


  // =========================================================
  // FUNCIONES PARA EL DASHBOARD
  // =========================================================

  const esHoy = (fecha) => {
    if (!fecha) {
      return false
    }

    const fechaObjeto =
      new Date(fecha)

    if (
      Number.isNaN(
        fechaObjeto.getTime()
      )
    ) {
      return false
    }

    const hoy = new Date()

    return (
      fechaObjeto.getFullYear() ===
        hoy.getFullYear() &&
      fechaObjeto.getMonth() ===
        hoy.getMonth() &&
      fechaObjeto.getDate() ===
        hoy.getDate()
    )
  }

  const minutosEntre = (
    inicio,
    fin
  ) => {
    if (!inicio || !fin) {
      return null
    }

    const fechaInicio =
      new Date(inicio)

    const fechaFin =
      new Date(fin)

    if (
      Number.isNaN(
        fechaInicio.getTime()
      ) ||
      Number.isNaN(
        fechaFin.getTime()
      )
    ) {
      return null
    }

    const minutos =
      (fechaFin.getTime() -
        fechaInicio.getTime()) /
      60000

    if (minutos < 0) {
      return null
    }

    return minutos
  }

  const formatearMinutos = (
    minutos
  ) => {
    if (
      minutos === null ||
      minutos === undefined ||
      Number.isNaN(minutos)
    ) {
      return '—'
    }

    if (minutos < 60) {
      return `${Math.round(minutos)} min`
    }

    const horas =
      Math.floor(minutos / 60)

    const minutosRestantes =
      Math.round(minutos % 60)

    return `${horas} h ${minutosRestantes} min`
  }

  const formatearMoneda = (
    valor
  ) => {
    if (
      valor === null ||
      valor === undefined ||
      valor === ''
    ) {
      return '$0'
    }

    return Number(valor).toLocaleString(
      'es-CO',
      {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }
    )
  }

  // =========================================================
  // DOMICILIOS DE HOY
  // =========================================================

  const domiciliosHoy = useMemo(() => {
    return domicilios.filter(
      (domicilio) =>
        esHoy(domicilio.creado_en)
    )
  }, [domicilios])

  const indicadores = useMemo(() => {
    const total =
      domiciliosHoy.length

    const pendientes =
      domiciliosHoy.filter(
        (d) =>
          d.estado ===
          'PENDIENTE'
      ).length

    const asignados =
      domiciliosHoy.filter(
        (d) =>
          d.estado ===
          'ASIGNADO'
      ).length

    const enCamino =
      domiciliosHoy.filter(
        (d) =>
          d.estado ===
          'EN CAMINO'
      ).length

    const entregados =
      domiciliosHoy.filter(
        (d) =>
          d.estado ===
          'ENTREGADO'
      ).length

    const cancelados =
      domiciliosHoy.filter(
        (d) =>
          d.estado ===
          'CANCELADO'
      ).length

    const domiciliariosEnTurno =
      domiciliarios.filter(
        (domiciliario) =>
          turnosActivos[
            domiciliario.id
          ]?.turnoActivo
      ).length

    const tiemposEntrega =
      domiciliosHoy
        .map((domicilio) =>
          minutosEntre(
            domicilio.inicio_en ||
              domicilio.asignado_en ||
              domicilio.creado_en,
            domicilio.entregado_en
          )
        )
        .filter(
          (valor) =>
            valor !== null
        )

    const promedio =
      tiemposEntrega.length
        ? tiemposEntrega.reduce(
            (total, valor) =>
              total + valor,
            0
          ) /
          tiemposEntrega.length
        : null

    return {
      total,
      pendientes,
      asignados,
      enCamino,
      entregados,
      cancelados,
      domiciliariosEnTurno,
      promedio,
    }
  }, [
    domiciliosHoy,
    domiciliarios,
    turnosActivos,
  ])

  // =========================================================
  // FILTRO DE DOMICILIOS
  // =========================================================

  const domiciliosFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase()

      return domicilios.filter(
        (domicilio) => {
          const coincideBusqueda =
            !texto ||
            String(
              domicilio.cliente || ''
            )
              .toLowerCase()
              .includes(texto) ||
            String(
              domicilio.telefono || ''
            )
              .toLowerCase()
              .includes(texto) ||
            String(
              domicilio.direccion || ''
            )
              .toLowerCase()
              .includes(texto) ||
            String(
              domicilio.id || ''
            )
              .includes(texto)

          const coincideEstado =
            filtroEstado ===
              'TODOS' ||
            domicilio.estado ===
              filtroEstado

          const coincideSede =
            filtroSede === 'TODAS' ||
            String(
              domicilio.sede_id
            ) ===
              String(filtroSede)

          return (
            coincideBusqueda &&
            coincideEstado &&
            coincideSede
          )
        }
      )
    }, [
      domicilios,
      busqueda,
      filtroEstado,
      filtroSede,
    ])

  // =========================================================
  // DOMICILIARIOS CON INFORMACIÓN ADMINISTRATIVA
  // =========================================================

  const domiciliariosPanel =
    useMemo(() => {
      return domiciliarios.map(
        (domiciliario) => {
          const turno =
            Boolean(
              turnosActivos[
                domiciliario.id
              ]?.turnoActivo
            )

          const posicionDomiciliario =
            posicionesDomiciliarios[
              domiciliario.id
            ]

          const entregados =
            domicilios.filter(
              (domicilio) =>
                domicilio.domiciliario_id ===
                  domiciliario.id &&
                domicilio.estado ===
                  'ENTREGADO'
            ).length

          const pendientes =
            domicilios.filter(
              (domicilio) =>
                domicilio.domiciliario_id ===
                  domiciliario.id &&
                domicilio.estado !==
                  'ENTREGADO' &&
                domicilio.estado !==
                  'CANCELADO'
            ).length

          let estado = 'FUERA DE TURNO'

          if (turno) {
            if (
              posicionDomiciliario
            ) {
              estado =
                'EN TURNO'
            } else {
              estado =
                'DISPONIBLE'
            }
          }

          const tieneDomicilioActivo =
            domicilios.some(
              (domicilio) =>
                domicilio.domiciliario_id ===
                  domiciliario.id &&
                domicilio.estado ===
                  'EN CAMINO'
            )

          if (
            turno &&
            tieneDomicilioActivo
          ) {
            estado =
              'EN DOMICILIO'
          }

          return {
            ...domiciliario,
            turno,
            posicion:
              posicionDomiciliario,
            entregados,
            pendientes,
            estado,
          }
        }
      )
    }, [
      domiciliarios,
      turnosActivos,
      posicionesDomiciliarios,
      domicilios,
    ])

  // =========================================================
  // DOMICILIARIOS DISPONIBLES POR ZONA
  // =========================================================

  const domiciliariosDisponibles =
    (zonaId) => {
      return domiciliarios.filter(
        (domiciliario) => {
          const estaEnTurno =
            Boolean(
              turnosActivos[
                domiciliario.id
              ]?.turnoActivo
            )

          return (
            Number(
              domiciliario.zona_id
            ) === Number(zonaId) &&
            domiciliario.activo !==
              false &&
            estaEnTurno
          )
        }
      )
    }

  // =========================================================
  // ESTILOS INLINE PARA EL DASHBOARD
  // =========================================================

  const estilos = {
    dashboard: {
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
    },

    encabezado: {
      display: 'flex',
      justifyContent:
        'space-between',
      alignItems: 'center',
      gap: '15px',
      flexWrap: 'wrap',
    },

    titulo: {
      margin: 0,
      fontSize: '26px',
      fontWeight: 700,
    },

    subtitulo: {
      margin:
        '5px 0 0',
      color: '#64748b',
      fontSize: '14px',
    },

    botonPrincipal: {
      border: 'none',
      borderRadius: '10px',
      padding:
        '11px 16px',
      cursor: 'pointer',
      fontWeight: 700,
      background:
        '#2563eb',
      color: '#fff',
    },

    indicadores: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit, minmax(145px, 1fr))',
      gap: '12px',
    },

    indicador: {
      background:
        '#ffffff',
      border:
        '1px solid #e2e8f0',
      borderRadius: '14px',
      padding: '16px',
      boxShadow:
        '0 2px 8px rgba(15, 23, 42, 0.05)',
    },

    indicadorNumero: {
      fontSize: '27px',
      fontWeight: 800,
      marginTop: '7px',
    },

    indicadorTexto: {
      color: '#64748b',
      fontSize: '13px',
      fontWeight: 600,
    },

    contenidoDosColumnas: {
      display: 'grid',
      gridTemplateColumns:
        'minmax(350px, 0.9fr) minmax(450px, 1.5fr)',
      gap: '18px',
    },

    tarjeta: {
      background:
        '#ffffff',
      border:
        '1px solid #e2e8f0',
      borderRadius: '14px',
      padding: '16px',
      boxShadow:
        '0 2px 8px rgba(15, 23, 42, 0.05)',
    },

    tituloTarjeta: {
      margin:
        '0 0 13px',
      fontSize: '17px',
      fontWeight: 700,
    },

    filtros: {
      display: 'grid',
      gridTemplateColumns:
        '1.5fr 1fr 1fr',
      gap: '10px',
      marginBottom: '14px',
    },

    input: {
      width: '100%',
      boxSizing: 'border-box',
      padding:
        '10px 11px',
      border:
        '1px solid #cbd5e1',
      borderRadius: '9px',
      background:
        '#ffffff',
      fontSize: '14px',
    },

    tablaContenedor: {
      overflowX: 'auto',
    },

    tabla: {
      width: '100%',
      borderCollapse:
        'collapse',
      fontSize: '13px',
    },

    celda: {
      padding:
        '11px 8px',
      borderBottom:
        '1px solid #e2e8f0',
      verticalAlign:
        'top',
    },

    badge: {
      display:
        'inline-flex',
      alignItems:
        'center',
      borderRadius: '999px',
      padding:
        '5px 9px',
      fontSize: '11px',
      fontWeight: 700,
      whiteSpace:
        'nowrap',
    },

    mapa: {
      height: '560px',
      width: '100%',
      borderRadius: '12px',
      overflow: 'hidden',
    },

    listaDomiciliarios: {
      display: 'grid',
      gap: '9px',
    },

    domiciliario: {
      border:
        '1px solid #e2e8f0',
      borderRadius: '10px',
      padding: '11px',
      display: 'flex',
      justifyContent:
        'space-between',
      gap: '10px',
      alignItems: 'center',
    },

    modalFondo: {
      position: 'fixed',
      inset: 0,
      background:
        'rgba(15, 23, 42, 0.55)',
      zIndex: 2000,
      display: 'flex',
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: '20px',
    },

    modal: {
      width: 'min(950px, 100%)',
      maxHeight: '92vh',
      overflowY: 'auto',
      background:
        '#ffffff',
      borderRadius: '16px',
      padding: '22px',
      boxShadow:
        '0 20px 60px rgba(0,0,0,0.25)',
    },

    formulario: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(2, minmax(0, 1fr))',
      gap: '13px',
    },

    campoCompleto: {
      gridColumn:
        '1 / -1',
    },

    label: {
      display: 'flex',
      flexDirection:
        'column',
      gap: '6px',
      fontSize: '13px',
      fontWeight: 700,
      color: '#334155',
    },

    botonesModal: {
      display: 'flex',
      justifyContent:
        'flex-end',
      gap: '10px',
      marginTop: '16px',
    },
  }

  // =========================================================
  // COLOR DEL ESTADO
  // =========================================================

  const estiloEstado = (
    estado
  ) => {
    if (
      estado === 'PENDIENTE'
    ) {
      return {
        background:
          '#fef3c7',
        color:
          '#92400e',
      }
    }

    if (
      estado === 'ASIGNADO'
    ) {
      return {
        background:
          '#dbeafe',
        color:
          '#1d4ed8',
      }
    }

    if (
      estado === 'EN CAMINO'
    ) {
      return {
        background:
          '#dcfce7',
        color:
          '#166534',
      }
    }

    if (
      estado === 'ENTREGADO'
    ) {
      return {
        background:
          '#d1fae5',
        color:
          '#065f46',
      }
    }

    if (
      estado === 'CANCELADO'
    ) {
      return {
        background:
          '#fee2e2',
        color:
          '#991b1b',
      }
    }

    return {
      background:
        '#f1f5f9',
      color:
        '#475569',
    }
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="app">

      {/* ================================================= */}
      {/* ENCABEZADO */}
      {/* ================================================= */}

      <header className="header">

        <div>
          <h1>
            Droguería Microfarma
          </h1>

          <p>
            Gestión y seguimiento de domicilios
          </p>
        </div>

        <div>
          <strong>
            {conexion}
          </strong>
        </div>

      </header>

      <main className="contenido">

        {/* ================================================= */}
        {/* ================================================= */}
        {/* PANEL ADMINISTRATIVO */}
        {/* ================================================= */}

        <div
            style={
              estilos.dashboard
            }
          >

            {/* ============================================= */}
            {/* ENCABEZADO ADMINISTRATIVO */}
            {/* ============================================= */}

            <div
              style={
                estilos.encabezado
              }
            >

              <div>
                <h2
                  style={
                    estilos.titulo
                  }
                >
                  Panel administrativo
                </h2>

                <p
                  style={
                    estilos.subtitulo
                  }
                >
                  Control de domicilios, domiciliarios y seguimiento en tiempo real.
                </p>
              </div>

              <button
                type="button"
                style={
                  estilos.botonPrincipal
                }
                onClick={() =>
                  setMostrarFormulario(
                    true
                  )
                }
              >
                + Nuevo domicilio
              </button>

            </div>

            {/* ============================================= */}
            {/* INDICADORES */}
            {/* ============================================= */}

            <div
              style={
                estilos.indicadores
              }
            >

              <div
                style={
                  estilos.indicador
                }
              >
                <div
                  style={
                    estilos.indicadorTexto
                  }
                >
                  DOMICILIOS HOY
                </div>

                <div
                  style={
                    estilos.indicadorNumero
                  }
                >
                  {
                    indicadores.total
                  }
                </div>
              </div>

              <div
                style={
                  estilos.indicador
                }
              >
                <div
                  style={
                    estilos.indicadorTexto
                  }
                >
                  PENDIENTES
                </div>

                <div
                  style={
                    estilos.indicadorNumero
                  }
                >
                  {
                    indicadores.pendientes
                  }
                </div>
              </div>

              <div
                style={
                  estilos.indicador
                }
              >
                <div
                  style={
                    estilos.indicadorTexto
                  }
                >
                  ASIGNADOS
                </div>

                <div
                  style={
                    estilos.indicadorNumero
                  }
                >
                  {
                    indicadores.asignados
                  }
                </div>
              </div>

              <div
                style={
                  estilos.indicador
                }
              >
                <div
                  style={
                    estilos.indicadorTexto
                  }
                >
                  EN CAMINO
                </div>

                <div
                  style={
                    estilos.indicadorNumero
                  }
                >
                  {
                    indicadores.enCamino
                  }
                </div>
              </div>

              <div
                style={
                  estilos.indicador
                }
              >
                <div
                  style={
                    estilos.indicadorTexto
                  }
                >
                  ENTREGADOS
                </div>

                <div
                  style={
                    estilos.indicadorNumero
                  }
                >
                  {
                    indicadores.entregados
                  }
                </div>
              </div>

              <div
                style={
                  estilos.indicador
                }
              >
                <div
                  style={
                    estilos.indicadorTexto
                  }
                >
                  CANCELADOS
                </div>

                <div
                  style={
                    estilos.indicadorNumero
                  }
                >
                  {
                    indicadores.cancelados
                  }
                </div>
              </div>

              <div
                style={
                  estilos.indicador
                }
              >
                <div
                  style={
                    estilos.indicadorTexto
                  }
                >
                  DOMICILIARIOS EN TURNO
                </div>

                <div
                  style={
                    estilos.indicadorNumero
                  }
                >
                  {
                    indicadores.domiciliariosEnTurno
                  }
                </div>
              </div>

              <div
                style={
                  estilos.indicador
                }
              >
                <div
                  style={
                    estilos.indicadorTexto
                  }
                >
                  TIEMPO PROMEDIO
                </div>

                <div
                  style={
                    estilos.indicadorNumero
                  }
                >
                  {
                    formatearMinutos(
                      indicadores.promedio
                    )
                  }
                </div>
              </div>

            </div>

            {/* ============================================= */}
            {/* DOMICILIOS + MAPA */}
            {/* ============================================= */}

            <div
              style={
                estilos.contenidoDosColumnas
              }
            >

              {/* ========================================= */}
              {/* LISTA ADMINISTRATIVA */}
              {/* ========================================= */}

              <section
                style={
                  estilos.tarjeta
                }
              >

                <h3
                  style={
                    estilos.tituloTarjeta
                  }
                >
                  Domicilios
                </h3>

                <div
                  style={
                    estilos.filtros
                  }
                >

                  <input
                    type="text"
                    placeholder="Buscar cliente, teléfono, dirección o #"
                    value={busqueda}
                    onChange={(e) =>
                      setBusqueda(
                        e.target.value
                      )
                    }
                    style={
                      estilos.input
                    }
                  />

                  <select
                    value={
                      filtroEstado
                    }
                    onChange={(e) =>
                      setFiltroEstado(
                        e.target.value
                      )
                    }
                    style={
                      estilos.input
                    }
                  >
                    <option value="TODOS">
                      Todos los estados
                    </option>

                    {ESTADOS.map(
                      (estado) => (
                        <option
                          key={estado}
                          value={estado}
                        >
                          {estado}
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={
                      filtroSede
                    }
                    onChange={(e) =>
                      setFiltroSede(
                        e.target.value
                      )
                    }
                    style={
                      estilos.input
                    }
                  >
                    <option value="TODAS">
                      Todas las sedes
                    </option>

                    {sedes.map(
                      (sede) => (
                        <option
                          key={sede.id}
                          value={sede.id}
                        >
                          {sede.nombre}
                        </option>
                      )
                    )}
                  </select>

                </div>

                <div
                  style={
                    estilos.tablaContenedor
                  }
                >

                  <table
                    style={
                      estilos.tabla
                    }
                  >

                    <thead>
                      <tr>

                        <th
                          style={
                            estilos.celda
                          }
                        >
                          Pedido
                        </th>

                        <th
                          style={
                            estilos.celda
                          }
                        >
                          Cliente
                        </th>

                        <th
                          style={
                            estilos.celda
                          }
                        >
                          Sede
                        </th>

                        <th
                          style={
                            estilos.celda
                          }
                        >
                          Domiciliario
                        </th>

                        <th
                          style={
                            estilos.celda
                          }
                        >
                          Estado
                        </th>

                        <th
                          style={
                            estilos.celda
                          }
                        >
                          Acción
                        </th>

                      </tr>
                    </thead>

                    <tbody>

                      {domiciliosFiltrados.length ===
                      0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              ...estilos.celda,
                              textAlign:
                                'center',
                              color:
                                '#64748b',
                              padding:
                                '25px',
                            }}
                          >
                            No hay domicilios que coincidan con los filtros.
                          </td>
                        </tr>
                      ) : (
                        domiciliosFiltrados.map(
                          (domicilio) => {

                            const sede =
                              sedes.find(
                                (sede) =>
                                  Number(
                                    sede.id
                                  ) ===
                                  Number(
                                    domicilio.sede_id
                                  )
                              )

                            const domiciliariosZona =
  domiciliarios.filter(
    (domiciliario) =>
      Number(
        domiciliario.zona_id
      ) ===
        Number(
          domicilio.zona_id
        ) &&
      domiciliario.activo !==
        false &&
      Boolean(
        turnosActivos[
          domiciliario.id
        ]?.turnoActivo
      )
  )

                            return (
                              <tr
                                key={
                                  domicilio.id
                                }
                              >

                                <td
                                  style={
                                    estilos.celda
                                  }
                                >
                                  <strong>
                                    #
                                    {
                                      domicilio.id
                                    }
                                  </strong>

                                  <div
                                    style={{
                                      marginTop:
                                        '4px',
                                      fontSize:
                                        '11px',
                                      color:
                                        '#64748b',
                                    }}
                                  >
                                    {
                                      domicilio.creado_en
                                        ? new Date(
                                            domicilio.creado_en
                                          ).toLocaleTimeString(
                                            'es-CO',
                                            {
                                              hour:
                                                '2-digit',
                                              minute:
                                                '2-digit',
                                            }
                                          )
                                        : '—'
                                    }
                                  </div>
                                </td>

                                <td
                                  style={
                                    estilos.celda
                                  }
                                >
                                  <strong>
                                    {
                                      domicilio.cliente
                                    }
                                  </strong>

                                  <div>
                                    {
                                      domicilio.telefono
                                    }
                                  </div>

                                  <div
                                    style={{
                                      marginTop:
                                        '4px',
                                      color:
                                        '#64748b',
                                      maxWidth:
                                        '190px',
                                    }}
                                  >
                                    {
                                      domicilio.direccion
                                    }
                                  </div>
                                </td>

                                <td
                                  style={
                                    estilos.celda
                                  }
                                >
                                  {
                                    domicilio.sede ||
                                      sede?.nombre ||
                                      'Sin sede'
                                  }

                                  <div
                                    style={{
                                      fontSize:
                                        '11px',
                                      color:
                                        '#64748b',
                                      marginTop:
                                        '3px',
                                    }}
                                  >
                                    Zona{' '}
                                    {
                                      domicilio.zona ||
                                        sede?.zona_nombre ||
                                        domicilio.zona_id ||
                                        '—'
                                    }
                                  </div>
                                </td>

                                <td
                                  style={
                                    estilos.celda
                                  }
                                >

                                  <select
                                    value={
                                      domicilio.domiciliario_id ||
                                      ''
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      asignarDomiciliario(
                                        domicilio.id,
                                        e.target.value
                                      )
                                    }
                                    style={{
                                      ...estilos.input,
                                      minWidth:
                                        '145px',
                                      padding:
                                        '7px',
                                      fontSize:
                                        '12px',
                                    }}
                                  >

                                    <option value="">
                                      Sin asignar
                                    </option>

                                    {domiciliariosZona.map(
                                      (
                                        domiciliario
                                      ) => (
                                        <option
                                          key={
                                            domiciliario.id
                                          }
                                          value={
                                            domiciliario.id
                                          }
                                        >
                                          {
                                            domiciliario.nombre
                                          }
                                        </option>
                                      )
                                    )}

                                  </select>

                                </td>

                                <td
                                  style={
                                    estilos.celda
                                  }
                                >

                                  <select
                                    value={
                                      domicilio.estado
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      actualizarEstado(
                                        domicilio.id,
                                        e.target.value
                                      )
                                    }
                                    style={{
                                      ...estilos.input,
                                      padding:
                                        '7px',
                                      fontSize:
                                        '11px',
                                      fontWeight:
                                        700,
                                      ...estiloEstado(
                                        domicilio.estado
                                      ),
                                    }}
                                  >

                                    {ESTADOS.map(
                                      (
                                        estado
                                      ) => (
                                        <option
                                          key={
                                            estado
                                          }
                                          value={
                                            estado
                                          }
                                        >
                                          {
                                            estado
                                          }
                                        </option>
                                      )
                                    )}

                                  </select>

                                </td>

                                <td
                                  style={
                                    estilos.celda
                                  }
                                >

                                  <div
                                    style={{
                                      display:
                                        'flex',
                                      flexDirection:
                                        'column',
                                      gap:
                                        '6px',
                                    }}
                                  >

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDomicilioActivo(
                                          domicilio.id
                                        )
                                      }
                                      style={{
                                        border:
                                          'none',
                                        borderRadius:
                                          '7px',
                                        padding:
                                          '6px 8px',
                                        cursor:
                                          'pointer',
                                        background:
                                          '#e0f2fe',
                                        color:
                                          '#0369a1',
                                        fontSize:
                                          '11px',
                                        fontWeight:
                                          700,
                                      }}

                                    >
                                      
<button
  type="button"
  onClick={() => abrirEditorUbicacion(domicilio)}
  style={{
    border: 'none',
    borderRadius: '7px',
    padding: '6px 8px',
    cursor: 'pointer',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '11px',
    fontWeight: 700,
  }}
>
  Editar ubicación
</button>

                                      Ver mapa
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        eliminarDomicilio(
                                          domicilio.id
                                        )
                                      }
                                      style={{
                                        border:
                                          'none',
                                        borderRadius:
                                          '7px',
                                        padding:
                                          '6px 8px',
                                        cursor:
                                          'pointer',
                                        background:
                                          '#fee2e2',
                                        color:
                                          '#991b1b',
                                        fontSize:
                                          '11px',
                                        fontWeight:
                                          700,
                                      }}
                                    >
                                      Eliminar
                                    </button>

                                  </div>

                                </td>

                              </tr>
                            )
                          }
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </section>

              {/* ========================================= */}
              {/* MAPA */}
              {/* ========================================= */}

              <section
                style={
                  estilos.tarjeta
                }
              >

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    marginBottom:
                      '13px',
                    gap:
                      '10px',
                  }}
                >

                  <h3
                    style={{
                      ...estilos.tituloTarjeta,
                      margin:
                        0,
                    }}
                  >
                    Mapa operativo
                  </h3>

                  <span
                    style={{
                      fontSize:
                        '12px',
                      color:
                        '#64748b',
                    }}
                  >
                    GPS en tiempo real
                  </span>

                </div>

                <div
                  style={
                    estilos.mapa
                  }
                >

                  <MapContainer
                    center={
                      MAPA_CENTRO
                    }
                    zoom={14}
                    scrollWheelZoom={
                      true
                    }
                    style={{
                      height:
                        '100%',
                      width:
                        '100%',
                    }}
                  >

                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* RUTAS GPS */}

                    {Object.entries(
                      rutasDomiciliarios
                    ).map(
                      ([
                        id,
                        ruta,
                      ]) => {

                        const colores =
                          [
                            '#2563eb',
                            '#16a34a',
                            '#f59e0b',
                            '#dc2626',
                          ]

                        const color =
                          colores[
                            (Number(
                              id
                            ) -
                              1) %
                              colores.length
                          ]

                        return (
                          <Polyline
                            key={`ruta-${id}`}
                            positions={
                              ruta
                            }
                            pathOptions={{
                              color,
                              weight:
                                5,
                              opacity:
                                0.75,
                            }}
                          />
                        )
                      }
                    )}

                    {/* DOMICILIARIOS */}

                    {Object.values(
                      posicionesDomiciliarios
                    ).map(
                      (
                        domiciliario
                      ) => (
                        <Marker
                          key={
                            domiciliario.domiciliario_id
                          }
                          position={[
                            Number(
                              domiciliario.latitud
                            ),
                            Number(
                              domiciliario.longitud
                            ),
                          ]}
                          icon={crearIconoMoto(
                            domiciliario.nombre
                          )}
                        >

                          <Popup>

                            <strong>
                              {
                                domiciliario.nombre
                              }
                            </strong>

                            <br />

                            ID:{' '}
                            {
                              domiciliario.domiciliario_id
                            }

                            <br />

                            GPS activo

                            <br />

                            Precisión:{' '}
                            {domiciliario.precision !=
                            null
                              ? `${Math.round(
                                  domiciliario.precision
                                )} m`
                              : 'No disponible'}

                            <br />

                            Última actualización:{' '}

                            {
                              domiciliario.fecha_hora
                                ? new Date(
                                    domiciliario.fecha_hora
                                  ).toLocaleTimeString(
                                    'es-CO'
                                  )
                                : '—'
                            }

                          </Popup>

                        </Marker>
                      )
                    )}

                    {/* DOMICILIOS */}

                    {domicilios
                      .filter(
                        (domicilio) =>
                          domicilio.latitud !=
                            null &&
                          domicilio.longitud !=
                            null &&
                          domicilio.estado !==
                            'ENTREGADO' &&
                          domicilio.estado !==
                            'CANCELADO'
                      )
                      .map(
                        (domicilio) => (
                          <Marker
                            key={`domicilio-${domicilio.id}`}
                            position={[
                              Number(
                                domicilio.latitud
                              ),
                              Number(
                                domicilio.longitud
                              ),
                            ]}
                            icon={crearIconoPedido()}
                          >

                            <Popup>

                              <strong>
                                Domicilio #
                                {
                                  domicilio.id
                                }
                              </strong>

                              <br />

                              Cliente:{' '}
                              {
                                domicilio.cliente
                              }

                              <br />

                              Teléfono:{' '}
                              {
                                domicilio.telefono
                              }

                              <br />

                              Dirección:{' '}
                              {
                                domicilio.direccion
                              }

                              <br />

                              Barrio:{' '}
                              {
                                domicilio.barrio ||
                                'No disponible'
                              }

                              <br />

                              Sede:{' '}
                              {
                                domicilio.sede ||
                                'Sin sede'
                              }

                              <br />

                              Estado:{' '}
                              {
                                domicilio.estado
                              }

                              <br />

                              Domiciliario:{' '}
                              {
                                domicilio.domiciliario ||
                                'Sin asignar'
                              }

                            </Popup>

                          </Marker>
                        )
                      )}

                  </MapContainer>

                </div>

              </section>

            </div>

            {/* ============================================= */}
            {/* DOMICILIARIOS */}
            {/* ============================================= */}

            <section
              style={
                estilos.tarjeta
              }
            >

              <div
                style={{
                  display:
                    'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                  marginBottom:
                    '13px',
                }}
              >

                <h3
                  style={{
                    ...estilos.tituloTarjeta,
                    margin:
                      0,
                  }}
                >
                  Domiciliarios
                </h3>

                <span
                  style={{
                    fontSize:
                      '12px',
                    color:
                      '#64748b',
                  }}
                >
                  {
                    indicadores.domiciliariosEnTurno
                  } en turno
                </span>

              </div>

              <div
                style={
                  estilos.listaDomiciliarios
                }
              >

                {domiciliariosPanel.length ===
                0 ? (
                  <p>
                    No hay domiciliarios registrados.
                  </p>
                ) : (
                  domiciliariosPanel.map(
                    (
                      domiciliario
                    ) => {

                      const colorEstado =
                        domiciliario.estado ===
                        'FUERA DE TURNO'
                          ? {
                              background:
                                '#f1f5f9',
                              color:
                                '#64748b',
                            }
                          : domiciliario.estado ===
                            'EN DOMICILIO'
                          ? {
                              background:
                                '#dcfce7',
                              color:
                                '#166534',
                            }
                          : {
                              background:
                                '#dbeafe',
                              color:
                                '#1d4ed8',
                            }

                      return (
                        <div
                          key={
                            domiciliario.id
                          }
                          style={
                            estilos.domiciliario
                          }
                        >

                          <div>

                            <strong>
                              {
                                domiciliario.nombre
                              }
                            </strong>

                            <div
                              style={{
                                fontSize:
                                  '12px',
                                color:
                                  '#64748b',
                                marginTop:
                                  '4px',
                              }}
                            >
                              Zona{' '}
                              {
                                domiciliario.zona_id ||
                                '—'
                              }

                              {' · '}

                              {
                                domiciliario.entregados
                              }{' '}
                              entregados

                              {' · '}

                              {
                                domiciliario.pendientes
                              }{' '}
                              pendientes
                            </div>

                          </div>

                          <div
                            style={{
                              display:
                                'flex',
                              flexDirection:
                                'column',
                              alignItems:
                                'flex-end',
                              gap:
                                '5px',
                            }}
                          >

                            <span
                              style={{
                                ...estilos.badge,
                                ...colorEstado,
                              }}
                            >
                              ●{' '}
                              {
                                domiciliario.estado
                              }
                            </span>

                            {domiciliario.posicion && (
                              <span
                                style={{
                                  fontSize:
                                    '11px',
                                  color:
                                    '#64748b',
                                }}
                              >
                                GPS activo
                              </span>
                            )}

                          </div>

                        </div>
                      )
                    }
                  )
                )}

              </div>

            </section>

            {/* ============================================= */}
            {/* RESUMEN DE TIEMPOS */}
            {/* ============================================= */}

            <section
              style={
                estilos.tarjeta
              }
            >

              <h3
                style={
                  estilos.tituloTarjeta
                }
              >
                Resumen de operación de hoy
              </h3>

              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(180px, 1fr))',
                  gap:
                    '12px',
                }}
              >

                <div
                  style={{
                    padding:
                      '13px',
                    border:
                      '1px solid #e2e8f0',
                    borderRadius:
                      '10px',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '12px',
                      color:
                        '#64748b',
                    }}
                  >
                    Total creados
                  </div>

                  <strong
                    style={{
                      display:
                        'block',
                      marginTop:
                        '5px',
                      fontSize:
                        '21px',
                    }}
                  >
                    {
                      indicadores.total
                    }
                  </strong>
                </div>

                <div
                  style={{
                    padding:
                      '13px',
                    border:
                      '1px solid #e2e8f0',
                    borderRadius:
                      '10px',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '12px',
                      color:
                        '#64748b',
                    }}
                  >
                    Entregados
                  </div>

                  <strong
                    style={{
                      display:
                        'block',
                      marginTop:
                        '5px',
                      fontSize:
                        '21px',
                    }}
                  >
                    {
                      indicadores.entregados
                    }
                  </strong>
                </div>

                <div
                  style={{
                    padding:
                      '13px',
                    border:
                      '1px solid #e2e8f0',
                    borderRadius:
                      '10px',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '12px',
                      color:
                        '#64748b',
                    }}
                  >
                    Tiempo promedio
                  </div>

                  <strong
                    style={{
                      display:
                        'block',
                      marginTop:
                        '5px',
                      fontSize:
                        '21px',
                    }}
                  >
                    {
                      formatearMinutos(
                        indicadores.promedio
                      )
                    }
                  </strong>
                </div>

                <div
                  style={{
                    padding:
                      '13px',
                    border:
                      '1px solid #e2e8f0',
                    borderRadius:
                      '10px',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '12px',
                      color:
                        '#64748b',
                    }}
                  >
                    Porcentaje entregado
                  </div>

                  <strong
                    style={{
                      display:
                        'block',
                      marginTop:
                        '5px',
                      fontSize:
                        '21px',
                    }}
                  >
                    {
                      indicadores.total
                        ? Math.round(
                            (indicadores.entregados /
                              indicadores.total) *
                              100
                          )
                        : 0
                    }
                    %
                  </strong>
                </div>

              </div>

            </section>

          </div>

      </main>

{/* MODAL EDITAR UBICACIÓN */}
{domicilioEditandoUbicacion && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      zIndex: 3000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px',
      overflowY: 'auto',
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget && !guardandoUbicacion) {
        setDomicilioEditandoUbicacion(null)
      }
    }}
  >
    <div
      style={{
        background: '#ffffff',
        borderRadius: '14px',
        padding: '22px',
        width: '100%',
        maxWidth: '850px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
      }}
    >
      <h2 style={{ marginTop: 0, color: '#0f172a' }}>
        Corregir ubicación del domicilio #{domicilioEditandoUbicacion.id}
      </h2>

      <p style={{ color: '#475569', fontSize: '14px' }}>
        <strong>Dirección:</strong>{' '}
        {domicilioEditandoUbicacion.direccion}
        <br />
        <strong>Barrio:</strong>{' '}
        {domicilioEditandoUbicacion.barrio || 'No especificado'}
      </p>

      <p style={{ color: '#475569', fontSize: '13px' }}>
        Arrastra el marcador verde o haz clic en el punto exacto del mapa.
        Acércate lo suficiente para ubicar correctamente la dirección.
      </p>

      <div
        style={{
          height: '400px',
          width: '100%',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
        }}
      >
        <MapContainer
          key={`editar-ubicacion-${domicilioEditandoUbicacion.id}`}
          center={[
            domicilioEditandoUbicacion.latitud,
            domicilioEditandoUbicacion.longitud,
          ]}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <CentrarMapa
            posicion={[
              domicilioEditandoUbicacion.latitud,
              domicilioEditandoUbicacion.longitud,
            ]}
          />

          <SeleccionarUbicacion
            posicion={[
              domicilioEditandoUbicacion.latitud,
              domicilioEditandoUbicacion.longitud,
            ]}
            onSeleccionar={(nuevaPosicion) => {
              setDomicilioEditandoUbicacion((actual) =>
                actual
                  ? {
                      ...actual,
                      latitud: nuevaPosicion[0],
                      longitud: nuevaPosicion[1],
                    }
                  : actual
              )
            }}
          />
        </MapContainer>
      </div>

      <p
        style={{
          fontSize: '12px',
          color: '#475569',
          overflowWrap: 'anywhere',
        }}
      >
        Latitud: {domicilioEditandoUbicacion.latitud}
        {' | '}
        Longitud: {domicilioEditandoUbicacion.longitud}
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '18px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          disabled={guardandoUbicacion}
          onClick={() => setDomicilioEditandoUbicacion(null)}
          style={{
            padding: '10px 16px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            background: '#ffffff',
            cursor: guardandoUbicacion ? 'not-allowed' : 'pointer',
          }}
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={guardandoUbicacion}
          onClick={guardarUbicacionDomicilio}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderRadius: '8px',
            background: guardandoUbicacion ? '#94a3b8' : '#15803d',
            color: '#ffffff',
            fontWeight: 700,
            cursor: guardandoUbicacion ? 'not-allowed' : 'pointer',
          }}
        >
          {guardandoUbicacion ? 'Guardando...' : 'Guardar ubicación'}
        </button>
      </div>
    </div>
  </div>
)}

      {/* ================================================= */}
      {/* MODAL NUEVO DOMICILIO */}
      {/* ================================================= */}

      {mostrarFormulario && (
        <div
          style={
            estilos.modalFondo
          }
          onClick={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              setMostrarFormulario(
                false
              )
            }
          }}
        >

          <div
            style={
              estilos.modal
            }
          >

            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                marginBottom:
                  '18px',
              }}
            >

              <div>
                <h2
                  style={{
                    margin:
                      0,
                  }}
                >
                  Nuevo domicilio
                </h2>

                <p
                  style={{
                    margin:
                      '5px 0 0',
                    color:
                      '#64748b',
                    fontSize:
                      '13px',
                  }}
                >
                  Registra el pedido y la ubicación del cliente.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarFormulario(
                    false
                  )
                }
                style={{
                  border:
                    'none',
                  background:
                    '#f1f5f9',
                  borderRadius:
                    '8px',
                  padding:
                    '8px 11px',
                  cursor:
                    'pointer',
                  fontSize:
                    '18px',
                }}
              >
                ×
              </button>

            </div>

            <div
              style={
                estilos.formulario
              }
            >

              {/* CLIENTE */}

              <label
                style={
                  estilos.label
                }
              >
                Cliente *

                <input
                  type="text"
                  value={
                    nuevoDomicilio.cliente
                  }
                  onChange={(e) =>
                    setNuevoDomicilio(
                      (
                        actual
                      ) => ({
                        ...actual,
                        cliente:
                          e.target
                            .value,
                      })
                    )
                  }
                  placeholder="Nombre completo"
                  style={
                    estilos.input
                  }
                />

              </label>

              {/* TELÉFONO */}

              <label
                style={
                  estilos.label
                }
              >
                Teléfono *

                <input
                  type="text"
                  value={
                    nuevoDomicilio.telefono
                  }
                  onChange={(e) =>
                    setNuevoDomicilio(
                      (
                        actual
                      ) => ({
                        ...actual,
                        telefono:
                          e.target
                            .value,
                      })
                    )
                  }
                  placeholder="Número de teléfono"
                  style={
                    estilos.input
                  }
                />

              </label>

              {/* DIRECCIÓN */}

              <label
                style={
                  estilos.label
                }
              >
                Dirección *

                <input
                  type="text"
                  value={
                    nuevoDomicilio.direccion
                  }
                  onChange={(e) =>
                    setNuevoDomicilio(
                      (
                        actual
                      ) => ({
                        ...actual,
                        direccion:
                          e.target
                            .value,
                      })
                    )
                  }
                  placeholder="Ej: Calle 29 #16-43"
                  style={
                    estilos.input
                  }
                />

              </label>

              {/* BARRIO */}

              <label
                style={
                  estilos.label
                }
              >
                Barrio *

                <input
                  type="text"
                  value={
                    nuevoDomicilio.barrio
                  }
                  onChange={(e) =>
                    setNuevoDomicilio(
                      (
                        actual
                      ) => ({
                        ...actual,
                        barrio:
                          e.target
                            .value,
                      })
                    )
                  }
                  placeholder="Barrio"
                  style={
                    estilos.input
                  }
                />

              </label>

              {/* SEDE */}

              <label
                style={
                  estilos.label
                }
              >
                Sede de origen *

                <select
                  value={
                    nuevoDomicilio.sede_id
                  }
                  onChange={(e) => {
                    const nuevaSedeId =
                      Number(
                        e.target
                          .value
                      )

                    setNuevoDomicilio(
                      (
                        actual
                      ) => ({
                        ...actual,
                        sede_id:
                          nuevaSedeId,
                        domiciliario_id:
                          '',
                      })
                    )
                  }}
                  style={
                    estilos.input
                  }
                >

                  <option value="">
                    Seleccionar sede
                  </option>

                  {sedes.map(
                    (sede) => (
                      <option
                        key={
                          sede.id
                        }
                        value={
                          sede.id
                        }
                      >
                        {
                          sede.nombre
                        }
                        {sede.zona_nombre
                          ? ` - ${sede.zona_nombre}`
                          : ''}
                      </option>
                    )
                  )}

                </select>

              </label>

              {/* DOMICILIARIO */}

              <label
                style={
                  estilos.label
                }
              >
                Domiciliario

                <select
                  value={
                    nuevoDomicilio.domiciliario_id
                  }
                  onChange={(e) =>
                    setNuevoDomicilio(
                      (
                        actual
                      ) => ({
                        ...actual,
                        domiciliario_id:
                          e.target
                            .value,
                      })
                    )
                  }
                  disabled={
                    !nuevoDomicilio.sede_id
                  }
                  style={
                    estilos.input
                  }
                >

                  <option value="">
                    Sin asignar
                  </option>

                  {nuevoDomicilio.sede_id &&
                    domiciliariosDisponibles(
                      sedes.find(
                        (sede) =>
                          Number(
                            sede.id
                          ) ===
                          Number(
                            nuevoDomicilio.sede_id
                          )
                      )?.zona_id
                    ).map(
                      (
                        domiciliario
                      ) => (
                        <option
                          key={
                            domiciliario.id
                          }
                          value={
                            domiciliario.id
                          }
                        >
                          {
                            domiciliario.nombre
                          }
                        </option>
                      )
                    )}

                </select>

                <span
                  style={{
                    fontSize:
                      '11px',
                    color:
                      '#64748b',
                    fontWeight:
                      400,
                  }}
                >
                  Se muestran domiciliarios activos en turno de la misma zona.
                </span>

              </label>

              {/* MÉTODO DE PAGO */}

              <label
                style={
                  estilos.label
                }
              >
                Método de pago

                <select
                  value={
                    nuevoDomicilio.metodo_pago
                  }
                  onChange={(e) =>
                    setNuevoDomicilio(
                      (
                        actual
                      ) => ({
                        ...actual,
                        metodo_pago:
                          e.target
                            .value,
                      })
                    )
                  }
                  style={
                    estilos.input
                  }
                >

                  <option value="">
                    Seleccionar
                  </option>

                  <option value="EFECTIVO">
                    Efectivo
                  </option>

                  <option value="TRANSFERENCIA">
                    Transferencia
                  </option>

                  <option value="TARJETA">
                    Tarjeta
                  </option>

                  <option value="OTRO">
                    Otro
                  </option>

                </select>

              </label>

              {/* VALOR PEDIDO */}

              <label
                style={
                  estilos.label
                }
              >
                Valor del pedido

                <input
                  type="number"
                  min="0"
                  value={
                    nuevoDomicilio.valor_pedido
                  }
                  onChange={(e) =>
                    setNuevoDomicilio(
                      (
                        actual
                      ) => ({
                        ...actual,
                        valor_pedido:
                          e.target
                            .value,
                      })
                    )
                  }
                  placeholder="0"
                  style={
                    estilos.input
                  }
                />

              </label>

              {/* VALOR DOMICILIO */}

              <label
                style={
                  estilos.label
                }
              >
                Valor del domicilio

                <input
                  type="number"
                  min="0"
                  value={
                    nuevoDomicilio.valor_domicilio
                  }
                  onChange={(e) =>
                    setNuevoDomicilio(
                      (
                        actual
                      ) => ({
                        ...actual,
                        valor_domicilio:
                          e.target
                            .value,
                      })
                    )
                  }
                  placeholder="0"
                  style={
                    estilos.input
                  }
                />

              </label>

              {/* UBICACIÓN */}

              <div
                style={{
                  ...estilos.campoCompleto,
                }}
              >

                <label
                  style={
                    estilos.label
                  }
                >
                  Ubicación del cliente *

                  <button
                    type="button"
                    onClick={
                      buscarUbicacionDomicilio
                    }
                    style={{
                      width:
                        'fit-content',
                      border:
                        'none',
                      borderRadius:
                        '8px',
                      padding:
                        '9px 12px',
                      cursor:
                        'pointer',
                      background:
                        '#0f766e',
                      color:
                        '#fff',
                      fontWeight:
                        700,
                    }}
                  >
                    🔎 Buscar ubicación
                  </button>

                </label>

                <p
                  style={{
                    fontSize:
                      '12px',
                    color:
                      '#64748b',
                    margin:
                      '7px 0',
                  }}
                >
                  También puedes hacer clic directamente en el mapa o mover el marcador para ajustar la ubicación.
                </p>

{resultadosUbicacion.length > 0 && (
  <div
    style={{
      marginBottom: '12px',
      padding: '12px',
      border: '1px solid #cbd5e1',
      borderRadius: '10px',
      background: '#f8fafc',
    }}
  >
    <p style={{ fontWeight: 700, marginTop: 0 }}>
      Selecciona la ubicación que corresponda:
    </p>

    {resultadosUbicacion.map((resultado, indice) => (
      <button
        key={resultado.id}
        type="button"
        onClick={() => {
          setNuevoDomicilio((actual) => ({
            ...actual,
            latitud: resultado.latitud,
            longitud: resultado.longitud,
          }))

          setResultadosUbicacion([])
        }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '10px',
          marginBottom: '8px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          background: '#fff',
          cursor: 'pointer',
          color: '#1e293b',
        }}
      >
        <strong>Opción {indice + 1}</strong>
        <br />
        <span>{resultado.nombre}</span>
      </button>
    ))}
  </div>
)}

                <div
                  style={{
                    height:
                      '330px',
                    width:
                      '100%',
                    borderRadius:
                      '10px',
                    overflow:
                      'hidden',
                    border:
                      '1px solid #cbd5e1',
                  }}
                >

                  <MapContainer
                    center={
                      MAPA_CENTRO
                    }
                    zoom={14}
                    scrollWheelZoom={
                      true
                    }
                    style={{
                      height:
                        '100%',
                      width:
                        '100%',
                    }}
                  >

                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

<CentrarMapa
  posicion={
    nuevoDomicilio.latitud !== '' &&
    nuevoDomicilio.longitud !== ''
      ? [
          Number(nuevoDomicilio.latitud),
          Number(nuevoDomicilio.longitud),
        ]
      : null
  }
/>

                    <SeleccionarUbicacion
                      posicion={
                        nuevoDomicilio.latitud !==
                          '' &&
                        nuevoDomicilio.longitud !==
                          ''
                          ? [
                              Number(
                                nuevoDomicilio.latitud
                              ),
                              Number(
                                nuevoDomicilio.longitud
                              ),
                            ]
                          : null
                      }
                      onSeleccionar={(
                        nuevasCoordenadas
                      ) => {
                        setNuevoDomicilio(
                          (
                            actual
                          ) => ({
                            ...actual,
                            latitud:
                              nuevasCoordenadas[0],
                            longitud:
                              nuevasCoordenadas[1],
                          })
                        )
                      }}
                    />

                  </MapContainer>

                </div>

                {nuevoDomicilio.latitud !==
                  '' &&
                  nuevoDomicilio.longitud !==
                    '' && (
                    <div
                      style={{
                        marginTop:
                          '7px',
                        fontSize:
                          '12px',
                        color:
                          '#334155',
                      }}
                    >
                      📍 Lat:{' '}
                      {
                        nuevoDomicilio.latitud
                      }

                      {' · '}

                      Lon:{' '}
                      {
                        nuevoDomicilio.longitud
                      }
                    </div>
                  )}

              </div>

            </div>

            {/* BOTONES */}

            <div
              style={
                estilos.botonesModal
              }
            >

              <button
                type="button"
                onClick={() =>
                  setMostrarFormulario(
                    false
                  )
                }
                style={{
                  border:
                    '1px solid #cbd5e1',
                  background:
                    '#fff',
                  borderRadius:
                    '9px',
                  padding:
                    '10px 16px',
                  cursor:
                    'pointer',
                  fontWeight:
                    600,
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  crearDomicilio
                }
                style={
                  estilos.botonPrincipal
                }
              >
                Crear domicilio
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}

export default App