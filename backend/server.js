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
async function obtenerCoordenadas(direccion, barrio) {
  const direccionCompleta =
    `${direccion}, ${barrio}, Neiva, Huila, Colombia`

  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=co&q=${encodeURIComponent(direccionCompleta)}`

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

  const barrioBuscado = barrio.trim().toLowerCase()

  const resultadoConBarrio =
    datos.find((resultado) => {
      const barriosResultado = [
        resultado.address?.neighbourhood,
        resultado.address?.suburb,
        resultado.address?.quarter,
      ]
        .filter(Boolean)
        .map((valor) =>
          valor.toLowerCase()
        )

      return barriosResultado.some((valor) =>
        valor.includes(barrioBuscado) ||
        barrioBuscado.includes(valor)
      )
    }) || datos[0]

  return {
    latitud: Number(resultadoConBarrio.lat),
    longitud: Number(resultadoConBarrio.lon),
    barrio:
      resultadoConBarrio.address?.neighbourhood ||
      resultadoConBarrio.address?.suburb ||
      resultadoConBarrio.address?.quarter ||
      barrio,
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
// SEGUIMIENTO PÚBLICO DE DOMICILIO
// ==========================================

app.get('/api/tracking/:token', async (req, res) => {
  const { token } = req.params

  if (!token) {
    return res.status(400).json({
      mensaje: 'Token de seguimiento obligatorio',
    })
  }

  try {
    const resultado = await pool.query(
      `
        SELECT
          d.id,
          d.direccion,
          d.latitud,
          d.longitud,
          d.barrio,
          d.estado,
          d.tracking_token,
          d.creado_en,
          d.asignado_en,
          d.aceptado_en,
          d.inicio_en,
          d.llegada_en,
          d.entregado_en,

          c.nombre AS cliente,

          s.nombre AS sede,

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

        WHERE d.tracking_token = $1

        LIMIT 1
      `,
      [token]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Seguimiento no encontrado',
      })
    }

    const domicilio = resultado.rows[0]

    // Última ubicación conocida del domiciliario
    const ubicacion = await pool.query(
      `
        SELECT
          latitud,
          longitud,
          precision_m,
          fecha_hora
        FROM ubicaciones
        WHERE domicilio_id = $1
        ORDER BY fecha_hora DESC
        LIMIT 1
      `,
      [domicilio.id]
    )

    res.json({
      domicilio: {
        id: domicilio.id,
        cliente: domicilio.cliente,
        direccion: domicilio.direccion,
        barrio: domicilio.barrio,
        sede: domicilio.sede,
        zona: domicilio.zona,
        estado: domicilio.estado,
        domiciliario: domicilio.domiciliario,
        domiciliario_id: domicilio.domiciliario_id,
        creado_en: domicilio.creado_en,
        asignado_en: domicilio.asignado_en,
        aceptado_en: domicilio.aceptado_en,
        inicio_en: domicilio.inicio_en,
        llegada_en: domicilio.llegada_en,
        entregado_en: domicilio.entregado_en,
      },

      ubicacion: ubicacion.rows[0] || null,
    })
  } catch (error) {
    console.error('Error obteniendo seguimiento público:')
    console.error(error)

    res.status(500).json({
      mensaje: 'No se pudo obtener el seguimiento',
      error: error.message,
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
    barrio,
    latitud,
    longitud,
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
    !barrio ||
    !sede_id
  ) {
    return res.status(400).json({
      mensaje:
        'Cliente, teléfono, dirección, barrio y sede son obligatorios',
    })
  }

  const conexion = await pool.connect()

  try {
    await conexion.query('BEGIN')

    // ========================================
    // OBTENER COORDENADAS DE LA DIRECCIÓN
    // ========================================
    let coordenadas

    if (
      latitud !== undefined &&
      longitud !== undefined &&
      latitud !== '' &&
      longitud !== ''
    ) {
      coordenadas = {
        latitud: Number(latitud),
        longitud: Number(longitud),
      }
    } else {
      coordenadas =
        await obtenerCoordenadas(
          direccion,
          barrio
        )
    }

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
        barrio,
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
    let campoHora = null

    if (estado === 'ASIGNADO') {
      campoHora = 'asignado_en'
    }

    if (estado === 'EN CAMINO') {
      campoHora = 'inicio_en'
    }

    if (estado === 'ENTREGADO') {
      campoHora = 'entregado_en'
    }

    if (estado === 'CANCELADO') {
      campoHora = 'cancelado_en'
    }

    let consulta
    let parametros

    if (campoHora) {
      consulta = `
        UPDATE domicilios
        SET
          estado = $1,
          ${campoHora} = COALESCE(${campoHora}, NOW())
        WHERE id = $2
        RETURNING *
      `

      parametros = [estado, id]
    } else {
      consulta = `
        UPDATE domicilios
        SET estado = $1
        WHERE id = $2
        RETURNING *
      `

      parametros = [estado, id]
    }

    const resultado = await pool.query(
      consulta,
      parametros
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Domicilio no encontrado',
      })
    }

    res.json(resultado.rows[0])
  } catch (error) {
    console.error(
      'Error actualizando estado del domicilio:'
    )

    console.error(error)

    res.status(500).json({
      mensaje: 'No se pudo actualizar el estado',
      error: error.message,
    })
  }
})

// ==========================================
// ASIGNAR DOMICILIARIO A DOMICILIO
// ==========================================

app.patch('/api/domicilios/:id/asignar', async (req, res) => {
  const { id } = req.params
  const { domiciliario_id } = req.body

  if (!domiciliario_id) {
    return res.status(400).json({
      mensaje: 'El domiciliario_id es obligatorio',
    })
  }

  try {
    // ==========================================
    // VERIFICAR DOMICILIARIO
    // ==========================================

    const domiciliario = await pool.query(
      `
        SELECT
          d.id,
          d.nombre,
          d.activo,
          d.zona_id
        FROM domiciliarios d
        WHERE d.id = $1
        LIMIT 1
      `,
      [domiciliario_id]
    )

    if (domiciliario.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Domiciliario no encontrado',
      })
    }

    const datosDomiciliario =
      domiciliario.rows[0]

    if (!datosDomiciliario.activo) {
      return res.status(400).json({
        mensaje: 'El domiciliario está inactivo',
      })
    }

    // ==========================================
    // VERIFICAR DOMICILIO Y ZONA
    // ==========================================

    const domicilio = await pool.query(
      `
        SELECT
          d.id,
          d.estado,
          d.sede_id,
          s.zona_id
        FROM domicilios d
        INNER JOIN sedes s
          ON s.id = d.sede_id
        WHERE d.id = $1
        LIMIT 1
      `,
      [id]
    )

    if (domicilio.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Domicilio no encontrado',
      })
    }

    const datosDomicilio =
      domicilio.rows[0]

    // ==========================================
    // VALIDAR MISMA ZONA
    // ==========================================

    if (
      Number(datosDomicilio.zona_id) !==
      Number(datosDomiciliario.zona_id)
    ) {
      return res.status(400).json({
        mensaje:
          'El domiciliario no pertenece a la misma zona de la sede del domicilio',
      })
    }

    // ==========================================
    // VALIDAR TURNO ACTIVO
    // ==========================================

    const turnoActivo = await pool.query(
      `
        SELECT
          id,
          hora_inicio
        FROM turnos
        WHERE domiciliario_id = $1
          AND estado = 'EN TURNO'
          AND hora_fin IS NULL
        ORDER BY hora_inicio DESC
        LIMIT 1
      `,
      [domiciliario_id]
    )

    if (turnoActivo.rows.length === 0) {
      return res.status(400).json({
        mensaje:
          'El domiciliario no tiene un turno activo',
      })
    }

    // ==========================================
    // ASIGNAR DOMICILIARIO
    // ==========================================

    const resultado = await pool.query(
      `
        UPDATE domicilios
        SET
          domiciliario_id = $1,
          estado = 'ASIGNADO',
          asignado_en = COALESCE(asignado_en, NOW())
        WHERE id = $2
        RETURNING *
      `,
      [domiciliario_id, id]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje:
          'No se pudo actualizar el domicilio',
      })
    }

    res.json({
      mensaje:
        'Domiciliario asignado correctamente',
      domicilio:
        resultado.rows[0],
    })
  } catch (error) {
    console.error(
      'Error asignando domiciliario:'
    )
    console.error(error)

    res.status(500).json({
      mensaje:
        'No se pudo asignar el domiciliario',
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
// HISTORIAL DE TURNOS
// ==========================================

app.get('/api/turnos/historial/:domiciliario_id', async (req, res) => {
  const { domiciliario_id } = req.params

  try {
    const resultado = await pool.query(
      `
        SELECT
          t.id,
          t.domiciliario_id,
          d.nombre AS domiciliario,
          t.fecha,
          t.hora_inicio,
          t.hora_fin,
          t.estado,

          CASE
            WHEN t.hora_fin IS NOT NULL
            THEN ROUND(
              EXTRACT(EPOCH FROM (t.hora_fin - t.hora_inicio)) / 60
            )
            ELSE NULL
          END AS duracion_minutos,

          COUNT(
            CASE
              WHEN dom.estado = 'ENTREGADO'
              THEN 1
            END
          ) AS domicilios_entregados,

          (
            SELECT u.latitud
            FROM ubicaciones u
            WHERE u.domiciliario_id = t.domiciliario_id
              AND u.fecha_hora >= t.hora_inicio
              AND (
                t.hora_fin IS NULL
                OR u.fecha_hora <= t.hora_fin
              )
            ORDER BY u.fecha_hora ASC
            LIMIT 1
          ) AS inicio_latitud,

          (
            SELECT u.longitud
            FROM ubicaciones u
            WHERE u.domiciliario_id = t.domiciliario_id
              AND u.fecha_hora >= t.hora_inicio
              AND (
                t.hora_fin IS NULL
                OR u.fecha_hora <= t.hora_fin
              )
            ORDER BY u.fecha_hora ASC
            LIMIT 1
          ) AS inicio_longitud,

          (
            SELECT u.latitud
            FROM ubicaciones u
            WHERE u.domiciliario_id = t.domiciliario_id
              AND u.fecha_hora >= t.hora_inicio
              AND (
                t.hora_fin IS NULL
                OR u.fecha_hora <= t.hora_fin
              )
            ORDER BY u.fecha_hora DESC
            LIMIT 1
          ) AS ultima_latitud,

          (
            SELECT u.longitud
            FROM ubicaciones u
            WHERE u.domiciliario_id = t.domiciliario_id
              AND u.fecha_hora >= t.hora_inicio
              AND (
                t.hora_fin IS NULL
                OR u.fecha_hora <= t.hora_fin
              )
            ORDER BY u.fecha_hora DESC
            LIMIT 1
          ) AS ultima_longitud

        FROM turnos t

        INNER JOIN domiciliarios d
          ON d.id = t.domiciliario_id

        LEFT JOIN domicilios dom
          ON dom.domiciliario_id = t.domiciliario_id
          AND dom.entregado_en >= t.hora_inicio
          AND (
            t.hora_fin IS NULL
            OR dom.entregado_en <= t.hora_fin
          )

        WHERE t.domiciliario_id = $1

        GROUP BY
          t.id,
          t.domiciliario_id,
          d.nombre,
          t.fecha,
          t.hora_inicio,
          t.hora_fin,
          t.estado

        ORDER BY t.hora_inicio DESC
      `,
      [domiciliario_id]
    )

    res.json(resultado.rows)
  } catch (error) {
    console.error('Error consultando historial de turnos:')
    console.error(error)

    res.status(500).json({
      mensaje: 'No se pudo consultar el historial de turnos',
      error: error.message,
    })
  }
})

// ==========================================
// CALIFICACIONES
// ==========================================

// ==========================================
// CREAR CALIFICACIÓN
// ==========================================

app.post('/api/calificaciones', async (req, res) => {
  const {
    domicilio_id,
    estrellas,
    observacion,
  } = req.body

  if (!domicilio_id) {
    return res.status(400).json({
      mensaje: 'El domicilio_id es obligatorio',
    })
  }

  if (
    !Number.isInteger(Number(estrellas)) ||
    Number(estrellas) < 1 ||
    Number(estrellas) > 5
  ) {
    return res.status(400).json({
      mensaje:
        'Las estrellas deben ser un número entre 1 y 5',
    })
  }

  try {
    const domicilio = await pool.query(
      `
        SELECT
          d.id,
          d.estado,
          d.cliente_id,
          d.domiciliario_id,
          d.sede_id
        FROM domicilios d
        WHERE d.id = $1
        LIMIT 1
      `,
      [domicilio_id]
    )

    if (domicilio.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Domicilio no encontrado',
      })
    }

    const datos = domicilio.rows[0]

    if (datos.estado !== 'ENTREGADO') {
      return res.status(400).json({
        mensaje:
          'El domicilio debe estar ENTREGADO para poder calificarlo',
      })
    }

    const existente = await pool.query(
      `
        SELECT id
        FROM calificaciones
        WHERE domicilio_id = $1
        LIMIT 1
      `,
      [domicilio_id]
    )

    if (existente.rows.length > 0) {
      return res.status(400).json({
        mensaje:
          'Este domicilio ya tiene una calificación',
      })
    }

    const resultado = await pool.query(
      `
        INSERT INTO calificaciones (
          domicilio_id,
          cliente_id,
          domiciliario_id,
          sede_id,
          estrellas,
          observacion
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        domicilio_id,
        datos.cliente_id,
        datos.domiciliario_id,
        datos.sede_id,
        Number(estrellas),
        observacion?.trim() || null,
      ]
    )

    res.status(201).json({
      mensaje:
        'Calificación registrada correctamente',
      calificacion:
        resultado.rows[0],
    })
  } catch (error) {
    console.error(
      'Error registrando calificación:'
    )
    console.error(error)

    res.status(500).json({
      mensaje:
        'No se pudo registrar la calificación',
      error: error.message,
    })
  }
})

