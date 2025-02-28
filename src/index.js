const { driver, closeDriver } = require('./db');

async function testConnection() {
  const session = driver.session();
  try {
    // Ejecuta una consulta simple para probar la conexión
    const result = await session.run("RETURN 'Conexión exitosa a Aura' AS mensaje");
    const mensaje = result.records[0].get('mensaje');
    console.log(mensaje);
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
  } finally {
    await session.close();
    await closeDriver();
  }
}

testConnection();