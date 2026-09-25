const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const pool = require('./db')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*',
  },
})

app.use(cors())
app.use(express.json())

// ==========================================
// GEOCODIFICAR DIRECCIÓN
// ==========================================

async function obtenerCoordenadas(direccion) {
  const direccionCompleta =
    `${direccion}, Neiva, Huila, Colombia`

  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=co&q=${encodeURIComponent(direccionCompleta)}`

  const respuesta = await fetch(url, {
    headers: {
      'User-Agent': 'DomiciliosApp-Microfarma/1.0',
    },
  })

  if (!respuesta.ok) {
    throw new Error(
      `Error geocodificando dirección: HTTP ${respuesta.status}`
    )
  }

  const datos = await respuesta.json()

  if (!datos.length) {
    return null
  }

  const resultado = datos[0]

  return {
    latitud: Number(resultado.lat),
    longitud: Number(resultado.lon),
    barrio:
      resultado.address?.neighbourhood ||
      resultado.address?.suburb ||
      resultado.address?.quarter ||
      null,
  }
}

// ==========================================
// API PRINCIPAL
// ==========================================

app.get('/', (req, res) => {
  res.json({
    mensaje: 'API de Domicilios funcionando correctamente',
  })
})

// ==========================================
// OBTENER DOMICILIOS
// ==========================================

app.get('/api/domicilios', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        d.id,
        d.direccion,
        d.latitud,
        d.longitud,
        d.barrio,
        d.estado,
        d.metodo_pago,
        d.valor_pedido,
        d.valor_domicilio,
        d.tracking_token,
        d.creado_en,
        d.asignado_en,
        d.aceptado_en,
        d.inicio_en,
        d.llegada_en,
        d.entregado_en,
        d.cancelado_en,

        c.id AS cliente_id,
        c.nombre AS cliente,
        c.telefono,

        s.id AS sede_id,
        s.nombre AS sede,

        z.id AS zona_id,
        z.nombre AS zona,

        dom.id AS domiciliario_id,
        dom.nombre AS domiciliario

      FROM domicilios d

      INNER JOIN clientes c
        ON d.cliente_id = c.id

      INNER JOIN sedes s
        ON d.sede_id = s.id

      INNER JOIN zonas z
        ON s.zona_id = z.id

      LEFT JOIN domiciliarios dom
        ON d.domiciliario_id = dom.id

      ORDER BY d.creado_en DESC
    `)

    res.json(resultado.rows)
  } catch (error) {
    console.error('Error obteniendo domicilios:')
    console.error(error)

    res.status(500).json({
      mensaje: 'Error obteniendo domicilios',
    })
  }
})

// ==========================================
// CREAR DOMICILIO
// ==========================================

app.post('/api/domicilios', async (req, res) => {
  const {
    cliente,
    telefono,
    direccion,
    sede_id,
    domiciliario_id,
    metodo_pago,
    valor_pedido,
    valor_domicilio,
  } = req.body

  if (
    !cliente ||
    !telefono ||
    !direccion ||
    !sede_id
  ) {
    return res.status(400).json({
      mensaje:
        'Cliente, teléfono, dirección y sede son obligatorios',
    })
  }

  const conexion = await pool.connect()

  try {
    await conexion.query('BEGIN')

    // ========================================
    // OBTENER COORDENADAS DE LA DIRECCIÓN
    // ========================================

    const coordenadas = await obtenerCoordenadas(
      direccion
    )

    if (!coordenadas) {
      await conexion.query('ROLLBACK')

      return res.status(400).json({
        mensaje:
          'No se pudo encontrar la ubicación de la dirección. Verifica la dirección e inténtalo nuevamente.',
      })
    }

    // ========================================
    // BUSCAR O CREAR CLIENTE
    // ========================================

    let clienteResultado = await conexion.query(
      `
        SELECT id
        FROM clientes
        WHERE telefono = $1
        LIMIT 1
      `,
      [telefono]
    )

    let clienteId

    if (clienteResultado.rows.length > 0) {
      clienteId = clienteResultado.rows[0].id
    } else {
      const nuevoCliente = await conexion.query(
        `
          INSERT INTO clientes (
            nombre,
            telefono
          )
          VALUES ($1, $2)
          RETURNING id
        `,
        [cliente, telefono]
      )

      clienteId = nuevoCliente.rows[0].id
    }

    // ========================================
    // CREAR DOMICILIO
    // ========================================

    const trackingToken =
      `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`

    const resultado = await conexion.query(
      `
        INSERT INTO domicilios (
          sede_id,
          cliente_id,
          domiciliario_id,
          direccion,
          latitud,
          longitud,
          barrio,
          estado,
          metodo_pago,
          valor_pedido,
          valor_domicilio,
          tracking_token
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          'PENDIENTE',
          $8,
          $9,
          $10,
          $11
        )
        RETURNING *
      `,
      [
        sede_id,
        clienteId,
        domiciliario_id || null,
        direccion,
        coordenadas.latitud,
        coordenadas.longitud,
        coordenadas.barrio,
        metodo_pago || null,
        valor_pedido || null,
        valor_domicilio || null,
        trackingToken,
      ]
    )

    await conexion.query('COMMIT')

    res.status(201).json(resultado.rows[0])
  } catch (error) {
    await conexion.query('ROLLBACK')

    console.error('Error creando domicilio:')
    console.error(error)

    res.status(500).json({
      mensaje: 'No se pudo crear el domicilio',
      error: error.message,
    })
  } finally {
    conexion.release()
  }
})