// ==========================================
// CONSULTAR CALIFICACIÓN DE UN DOMICILIO
// ==========================================

app.get(
  '/api/calificaciones/domicilio/:domicilio_id',
  async (req, res) => {
    const { domicilio_id } = req.params

    try {
      const resultado = await pool.query(
        `
          SELECT
            c.id,
            c.domicilio_id,
            c.cliente_id,
            c.domiciliario_id,
            c.sede_id,
            c.estrellas,
            c.observacion,
            c.creado_en,

            cl.nombre AS cliente_nombre,
            cl.telefono AS cliente_telefono,

            d.nombre AS domiciliario_nombre,

            s.nombre AS sede_nombre

          FROM calificaciones c

          INNER JOIN clientes cl
            ON cl.id = c.cliente_id

          LEFT JOIN domiciliarios d
            ON d.id = c.domiciliario_id

          INNER JOIN sedes s
            ON s.id = c.sede_id

          WHERE c.domicilio_id = $1

          LIMIT 1
        `,
        [domicilio_id]
      )

      if (resultado.rows.length === 0) {
        return res.status(404).json({
          mensaje:
            'Este domicilio todavía no tiene calificación',
        })
      }

      res.json(resultado.rows[0])
    } catch (error) {
      console.error(
        'Error consultando calificación:'
      )
      console.error(error)

      res.status(500).json({
        mensaje:
          'No se pudo consultar la calificación',
        error: error.message,
      })
    }
  }
)

