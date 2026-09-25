const pool = require('./db')

async function probarConexion() {
  try {
    const resultado = await pool.query('SELECT NOW()')

    console.log('✅ CONEXIÓN CON POSTGRESQL FUNCIONANDO')
    console.log('Hora de PostgreSQL:', resultado.rows[0].now)
  } catch (error) {
    console.error('❌ Error conectando con PostgreSQL:')
    console.error(error.message)
  } finally {
    await pool.end()
  }
}

probarConexion()