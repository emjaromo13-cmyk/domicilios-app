const pool = require('./db')

async function crearTablas() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS zonas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS sedes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        zona_id INTEGER NOT NULL REFERENCES zonas(id)
      );

      CREATE TABLE IF NOT EXISTS domiciliarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        zona_id INTEGER NOT NULL REFERENCES zonas(id),
        activo BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS turnos (
        id SERIAL PRIMARY KEY,
        domiciliario_id INTEGER NOT NULL REFERENCES domiciliarios(id),
        fecha DATE NOT NULL DEFAULT CURRENT_DATE,
        hora_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        hora_fin TIMESTAMPTZ,
        estado VARCHAR(20) NOT NULL DEFAULT 'EN TURNO'
      );

      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        telefono VARCHAR(30) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS domicilios (
        id BIGSERIAL PRIMARY KEY,
        sede_id INTEGER NOT NULL REFERENCES sedes(id),
        cliente_id INTEGER NOT NULL REFERENCES clientes(id),
        domiciliario_id INTEGER REFERENCES domiciliarios(id),
        direccion TEXT NOT NULL,

        estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',

        metodo_pago VARCHAR(30),
        valor_pedido NUMERIC(12,2),
        valor_domicilio NUMERIC(12,2),

        tracking_token VARCHAR(100) UNIQUE,

        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        asignado_en TIMESTAMPTZ,
        aceptado_en TIMESTAMPTZ,
        inicio_en TIMESTAMPTZ,
        llegada_en TIMESTAMPTZ,
        entregado_en TIMESTAMPTZ,
        cancelado_en TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS ubicaciones (
        id BIGSERIAL PRIMARY KEY,
        domiciliario_id INTEGER NOT NULL REFERENCES domiciliarios(id),
        domicilio_id BIGINT REFERENCES domicilios(id),

        latitud DOUBLE PRECISION NOT NULL,
        longitud DOUBLE PRECISION NOT NULL,
        precision_m DOUBLE PRECISION,
        velocidad DOUBLE PRECISION,

        fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    console.log('✅ TABLAS CREADAS CORRECTAMENTE')
  } catch (error) {
    console.error('❌ Error creando las tablas:')
    console.error(error.message)
  } finally {
    await pool.end()
  }
}

crearTablas()