// ==========================================
// ACTUALIZAR ESTADO DEL DOMICILIO
// ==========================================

app.patch('/api/domicilios/:id/estado', async (req, res) => {
  const { id } = req.params
  const { estado } = req.body

  const estadosPermitidos = [
    'PENDIENTE',
    'ASIGNADO',
    'EN CAMINO',
    'ENTREGADO',
    'CANCELADO',
  ]

  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({
      mensaje: 'Estado no válido',
    })
  }

  try {
    const resultado = await pool.query(
      `
        UPDATE domicilios
        SET estado = $1
        WHERE id = $2
        RETURNING *
      `,
      [estado, id]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Domicilio no encontrado',
      })
    }

    res.json(resultado.rows[0])
  } catch (error) {
    console.error('Error actualizando estado del domicilio:')
    console.error(error)

    res.status(500).json({
      mensaje: 'No se pudo actualizar el estado',
      error: error.message,
    })
  }
})

// =========================
// ELIMINAR DOMICILIO
// =========================

app.delete('/api/domicilios/:id', async (req, res) => {
  const { id } = req.params

  const conexion = await pool.connect()

  try {
    await conexion.query('BEGIN')

    // Primero eliminar las ubicaciones relacionadas
    await conexion.query(
      `
        DELETE FROM ubicaciones
        WHERE domicilio_id = $1
      `,
      [id]
    )

    // Después eliminar el domicilio
    const resultado = await conexion.query(
      `
        DELETE FROM domicilios
        WHERE id = $1
        RETURNING id
      `,
      [id]
    )

    if (resultado.rowCount === 0) {
      await conexion.query('ROLLBACK')

      return res.status(404).json({
        mensaje: 'Domicilio no encontrado',
      })
    }

    await conexion.query('COMMIT')

    res.json({
      mensaje: 'Domicilio eliminado correctamente',
      id: resultado.rows[0].id,
    })
  } catch (error) {
    await conexion.query('ROLLBACK')

    console.error('Error eliminando domicilio:', error)

    res.status(500).json({
      mensaje: 'No se pudo eliminar el domicilio',
      error: error.message,
    })
  } finally {
    conexion.release()
  }
})

// ==========================================
// OBTENER SEDES
// ==========================================

app.get('/api/sedes', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        s.id,
        s.nombre,
        z.id AS zona_id,
        z.nombre AS zona
      FROM sedes s
      INNER JOIN zonas z
        ON s.zona_id = z.id
      ORDER BY z.id, s.nombre
    `)

    res.json(resultado.rows)
  } catch (error) {
    console.error('Error obteniendo sedes:')
    console.error(error)

    res.status(500).json({
      mensaje: 'Error obteniendo sedes',
    })
  }
})

// ==========================================
// OBTENER DOMICILIARIOS
// ==========================================

app.get('/api/domiciliarios', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        d.id,
        d.nombre,
        d.activo,
        z.id AS zona_id,
        z.nombre AS zona
      FROM domiciliarios d
      INNER JOIN zonas z
        ON d.zona_id = z.id
      WHERE d.activo = TRUE
      ORDER BY d.id
    `)

    res.json(resultado.rows)
  } catch (error) {
    console.error('Error obteniendo domiciliarios:')
    console.error(error)

    res.status(500).json({
      mensaje: 'Error obteniendo domiciliarios',
    })
  }
})

