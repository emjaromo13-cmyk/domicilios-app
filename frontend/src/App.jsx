import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'
import './App.css'

const socket = io('https://reid-searches-policies-diary.trycloudflare.com')

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
  const [posicion, setPosicion] = useState(null)
  const [precision, setPrecision] = useState(null)
  const [error, setError] = useState(null)
  const [conexion, setConexion] = useState('Conectando...')
  const [modo, setModo] = useState('domiciliario')
  const [domicilios, setDomicilios] = useState([])
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nuevoDomicilio, setNuevoDomicilio] = useState({
    cliente: '',
    telefono: '',
    direccion: '',
    domiciliario_id: 1,
  })
  const [domiciliarioId, setDomiciliarioId] = useState(() => {
    const guardado = localStorage.getItem('domiciliario_id')
    return guardado ? Number(guardado) : 1
  })
  const [domicilioActivo, setDomicilioActivo] = useState(null)
  const [turnoActivo, setTurnoActivo] = useState(false)
  const [cargandoTurno, setCargandoTurno] = useState(false)

  const domiciliarioNombre = `Domiciliario ${domiciliarioId}`

  useEffect(() => {
    const consultarTurno = async () => {
      try {
        const respuesta = await fetch(
          `https://warrior-regular-consent-ben.trycloudflare.com/api/turnos/activo/${domiciliarioId}`
        )

        const datos = await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No se pudo consultar el turno')
        }

        setTurnoActivo(datos.turnoActivo)
      } catch (error) {
        console.error('Error consultando turno:', error)
      }
    }

    consultarTurno()
  }, [domiciliarioId])

  const iniciarTurno = async () => {
    try {
      setCargandoTurno(true)

      const respuesta = await fetch(
        'https://reid-searches-policies-diary.trycloudflare.com/api/turnos/iniciar',
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
        throw new Error(datos.mensaje || 'No se pudo iniciar el turno')
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

  const finalizarTurno = async () => {
    try {
      setCargandoTurno(true)

      const respuesta = await fetch(
        'https://reid-searches-policies-diary.trycloudflare.com/api/turnos/finalizar',
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
        throw new Error(datos.mensaje || 'No se pudo finalizar el turno')
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
    fetch('https://reid-searches-policies-diary.trycloudflare.com/api/domicilios')
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        console.log('Domicilios recibidos del backend:', datos)
        setDomicilios(datos)
      })
      .catch((error) => {
        console.error('Error cargando domicilios:', error)
      })
  }, [])

  // Conexión con el backend
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Conectado al backend:', socket.id)
      setConexion('Conectado al servidor')
    })

    socket.on('disconnect', () => {
      console.log('Desconectado del backend')
      setConexion('Desconectado del servidor')
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  // Recibir ubicación enviada por el backend
  useEffect(() => {
    socket.on('ubicacion_actualizada', (ubicacion) => {
      console.log(
        'Ubicación recibida desde el servidor:',
        ubicacion
      )

      const nuevaPosicion = [
        ubicacion.latitud,
        ubicacion.longitud,
      ]

      setPosicion(nuevaPosicion)

      setPosicionesDomiciliarios((actuales) => ({
        ...actuales,
        [ubicacion.domiciliario_id]: ubicacion,
      }))

      if (
        ubicacion.precision !== null &&
        ubicacion.precision !== undefined
      ) {
        setPrecision(ubicacion.precision)
      }

      setError(null)
    })

    return () => {
      socket.off('ubicacion_actualizada')
    }
  }, [])

  // Obtener GPS solamente si estamos en modo domiciliario Y con turno activo
  useEffect(() => {
    if (modo !== 'domiciliario' || !turnoActivo) {
      return
    }

    if (!navigator.geolocation) {
      setError(
        'Este navegador no permite obtener la ubicación GPS.'
      )
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (ubicacion) => {
        const nuevaPosicion = [
          ubicacion.coords.latitude,
          ubicacion.coords.longitude,
        ]

        console.log('GPS DEL CELULAR:', {
          latitud: ubicacion.coords.latitude,
          longitud: ubicacion.coords.longitude,
          precision: ubicacion.coords.accuracy,
          velocidad: ubicacion.coords.speed,
          altitud: ubicacion.coords.altitude,
          timestamp: ubicacion.timestamp,
        })

        setPosicion(nuevaPosicion)
        setPrecision(ubicacion.coords.accuracy)
        setError(null)

        socket.emit('ubicacion_domiciliario', {
          domicilio_id: domicilioActivo,
          domiciliario_id: domiciliarioId,
          nombre: domiciliarioNombre,
          latitud: ubicacion.coords.latitude,
          longitud: ubicacion.coords.longitude,
          precision: ubicacion.coords.accuracy,
          velocidad: ubicacion.coords.speed,
          fecha_hora: new Date().toISOString(),
        })
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
      navigator.geolocation.clearWatch(watchId)
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
          <h1>Seguimiento de Domicilios</h1>
          <p>Ubicación de domiciliarios en tiempo real</p>
        </div>

        <div>
          <strong>{conexion}</strong>
        </div>
      </header>

      <main className="contenido">
        {modo === 'sede' && (
          <section className="panel">
            <div className="cabecera-domicilios">
              <h2>Gestión de domicilios</h2>

              <button
                onClick={() => setMostrarFormulario(!mostrarFormulario)}
                className="boton-nuevo"
              >
                {mostrarFormulario ? 'Cerrar' : '+ Nuevo domicilio'}
              </button>
            </div>

            {mostrarFormulario && (
              <div className="formulario-domicilio">
                <label>
                  Cliente
                  <input
                    type="text"
                    value={nuevoDomicilio.cliente}
                    onChange={(e) =>
                      setNuevoDomicilio({
                        ...nuevoDomicilio,
                        cliente: e.target.value,
                      })
                    }
                    placeholder="Nombre del cliente"
                  />
                </label>

                <label>
                  Teléfono
                  <input
                    type="text"
                    value={nuevoDomicilio.telefono}
                    onChange={(e) =>
                      setNuevoDomicilio({
                        ...nuevoDomicilio,
                        telefono: e.target.value,
                      })
                    }
                    placeholder="Número de teléfono"
                  />
                </label>

                <label>
                  Dirección
                  <input
                    type="text"
                    value={nuevoDomicilio.direccion}
                    onChange={(e) =>
                      setNuevoDomicilio({
                        ...nuevoDomicilio,
                        direccion: e.target.value,
                      })
                    }
                    placeholder="Dirección de entrega"
                  />
                </label>

                <label>
                  Domiciliario
                  <select
                    value={nuevoDomicilio.domiciliario_id}
                    onChange={(e) =>
                      setNuevoDomicilio({
                        ...nuevoDomicilio,
                        domiciliario_id: Number(e.target.value),
                      })
                    }
                  >
                    <option value={1}>Domiciliario 1</option>
                    <option value={2}>Domiciliario 2</option>
                    <option value={3}>Domiciliario 3</option>
                  </select>
                </label>

                <button
                  className="boton-crear"
                  onClick={async () => {
                    if (
                      !nuevoDomicilio.cliente ||
                      !nuevoDomicilio.telefono ||
                      !nuevoDomicilio.direccion
                    ) {
                      alert('Completa todos los campos.')
                      return
                    }

                    try {
                      const respuesta = await fetch(
                        'https://reid-searches-policies-diary.trycloudflare.com/api/domicilios',
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify(nuevoDomicilio),
                        }
                      )

                      if (!respuesta.ok) {
                        throw new Error('No se pudo crear el domicilio')
                      }

                      const domicilioCreado = await respuesta.json()

                      console.log(
                        'Domicilio creado en backend:',
                        domicilioCreado
                      )

                      setDomicilios((actuales) => [
                        ...actuales,
                        domicilioCreado,
                      ])

                      setNuevoDomicilio({
                        cliente: '',
                        telefono: '',
                        direccion: '',
                        domiciliario_id: 1,
                      })

                      setMostrarFormulario(false)

                      alert('Domicilio creado correctamente.')
                    } catch (error) {
                      console.error(error)
                      alert('No se pudo crear el domicilio.')
                    }
                  }}
                >
                  Crear domicilio
                </button>
              </div>
            )}
          </section>
        )}

        {modo === 'sede' && domicilios.length > 0 && (
          <section className="panel">
            <h2>Domicilios registrados</h2>

            <div className="lista-domicilios">
              {domicilios.map((domicilio) => (
                <div
                  className="domicilio-card"
                  key={domicilio.id}
                >
                  <div>
                    <strong>
                      Domicilio #{domicilio.id}
                    </strong>

                    <p>
                      <strong>Cliente:</strong>{' '}
                      {domicilio.cliente}
                    </p>

                    <p>
                      <strong>Teléfono:</strong>{' '}
                      {domicilio.telefono}
                    </p>

                    <p>
                      <strong>Dirección:</strong>{' '}
                      {domicilio.direccion}
                    </p>
                  </div>

                  <div className="domicilio-info">
                    <p>
                      <strong>Domiciliario:</strong>{' '}
                      Domiciliario {domicilio.domiciliario_id}
                    </p>

                    <select
                      value={domicilio.estado}
                      onChange={(e) => {
                        const nuevoEstado = e.target.value

                        setDomicilios((actuales) =>
                          actuales.map((item) =>
                            item.id === domicilio.id
                              ? {
                                  ...item,
                                  estado: nuevoEstado,
                                }
                              : item
                          )
                        )
                      }}
                      className="selector-estado"
                    >
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="ASIGNADO">ASIGNADO</option>
                      <option value="EN CAMINO">EN CAMINO</option>
                      <option value="ENTREGADO">ENTREGADO</option>
                      <option value="CANCELADO">CANCELADO</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="panel">
          <div className="controles">
            {modo === 'domiciliario' && (
              <>
                <div className="control-turno">
                  <strong>
                    Estado del turno:{' '}
                    <span
                      style={{
                        color: turnoActivo ? 'green' : 'red',
                      }}
                    >
                      {turnoActivo ? 'EN TURNO' : 'FUERA DE TURNO'}
                    </span>
                  </strong>

                  {!turnoActivo ? (
                    <button
                      onClick={iniciarTurno}
                      disabled={cargandoTurno}
                    >
                      {cargandoTurno ? 'Iniciando...' : 'INICIAR TURNO'}
                    </button>
                  ) : (
                    <button
                      onClick={finalizarTurno}
                      disabled={cargandoTurno}
                    >
                      {cargandoTurno ? 'Finalizando...' : 'FINALIZAR TURNO'}
                    </button>
                  )}
                </div>

                <label>
                  Domiciliario:{' '}
                  <select
                    value={domiciliarioId}
                    onChange={(e) => {
                      const nuevoId = Number(e.target.value)
                      setDomiciliarioId(nuevoId)
                      localStorage.setItem('domiciliario_id', nuevoId)
                    }}
                  >
                    <option value={1}>Domiciliario 1</option>
                    <option value={2}>Domiciliario 2</option>
                    <option value={3}>Domiciliario 3</option>
                  </select>
                </label>

                {domicilios.length > 0 && (
                  <label>
                    Domicilio activo:{' '}
                    <select
                      value={domicilioActivo || ''}
                      onChange={(e) => {
                        const valor = e.target.value
                        const idDomicilio = valor ? Number(valor) : null

                        setDomicilioActivo(idDomicilio)

                        if (idDomicilio !== null) {
                          setDomicilios((actuales) =>
                            actuales.map((domicilio) =>
                              domicilio.id === idDomicilio
                                ? {
                                    ...domicilio,
                                    estado: 'EN CAMINO',
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
                            domicilio.domiciliario_id === domiciliarioId &&
                            domicilio.estado !== 'ENTREGADO' &&
                            domicilio.estado !== 'CANCELADO'
                        )
                        .map((domicilio) => (
                          <option
                            key={domicilio.id}
                            value={domicilio.id}
                          >
                            #{domicilio.id} - {domicilio.cliente}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            )}

            <button
              onClick={() => setModo('domiciliario')}
              className={
                modo === 'domiciliario' ? 'activo' : ''
              }
            >
              Modo Domiciliario
            </button>

            <button
              onClick={() => setModo('sede')}
              className={
                modo === 'sede' ? 'activo' : ''
              }
            >
              Modo Sede
            </button>
          </div>

          <h2>Mapa de seguimiento</h2>

          <p className="estado">
            {modo === 'domiciliario'
              ? 'El dispositivo está enviando su ubicación GPS.'
              : 'Esta pantalla está recibiendo la ubicación del domiciliario.'}
          </p>

          {precision !== null && (
            <p className="estado">
              📍 Precisión GPS:{' '}
              <strong>{Math.round(precision)} metros</strong>
            </p>
          )}

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          {modo === 'sede' && (
            <div className="panel-domiciliarios">
              <h3>Domiciliarios en seguimiento</h3>

              {Object.values(posicionesDomiciliarios).length === 0 ? (
                <p>No hay domiciliarios enviando ubicación.</p>
              ) : (
                Object.values(posicionesDomiciliarios).map((domiciliario) => (
                  <div
                    className="domiciliario-card"
                    key={domiciliario.domiciliario_id}
                  >
                    <div>
                      <strong>{domiciliario.nombre}</strong>
                      <p>
                        ID: {domiciliario.domiciliario_id}
                      </p>
                    </div>

                    <div>
                      <span
                        className={
                          Date.now() - new Date(domiciliario.fecha_hora).getTime() < 15000
                            ? 'estado-online'
                            : 'estado-offline'
                        }
                      >
                        {Date.now() - new Date(domiciliario.fecha_hora).getTime() < 15000
                          ? '● En línea'
                          : '● Sin conexión'}
                      </span>

                      <p>
                        Precisión:{' '}
                        {domiciliario.precision != null
                          ? `${Math.round(domiciliario.precision)} m`
                          : 'No disponible'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mapa">
            <MapContainer
              center={[2.9273, -75.2819]}
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

              {Object.values(posicionesDomiciliarios).map((domiciliario) => (
                <Marker
                  key={domiciliario.domiciliario_id}
                  position={[
                    domiciliario.latitud,
                    domiciliario.longitud,
                  ]}
                >
                  <Popup>
                    <strong>{domiciliario.nombre}</strong>
                    <br />
                    ID: {domiciliario.domiciliario_id}
                    <br />
                    Ubicación GPS
                    <br />
                    Precisión:{' '}
                    {Math.round(domiciliario.precision || 0)} metros
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