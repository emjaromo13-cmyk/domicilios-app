import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'
import './App.css'

import L from 'leaflet'

const socket = io('https://domicilios-app-kfj4.onrender.com')

const crearIconoMoto = (nombre) =>
  L.divIcon({
    className: 'icono-moto',
    html: `
      <div class="moto-contenedor">
        <div class="moto-marker">
          🛵
        </div>

        <div class="nombre-moto">
          ${nombre}
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

function App() {
  const [posicionesDomiciliarios, setPosicionesDomiciliarios] = useState({})
  const [rutasDomiciliarios, setRutasDomiciliarios] = useState({})
  const [posicion, setPosicion] = useState(null)
  const [precision, setPrecision] = useState(null)
  const [error, setError] = useState(null)
  const [conexion, setConexion] = useState('Conectando...')
  const [modo, setModo] = useState('domiciliario')

  const [domicilios, setDomicilios] = useState([])
  const [sedes, setSedes] = useState([])
  const [domiciliarios, setDomiciliarios] = useState([])

  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const [nuevoDomicilio, setNuevoDomicilio] = useState({
    cliente: '',
    telefono: '',
    direccion: '',
    sede_id: '',
    domiciliario_id: '',
  })

  const [domiciliarioId, setDomiciliarioId] = useState(() => {
    const guardado = localStorage.getItem('domiciliario_id')
    return guardado ? Number(guardado) : 1
  })

  const [domicilioActivo, setDomicilioActivo] = useState(null)
  const [turnoActivo, setTurnoActivo] = useState(false)
  const [cargandoTurno, setCargandoTurno] = useState(false)

  const domiciliarioNombre = `Domiciliario ${domiciliarioId}`

  // Eliminar domicilio
  const eliminarDomicilio = async (id) => {
    const confirmar = window.confirm(
      `¿Seguro que quieres eliminar el domicilio #${id}?`
    )

    if (!confirmar) {
      return
    }

    try {
      const respuesta = await fetch(
        `https://domicilios-app-kfj4.onrender.com/api/domicilios/${id}`,
        {
          method: 'DELETE',
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje || 'No se pudo eliminar el domicilio'
        )
      }

      setDomicilios((actuales) =>
        actuales.filter((domicilio) => domicilio.id !== id)
      )

      if (domicilioActivo === id) {
        setDomicilioActivo(null)
      }
    } catch (error) {
      console.error('Error eliminando domicilio:', error)

      alert(
        error.message || 'No se pudo eliminar el domicilio'
      )
    }
  }

  // Consultar turno activo
  useEffect(() => {
    const consultarTurno = async () => {
      try {
        const respuesta = await fetch(
          `https://domicilios-app-kfj4.onrender.com/api/turnos/activo/${domiciliarioId}`
        )

        const datos = await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            datos.mensaje || 'No se pudo consultar el turno'
          )
        }

        setTurnoActivo(datos.turnoActivo)
      } catch (error) {
        console.error('Error consultando turno:', error)
      }
    }

    consultarTurno()
  }, [domiciliarioId])

  // Iniciar turno
  const iniciarTurno = async () => {
    try {
      setCargandoTurno(true)

      const respuesta = await fetch(
        'https://domicilios-app-kfj4.onrender.com/api/turnos/iniciar',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            domiciliario_id: domiciliarioId,
          }),
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje || 'No se pudo iniciar el turno'
        )
      }

      setTurnoActivo(true)
      setError(null)

      alert('Turno iniciado correctamente.')
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setCargandoTurno(false)
    }
  }

  // Finalizar turno
  const finalizarTurno = async () => {
    try {
      setCargandoTurno(true)

      const respuesta = await fetch(
        'https://domicilios-app-kfj4.onrender.com/api/turnos/finalizar',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            domiciliario_id: domiciliarioId,
          }),
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje || 'No se pudo finalizar el turno'
        )
      }

      setTurnoActivo(false)
      setDomicilioActivo(null)

      alert('Turno finalizado correctamente.')
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setCargandoTurno(false)
    }
  }

  // Cargar domicilios desde el backend
  useEffect(() => {
    fetch('https://domicilios-app-kfj4.onrender.com/api/domicilios')
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        console.log(
          'Domicilios recibidos del backend:',
          datos
        )
        setDomicilios(datos)
      })
      .catch((error) => {
        console.error(
          'Error cargando domicilios:',
          error
        )
      })
  }, [])

  // Cargar sedes desde el backend
  useEffect(() => {
    const cargarSedes = async () => {
      try {
        const respuesta = await fetch(
          'https://domicilios-app-kfj4.onrender.com/api/sedes'
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

        setSedes(datos)
      } catch (error) {
        console.error(
          'Error cargando sedes:',
          error
        )
      }
    }

    cargarSedes()
  }, [])

  // Cargar domiciliarios desde el backend
  useEffect(() => {
    const cargarDomiciliarios = async () => {
      try {
        const respuesta = await fetch(
          'https://domicilios-app-kfj4.onrender.com/api/domiciliarios'
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

        setDomiciliarios(datos)
      } catch (error) {
        console.error(
          'Error cargando domiciliarios:',
          error
        )
      }
    }

    cargarDomiciliarios()
  }, [])

  // Conexión con el backend
  useEffect(() => {
    socket.on('connect', () => {
      console.log(
        'Conectado al backend:',
        socket.id
      )

      setConexion('Conectado al servidor')
    })

    socket.on('disconnect', () => {
      console.log(
        'Desconectado del backend'
      )

      setConexion('Desconectado del servidor')
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  // Recibir ubicación enviada por el backend
  useEffect(() => {
    socket.on(
      'ubicacion_actualizada',
      (ubicacion) => {
        console.log(
          'Ubicación recibida desde el servidor:',
          ubicacion
        )

        const nuevaPosicion = [
          ubicacion.latitud,
          ubicacion.longitud,
        ]

        setPosicion(nuevaPosicion)

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
              [
                ubicacion.latitud,
                ubicacion.longitud,
              ],
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
            ubicacion.precision
          )
        }

        setError(null)
      }
    )

    return () => {
      socket.off(
        'ubicacion_actualizada'
      )
    }
  }, [])

  // Obtener GPS solamente si estamos en modo domiciliario
  // Y tenemos un turno activo
  useEffect(() => {
    if (
      modo !== 'domiciliario' ||
      !turnoActivo
    ) {
      return
    }

    if (!navigator.geolocation) {
      setError(
        'Este navegador no permite obtener la ubicación GPS.'
      )
      return
    }

    const watchId =
      navigator.geolocation.watchPosition(
        (ubicacion) => {
          const nuevaPosicion = [
            ubicacion.coords.latitude,
            ubicacion.coords.longitude,
          ]

          console.log(
            'GPS DEL CELULAR:',
            {
              latitud:
                ubicacion.coords.latitude,
              longitud:
                ubicacion.coords.longitude,
              precision:
                ubicacion.coords.accuracy,
              velocidad:
                ubicacion.coords.speed,
              altitud:
                ubicacion.coords.altitude,
              timestamp:
                ubicacion.timestamp,
            }
          )

          setPosicion(nuevaPosicion)

          setPrecision(
            ubicacion.coords.accuracy
          )

          setError(null)

          socket.emit(
            'ubicacion_domiciliario',
            {
              domicilio_id:
                domicilioActivo,
              domiciliario_id:
                domiciliarioId,
              nombre:
                domiciliarioNombre,
              latitud:
                ubicacion.coords.latitude,
              longitud:
                ubicacion.coords.longitude,
              precision:
                ubicacion.coords.accuracy,
              velocidad:
                ubicacion.coords.speed,
              fecha_hora:
                new Date().toISOString(),
            }
          )
        },
        (error) => {
          setError(
            `No se pudo obtener la ubicación: ${error.message}`
          )
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        }
      )

    return () => {
      navigator.geolocation.clearWatch(
        watchId
      )
    }
  }, [
    modo,
    turnoActivo,
    domiciliarioId,
    domiciliarioNombre,
    domicilioActivo,
  ])

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>
            Seguimiento de Domicilios
          </h1>

          <p>
            Ubicación de domiciliarios en tiempo real
          </p>
        </div>

        <div>
          <strong>
            {conexion}
          </strong>
        </div>
      </header>

      <main className="contenido">

        {/* ========================= */}
        {/* MODO SEDE */}
        {/* ========================= */}

        {modo === 'sede' && (
          <section className="panel">
            <div className="cabecera-domicilios">
              <h2>
                Gestión de domicilios
              </h2>

              <button
                onClick={() =>
                  setMostrarFormulario(
                    !mostrarFormulario
                  )
                }
                className="boton-nuevo"
              >
                {mostrarFormulario
                  ? 'Cerrar'
                  : '+ Nuevo domicilio'}
              </button>
            </div>

            {mostrarFormulario && (
              <div className="formulario-domicilio">

                {/* CLIENTE */}
                <label>
                  Cliente

                  <input
                    type="text"
                    value={
                      nuevoDomicilio.cliente
                    }
                    onChange={(e) =>
                      setNuevoDomicilio({
                        ...nuevoDomicilio,
                        cliente:
                          e.target.value,
                      })
                    }
                    placeholder="Nombre del cliente"
                  />
                </label>

                {/* TELEFONO */}
                <label>
                  Teléfono

                  <input
                    type="text"
                    value={
                      nuevoDomicilio.telefono
                    }
                    onChange={(e) =>
                      setNuevoDomicilio({
                        ...nuevoDomicilio,
                        telefono:
                          e.target.value,
                      })
                    }
                    placeholder="Número de teléfono"
                  />
                </label>

                {/* DIRECCION */}
                <label>
                  Dirección

                  <input
                    type="text"
                    value={
                      nuevoDomicilio.direccion
                    }
                    onChange={(e) =>
                      setNuevoDomicilio({
                        ...nuevoDomicilio,
                        direccion:
                          e.target.value,
                      })
                    }
                    placeholder="Dirección de entrega"
                  />
                </label>

                {/* SEDE DE ORIGEN */}
                <label>
                  Sede de origen

                  <select
                    value={
                      nuevoDomicilio.sede_id
                    }
                    onChange={(e) => {
                      const nuevaSedeId =
                        Number(e.target.value)

                      const sedeSeleccionada =
                        sedes.find(
                          (sede) =>
                            sede.id ===
                            nuevaSedeId
                        )

                      const domiciliarioDeLaZona =
                        domiciliarios.find(
                          (domiciliario) =>
                            domiciliario.zona_id ===
                            sedeSeleccionada?.zona_id
                        )

                      setNuevoDomicilio({
                        ...nuevoDomicilio,
                        sede_id:
                          nuevaSedeId,
                        domiciliario_id:
                          domiciliarioDeLaZona?.id ||
                          '',
                      })
                    }}
                  >
                    <option value="">
                      Seleccionar sede de origen
                    </option>

                    {sedes.map((sede) => (
                      <option
                        key={sede.id}
                        value={sede.id}
                      >
                        {sede.nombre} -{' '}
                        {sede.zona_nombre}
                      </option>
                    ))}
                  </select>
                </label>

                {/* DOMICILIARIO */}
                <label>
                  Domiciliario

                  <select
                    value={
                      nuevoDomicilio.domiciliario_id
                    }
                    onChange={(e) =>
                      setNuevoDomicilio({
                        ...nuevoDomicilio,
                        domiciliario_id:
                          Number(
                            e.target.value
                          ),
                      })
                    }
                    disabled={
                      !nuevoDomicilio.sede_id
                    }
                  >
                    <option value="">
                      {!nuevoDomicilio.sede_id
                        ? 'Primero selecciona una sede'
                        : 'Seleccionar domiciliario'}
                    </option>

                    {domiciliarios
                      .filter((domiciliario) => {
                        const sedeSeleccionada =
                          sedes.find(
                            (sede) =>
                              sede.id ===
                              Number(
                                nuevoDomicilio.sede_id
                              )
                          )

                        return (
                          sedeSeleccionada &&
                          domiciliario.zona_id ===
                            sedeSeleccionada.zona_id
                        )
                      })
                      .map((domiciliario) => (
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
                      ))}
                  </select>
                </label>

                {/* CREAR DOMICILIO */}
                <button
                  className="boton-crear"
                  onClick={async () => {

                    if (
                      !nuevoDomicilio.cliente ||
                      !nuevoDomicilio.telefono ||
                      !nuevoDomicilio.direccion ||
                      !nuevoDomicilio.sede_id ||
                      !nuevoDomicilio.domiciliario_id
                    ) {
                      alert(
                        'Completa todos los campos.'
                      )

                      return
                    }

                    try {
                      const respuesta =
                        await fetch(
                          'https://domicilios-app-kfj4.onrender.com/api/domicilios',
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type':
                                'application/json',
                            },
                            body: JSON.stringify(
                              nuevoDomicilio
                            ),
                          }
                        )

                      if (!respuesta.ok) {
                        throw new Error(
                          'No se pudo crear el domicilio'
                        )
                      }

                      const domicilioCreado =
                        await respuesta.json()

                      console.log(
                        'Domicilio creado en backend:',
                        domicilioCreado
                      )

                      setDomicilios(
                        (actuales) => [
                          ...actuales,
                          domicilioCreado,
                        ]
                      )

                      setNuevoDomicilio({
                        cliente: '',
                        telefono: '',
                        direccion: '',
                        sede_id: '',
                        domiciliario_id: '',
                      })

                      setMostrarFormulario(
                        false
                      )

                      alert(
                        'Domicilio creado correctamente.'
                      )
                    } catch (error) {
                      console.error(
                        error
                      )

                      alert(
                        'No se pudo crear el domicilio.'
                      )
                    }
                  }}
                >
                  Crear domicilio
                </button>
              </div>
            )}
          </section>
        )}

        {/* ========================= */}
        {/* LISTA DE DOMICILIOS */}
        {/* ========================= */}

        {modo === 'sede' &&
          domicilios.length > 0 && (
            <section className="panel">
              <h2>
                Domicilios registrados
              </h2>

              <div className="lista-domicilios">

                {domicilios.map(
                  (domicilio) => (
                    <div
                      className="domicilio-card"
                      key={domicilio.id}
                    >
                      <div>
                        <strong>
                          Domicilio #
                          {domicilio.id}
                        </strong>

                        <p>
                          <strong>
                            Cliente:
                          </strong>{' '}
                          {domicilio.cliente}
                        </p>

                        <p>
                          <strong>
                            Teléfono:
                          </strong>{' '}
                          {domicilio.telefono}
                        </p>

                        <p>
                          <strong>
                            Dirección:
                          </strong>{' '}
                          {domicilio.direccion}
                        </p>

                        <p>
                          <strong>
                            Sede de origen:
                          </strong>{' '}
                          {
                            sedes.find(
                              (sede) =>
                                sede.id === Number(domicilio.sede_id)
                            )?.nombre || 'Sin sede'
                          }
                        </p>
                      </div>

                      <div className="domicilio-info">

                        <p>
                          <strong>
                            Domiciliario:
                          </strong>{' '}
                          Domiciliario{' '}
                          {
                            domicilio.domiciliario_id
                          }
                        </p>

                        <select
                          value={
                            domicilio.estado
                          }
                          onChange={async (e) => {
                            const nuevoEstado = e.target.value

                            try {
                              const respuesta = await fetch(
                                `https://domicilios-app-kfj4.onrender.com/api/domicilios/${domicilio.id}/estado`,
                                {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    estado: nuevoEstado,
                                  }),
                                }
                              )

                              if (!respuesta.ok) {
                                throw new Error(
                                  'No se pudo actualizar el estado'
                                )
                              }

                              const domicilioActualizado =
                                await respuesta.json()

                              setDomicilios(
                                (actuales) =>
                                  actuales.map(
                                    (item) =>
                                      item.id === domicilio.id
                                        ? {
                                            ...item,
                                            ...domicilioActualizado,
                                          }
                                        : item
                                  )
                              )
                            } catch (error) {
                              console.error(
                                'Error actualizando estado:',
                                error
                              )

                              alert(
                                'No se pudo actualizar el estado del domicilio.'
                              )
                            }
                          }}
                          className="selector-estado"
                        >
                          <option value="PENDIENTE">
                            PENDIENTE
                          </option>

                          <option value="ASIGNADO">
                            ASIGNADO
                          </option>

                          <option value="EN CAMINO">
                            EN CAMINO
                          </option>

                          <option value="ENTREGADO">
                            ENTREGADO
                          </option>

                          <option value="CANCELADO">
                            CANCELADO
                          </option>
                        </select>

                        <button
                          type="button"
                          className="boton-eliminar"
                          onClick={() => eliminarDomicilio(domicilio.id)}
                        >
                           Eliminar
                        </button>
                      </div>
                    </div>
                  )
                )}

              </div>
            </section>
          )}

        {/* ========================= */}
        {/* CONTROLES */}
        {/* ========================= */}

        <section className="panel">
          <div className="controles">

            {modo === 'domiciliario' && (
              <>

                {/* ESTADO DEL TURNO */}
                <div className="control-turno">
                  <strong>
                    Estado del turno:{' '}

                    <span
                      style={{
                        color:
                          turnoActivo
                            ? 'green'
                            : 'red',
                      }}
                    >
                      {turnoActivo
                        ? 'EN TURNO'
                        : 'FUERA DE TURNO'}
                    </span>
                  </strong>

                  {!turnoActivo ? (
                    <button
                      onClick={
                        iniciarTurno
                      }
                      disabled={
                        cargandoTurno
                      }
                    >
                      {cargandoTurno
                        ? 'Iniciando...'
                        : 'INICIAR TURNO'}
                    </button>
                  ) : (
                    <button
                      onClick={
                        finalizarTurno
                      }
                      disabled={
                        cargandoTurno
                      }
                    >
                      {cargandoTurno
                        ? 'Finalizando...'
                        : 'FINALIZAR TURNO'}
                    </button>
                  )}
                </div>

                {/* DOMICILIARIO */}
                <label>
                  Domiciliario:{' '}

                  <select
                    value={
                      domiciliarioId
                    }
                    onChange={(e) => {
                      const nuevoId =
                        Number(
                          e.target.value
                        )

                      setDomiciliarioId(
                        nuevoId
                      )

                      localStorage.setItem(
                        'domiciliario_id',
                        nuevoId
                      )
                    }}
                  >
                    <option value={1}>
                      Domiciliario 1
                    </option>

                    <option value={2}>
                      Domiciliario 2
                    </option>

                    <option value={3}>
                      Domiciliario 3
                    </option>

                    <option value={4}>
                      Domiciliario 4
                    </option>
                  </select>
                </label>

                {/* DOMICILIO ACTIVO */}
                {domicilios.length > 0 && (
                  <label>
                    Domicilio activo:{' '}

                    <select
                      value={
                        domicilioActivo || ''
                      }
                      onChange={(e) => {
                        const valor =
                          e.target.value

                        const idDomicilio =
                          valor
                            ? Number(valor)
                            : null

                        setDomicilioActivo(
                          idDomicilio
                        )

                        if (
                          idDomicilio !== null
                        ) {
                          setDomicilios(
                            (actuales) =>
                              actuales.map(
                                (domicilio) =>
                                  domicilio.id ===
                                  idDomicilio
                                    ? {
                                        ...domicilio,
                                        estado:
                                          'EN CAMINO',
                                      }
                                    : domicilio
                              )
                          )
                        }
                      }}
                    >
                      <option value="">
                        Seleccionar domicilio
                      </option>

                      {domicilios
                        .filter(
                          (domicilio) =>
                            domicilio.domiciliario_id ===
                              domiciliarioId &&
                            domicilio.estado !==
                              'ENTREGADO' &&
                            domicilio.estado !==
                              'CANCELADO'
                        )
                        .map(
                          (domicilio) => (
                            <option
                              key={
                                domicilio.id
                              }
                              value={
                                domicilio.id
                              }
                            >
                              #
                              {
                                domicilio.id
                              }{' '}
                              -{' '}
                              {
                                domicilio.cliente
                              }
                            </option>
                          )
                        )}
                    </select>
                  </label>
                )}
              </>
            )}

            {/* CAMBIAR MODO */}
            <button
              onClick={() =>
                setModo(
                  'domiciliario'
                )
              }
              className={
                modo ===
                'domiciliario'
                  ? 'activo'
                  : ''
              }
            >
              Modo Domiciliario
            </button>

            <button
              onClick={() =>
                setModo('sede')
              }
              className={
                modo === 'sede'
                  ? 'activo'
                  : ''
              }
            >
              Modo Sede
            </button>

          </div>

          <h2>
            Mapa de seguimiento
          </h2>

          <p className="estado">
            {modo ===
            'domiciliario'
              ? 'El dispositivo está enviando su ubicación GPS.'
              : 'Esta pantalla está recibiendo la ubicación del domiciliario.'}
          </p>

          {precision !== null && (
            <p className="estado">
              📍 Precisión GPS:{' '}
              <strong>
                {Math.round(
                  precision
                )}{' '}
                metros
              </strong>
            </p>
          )}

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          {/* ========================= */}
          {/* DOMICILIARIOS EN SEGUIMIENTO */}
          {/* ========================= */}

          {modo === 'sede' && (
            <div className="panel-domiciliarios">

              <h3>
                Domiciliarios en seguimiento
              </h3>

              {Object.values(
                posicionesDomiciliarios
              ).length === 0 ? (
                <p>
                  No hay domiciliarios
                  enviando ubicación.
                </p>
              ) : (
                Object.values(
                  posicionesDomiciliarios
                ).map(
                  (domiciliario) => (
                    <div
                      className="domiciliario-card"
                      key={
                        domiciliario.domiciliario_id
                      }
                    >
                      <div>
                        <strong>
                          {
                            domiciliario.nombre
                          }
                        </strong>

                        <p>
                          ID:{' '}
                          {
                            domiciliario.domiciliario_id
                          }
                        </p>
                      </div>

                      <div>
                        <span
                          className={
                            Date.now() -
                              new Date(
                                domiciliario.fecha_hora
                              ).getTime() <
                            15000
                              ? 'estado-online'
                              : 'estado-offline'
                          }
                        >
                          {Date.now() -
                            new Date(
                              domiciliario.fecha_hora
                            ).getTime() <
                          15000
                            ? '● En línea'
                            : '● Sin conexión'}
                        </span>

                        <p>
                          Precisión:{' '}
                          {domiciliario.precision !=
                          null
                            ? `${Math.round(
                                domiciliario.precision
                              )} m`
                            : 'No disponible'}
                        </p>
                      </div>
                    </div>
                  )
                )
              )}

            </div>
          )}

          {/* ========================= */}
          {/* MAPA */}
          {/* ========================= */}

          <div className="mapa">

            <MapContainer
              center={[
                2.9273,
                -75.2819,
              ]}
              zoom={14}
              scrollWheelZoom={true}
              style={{
                height: '100%',
                width: '100%',
              }}
            >

              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {Object.entries(
                rutasDomiciliarios
              ).map(
                ([domiciliarioId, ruta]) => {
                  const colores = [
                    '#2563eb',
                    '#16a34a',
                    '#f59e0b',
                    '#dc2626',
                  ]

                  const color =
                    colores[
                      (Number(domiciliarioId) - 1) %
                        colores.length
                    ]

                  return (
                    <Polyline
                      key={`ruta-${domiciliarioId}`}
                      positions={ruta}
                      pathOptions={{
                        color,
                        weight: 5,
                        opacity: 0.75,
                      }}
                    />
                  )
                }
              )}

              {Object.values(
                posicionesDomiciliarios
              ).map(
                (domiciliario) => (
                  <Marker
                    key={
                      domiciliario.domiciliario_id
                    }
                    position={[
                      domiciliario.latitud,
                      domiciliario.longitud,
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

                      Ubicación GPS

                      <br />

                      Precisión:{' '}
                      {Math.round(
                        domiciliario.precision ||
                          0
                      )}{' '}
                      metros

                    </Popup>
                  </Marker>
                )
              )}

              {/* ========================= */}
              {/* PEDIDOS EN EL MAPA */}
              {/* ========================= */}

              {domicilios
                .filter(
                  (domicilio) =>
                    domicilio.latitud != null &&
                    domicilio.longitud != null &&
                    domicilio.estado !== 'ENTREGADO' &&
                    domicilio.estado !== 'CANCELADO'
                )
                .map((domicilio) => (
                  <Marker
                    key={`domicilio-${domicilio.id}`}
                    position={[
                      Number(domicilio.latitud),
                      Number(domicilio.longitud),
                    ]}
                    icon={crearIconoPedido()}
                  >
                    <Popup>
                      <strong>
                        Domicilio #{domicilio.id}
                      </strong>

                      <br />

                      Cliente:{' '}
                      {domicilio.cliente}

                      <br />

                      Teléfono:{' '}
                      {domicilio.telefono}

                      <br />

                      Dirección:{' '}
                      {domicilio.direccion}

                      <br />

                      Barrio:{' '}
                      {domicilio.barrio || 'No disponible'}

                      <br />

                      Sede:{' '}
                      {domicilio.sede}

                      <br />

                      Estado:{' '}
                      {domicilio.estado}

                      <br />

                      Domiciliario:{' '}
                      {domicilio.domiciliario || 'Sin asignar'}
                    </Popup>
                  </Marker>
                ))}

            </MapContainer>

          </div>

        </section>

      </main>
    </div>
  )
}

export default App