const pool = require('./db')

async function iniciarTurno() {
  try {
    const resultado = await pool.query(`
      INSERT INTO turnos (
        domiciliario_id,
        fecha,
        hora_inicio,
        estado
      )
      VALUES (
        1,
        CURRENT_DATE,
        NOW(),
        'EN TURNO'
      )
      RETURNING *
    `)

    console.log('✅ Turno creado correctamente:')
    console.table(resultado.rows)
  } catch (error) {
    console.error('❌ Error:')
    console.error(error.message)
  } finally {
    await pool.end()
  }
}

iniciarTurno()