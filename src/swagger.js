const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Documentación - Neo4j & Node.js',
      version: '1.0.0',
      description: 'API que interactúa con Neo4j para la gestión de nodos, relaciones y consultas avanzadas.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
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