// ==========================================
// OBTENER TODAS LAS CALIFICACIONES
// ==========================================

app.get('/api/calificaciones', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        c.id,
        c.domicilio_id,
        c.estrellas,
        c.observacion,
        c.creado_en,

        cl.nombre AS cliente_nombre,
        cl.telefono AS cliente_telefono,

        d.nombre AS domiciliario_nombre,

        s.nombre AS sede_nombre

      FROM calificaciones c

      INNER JOIN clientes cl
        ON cl.id = c.cliente_id

      LEFT JOIN domiciliarios d
        ON d.id = c.domiciliario_id

      INNER JOIN sedes s
        ON s.id = c.sede_id

      ORDER BY c.creado_en DESC
    `)

    res.json(resultado.rows)
  } catch (error) {
    console.error(
      'Error consultando calificaciones:'
    )
    console.error(error)

    res.status(500).json({
      mensaje:
        'No se pudieron consultar las calificaciones',
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

  socket.on('ubicacion_domiciliario', async (ubicacion) => {
    console.log('Ubicación recibida:')
    console.log(ubicacion)

    try {
      // ==========================================
      // VALIDAR QUE EL DOMICILIARIO ESTÉ EN TURNO
      // ==========================================

      const turnoActivo = await pool.query(
        `
          SELECT id
          FROM turnos
          WHERE domiciliario_id = $1
            AND estado = 'EN TURNO'
            AND hora_fin IS NULL
          ORDER BY hora_inicio DESC
          LIMIT 1
        `,
        [ubicacion.domiciliario_id]
      )

      // Si no tiene turno activo, no guardamos ni emitimos el GPS
      if (turnoActivo.rows.length === 0) {
        console.log(
          `GPS ignorado: el domiciliario ${ubicacion.domiciliario_id} no tiene turno activo`
        )

        return
      }

      // ==========================================
      // GUARDAR ÚLTIMA UBICACIÓN EN MEMORIA
      // ==========================================

      ubicacionesDomiciliarios[
        ubicacion.domiciliario_id
      ] = ubicacion

      // ==========================================
      // ENVIAR UBICACIÓN A LOS CLIENTES CONECTADOS
      // ==========================================

      io.emit('ubicacion_actualizada', ubicacion)

      // ==========================================
      // GUARDAR UBICACIÓN EN BASE DE DATOS
      // ==========================================

      await pool.query(
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

      console.log(
        `GPS guardado correctamente para domiciliario ${ubicacion.domiciliario_id}`
      )

    } catch (error) {
      console.error('Error procesando ubicación GPS:')
      console.error(error.message)
    }
  })

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id)
  })
})

/* ==========================================
   ACTUALIZAR UBICACIÓN DE UN DOMICILIO
========================================== */

app.patch('/api/domicilios/:id/ubicacion', async (req, res) => {
  const id = Number(req.params.id)
  const latitud = Number(req.body.latitud)
  const longitud = Number(req.body.longitud)

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    req.body.latitud === undefined ||
    req.body.longitud === undefined ||
    req.body.latitud === null ||
    req.body.longitud === null ||
    req.body.latitud === '' ||
    req.body.longitud === '' ||
    !Number.isFinite(latitud) ||
    !Number.isFinite(longitud) ||
    latitud < -90 ||
    latitud > 90 ||
    longitud < -180 ||
    longitud > 180
  ) {
    return res.status(400).json({
      mensaje: 'Las coordenadas enviadas no son válidas.',
    })
  }

  try {
    const resultado = await pool.query(
      `
        UPDATE domicilios
        SET latitud = $1,
            longitud = $2
        WHERE id = $3
        RETURNING id, latitud, longitud
      `,
      [latitud, longitud, id]
    )

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró el domicilio.',
      })
    }

    return res.json({
      mensaje: 'Ubicación actualizada correctamente.',
      domicilio: resultado.rows[0],
    })
  } catch (error) {
    console.error(
      'Error actualizando ubicación del domicilio:',
      error
    )

    return res.status(500).json({
      mensaje: 'No se pudo actualizar la ubicación.',
    })
  }
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