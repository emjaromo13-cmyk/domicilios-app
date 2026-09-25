const pool = require('./db')

async function probarTurnos() {
  try {
    const resultado = await pool.query(`
      SELECT
        t.id,
        t.domiciliario_id,
        d.nombre AS domiciliario,
        z.nombre AS zona,
        t.fecha,
        t.hora_inicio,
        t.hora_fin,
        t.estado
      FROM turnos t
      INNER JOIN domiciliarios d
        ON t.domiciliario_id = d.id
      INNER JOIN zonas z
        ON d.zona_id = z.id
      ORDER BY t.id
    `)

    console.log('Turnos registrados:')
    console.table(resultado.rows)
  } catch (error) {
    console.error('❌ Error:')
    console.error(error.message)
  } finally {
    await pool.end()
  }
}

probarTurnos()