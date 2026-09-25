const pool = require('./db')

async function insertarDatos() {
  try {
    // =========================
    // ZONAS
    // =========================

    await pool.query(`
      INSERT INTO zonas (nombre)
      VALUES
        ('ZONA 1'),
        ('ZONA 2')
      ON CONFLICT (nombre) DO NOTHING;
    `)

    // =========================
    // SEDES
    // =========================

    await pool.query(`
      INSERT INTO sedes (nombre, zona_id)
      VALUES
        ('PINOS', (SELECT id FROM zonas WHERE nombre = 'ZONA 1')),
        ('GUALANDAY', (SELECT id FROM zonas WHERE nombre = 'ZONA 1')),
        ('CAÑA BRAVA', (SELECT id FROM zonas WHERE nombre = 'ZONA 1')),
        ('BUGANVILES', (SELECT id FROM zonas WHERE nombre = 'ZONA 1')),
        ('RIVERA', (SELECT id FROM zonas WHERE nombre = 'ZONA 1')),

        ('LIMONAR', (SELECT id FROM zonas WHERE nombre = 'ZONA 2')),
        ('BAMBU', (SELECT id FROM zonas WHERE nombre = 'ZONA 2')),
        ('MANZANAREZ', (SELECT id FROM zonas WHERE nombre = 'ZONA 2')),
        ('MIRA RIO', (SELECT id FROM zonas WHERE nombre = 'ZONA 2')),
        ('IPANEMA', (SELECT id FROM zonas WHERE nombre = 'ZONA 2'))
      ON CONFLICT (nombre) DO NOTHING;
    `)

    // =========================
    // DOMICILIARIOS
    // =========================

    await pool.query(`
      INSERT INTO domiciliarios (nombre, zona_id)
      VALUES
        ('Domiciliario 1', (SELECT id FROM zonas WHERE nombre = 'ZONA 1')),
        ('Domiciliario 2', (SELECT id FROM zonas WHERE nombre = 'ZONA 1')),
        ('Domiciliario 3', (SELECT id FROM zonas WHERE nombre = 'ZONA 2')),
        ('Domiciliario 4', (SELECT id FROM zonas WHERE nombre = 'ZONA 2'))
      ON CONFLICT DO NOTHING;
    `)

    console.log('✅ DATOS INICIALES INSERTADOS CORRECTAMENTE')
  } catch (error) {
    console.error('❌ Error insertando datos:')
    console.error(error.message)
  } finally {
    await pool.end()
  }
}

insertarDatos()