app.get('/api/turnos/activo/:domiciliario_id', async (req, res) => {
  const { domiciliario_id } = req.params

  try {
    const resultado = await pool.query(
      `
        SELECT *
        FROM turnos
        WHERE domiciliario_id = $1
          AND estado = 'EN TURNO'
          AND hora_fin IS NULL
        ORDER BY hora_inicio DESC
        LIMIT 1
      `,
      [domiciliario_id]
    )

    res.json({
      turnoActivo: resultado.rows.length > 0,
      turno: resultado.rows[0] || null,
    })
  } catch (error) {
    console.error('Error consultando turno activo:')
    console.error(error)

    res.status(500).json({
      mensaje: 'No se pudo consultar el turno activo',
      error: error.message,
    })
  }
})

app.post('/api/turnos/iniciar', async (req, res) => {
  const { domiciliario_id } = req.body

  if (!domiciliario_id) {
    return res.status(400).json({
      mensaje: 'El domiciliario_id es obligatorio',
    })
  }

  try {
    const turnoActivo = await pool.query(
      `
        SELECT id
        FROM turnos
        WHERE domiciliario_id = $1
          AND estado = 'EN TURNO'
          AND hora_fin IS NULL
        LIMIT 1
      `,
      [domiciliario_id]
    )

    if (turnoActivo.rows.length > 0) {
      return res.status(400).json({
        mensaje: 'El domiciliario ya tiene un turno activo',
      })
    }

    const resultado = await pool.query(
      `
        INSERT INTO turnos (
          domiciliario_id,
          fecha,
          hora_inicio,
          estado
        )
        VALUES (
          $1,
          CURRENT_DATE,
          NOW(),
          'EN TURNO'
        )
        RETURNING *
      `,
      [domiciliario_id]
    )

    res.status(201).json({
      mensaje: 'Turno iniciado correctamente',
      turno: resultado.rows[0],
    })
  } catch (error) {
    console.error('Error iniciando turno:')
    console.error(error)

    res.status(500).json({
      mensaje: 'No se pudo iniciar el turno',
      error: error.message,
    })
  }
})

app.post('/api/turnos/finalizar', async (req, res) => {
  const { domiciliario_id } = req.body

  if (!domiciliario_id) {
    return res.status(400).json({
      mensaje: 'El domiciliario_id es obligatorio',
    })
  }

  try {
    const resultado = await pool.query(
      `
        UPDATE turnos
        SET
          hora_fin = NOW(),
          estado = 'FINALIZADO'
        WHERE domiciliario_id = $1
          AND estado = 'EN TURNO'
          AND hora_fin IS NULL
        RETURNING *
      `,
      [domiciliario_id]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'El domiciliario no tiene un turno activo',
      })
    }

    res.json({
      mensaje: 'Turno finalizado correctamente',
      turno: resultado.rows[0],
    })
  } catch (error) {
    console.error('Error finalizando turno:')
    console.error(error)

    res.status(500).json({
      mensaje: 'No se pudo finalizar el turno',
      error: error.message,
    })
  }
})

// ==========================================
// SOCKET.IO - GPS
// ==========================================

const ubicacionesDomiciliarios = {}

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id)

  socket.on('ubicacion_domiciliario', (ubicacion) => {
    console.log('Ubicación recibida:')
    console.log(ubicacion)

    ubicacionesDomiciliarios[
      ubicacion.domiciliario_id
    ] = ubicacion

    // Enviar ubicación en tiempo real
    io.emit('ubicacion_actualizada', ubicacion)

    // Guardar historial GPS en PostgreSQL
    pool
      .query(
        `
          INSERT INTO ubicaciones (
            domiciliario_id,
            domicilio_id,
            latitud,
            longitud,
            precision_m,
            velocidad,
            fecha_hora
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          ubicacion.domiciliario_id,
          ubicacion.domicilio_id || null,
          ubicacion.latitud,
          ubicacion.longitud,
          ubicacion.precision || null,
          ubicacion.velocidad || null,
          ubicacion.fecha_hora || new Date(),
        ]
      )
      .catch((error) => {
        console.error('Error guardando ubicación GPS:')
        console.error(error.message)
      })
  })

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id)
  })
})

// ==========================================
// SERVIDOR
// ==========================================

const PORT = 3000

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Servidor funcionando en http://localhost:${PORT}`
  )
})