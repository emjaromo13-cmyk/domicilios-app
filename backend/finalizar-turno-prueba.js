const pool = require('./db')

async function finalizarTurno() {
  try {
    const resultado = await pool.query(`
      UPDATE turnos
      SET
        hora_fin = NOW(),
        estado = 'FINALIZADO'
      WHERE domiciliario_id = 1
        AND estado = 'EN TURNO'
        AND hora_fin IS NULL
      RETURNING *
    `)

    if (resultado.rows.length === 0) {
      console.log('❌ No hay un turno activo para el Domiciliario 1')
    } else {
      console.log('✅ Turno finalizado correctamente:')
      console.table(resultado.rows)
    }
  } catch (error) {
    console.error('❌ Error:')
    console.error(error.message)
  } finally {
    await pool.end()
  }
}

finalizarTurno()