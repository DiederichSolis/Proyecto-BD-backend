const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Define la URL del servidor según el entorno
const host = process.env.NODE_ENV === 'production'
  ? `https://${process.env.VERCEL_URL}` // En producción, Vercel define VERCEL_URL
  : 'http://localhost:3000';           // En desarrollo

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Documentación - Neo4j & Node.js',
      version: '1.0.0',
      description: 'Documentación de API que interactúan con Neo4j para la gestión de nodos, relaciones y consultas avanzadas.',
    },
    servers: [
      {
        url: host,
      },
    ],
  },
  apis: [__dirname + '/routes/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

const swaggerDocs = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

module.exports = swaggerDocs;