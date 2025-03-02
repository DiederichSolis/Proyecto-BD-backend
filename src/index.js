const express = require('express');
const cors = require('cors');
const { driver, closeDriver } = require('./db');
const nodeRoutes = require('./routes/nodes');
const relationsRoutes = require('./routes/relations');
const queriesRoutes = require('./routes/queries');
const advancedQueries = require('./routes/advancedQueries');
const exportRankingTrendsRoutes = require('./routes/exportRankingTrends');
const swaggerDocs = require('./swagger'); 
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use('/nodes', nodeRoutes);
app.use('/relations', relationsRoutes);
app.use('/queries', queriesRoutes);
app.use('/advanced', advancedQueries);
app.use('/api', exportRankingTrendsRoutes);

swaggerDocs(app); // Activa Swagger

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor funcionando correctamente');
});

// Cerrar conexión con Neo4j al apagar el servidor
process.on('SIGINT', async () => {
  console.log('Cerrando conexión con Neo4j...');
  await closeDriver();
  process.exit(0);
});


// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🔥 Servidor corriendo en http://localhost:${PORT}`);
});
