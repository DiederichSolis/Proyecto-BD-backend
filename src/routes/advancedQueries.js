const express = require('express');
const router = express.Router();
const { driver } = require('../db');

/**
 * 1️⃣ Influential Users (Usuarios Influyentes)
 * Retorna los 5 usuarios con mayor número de seguidores (basado en la relación SIGUE_A)
 */

/**
 * @swagger
 * /advanced/influential-users:
 *   get:
 *     summary: Obtiene los 5 usuarios más influyentes
 *     description: Retorna los 5 usuarios con el mayor número de seguidores basado en la relación `SIGUE_A`.
 *     tags:
 *       - AdvancedQueries
 *     responses:
 *       200:
 *         description: Lista de los 5 usuarios más influyentes.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 influentialUsers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         description: Nombre del usuario influyente.
 *                         example: "Juan Pérez"
 *                       influence:
 *                         type: integer
 *                         description: Cantidad de seguidores que tiene el usuario.
 *                         example: 120
 *       500:
 *         description: Error en el servidor al ejecutar la consulta.
 */
router.get('/influential-users', async (req, res) => {
  const session = driver.session();
  try {
    const query = `
      MATCH (u:Usuario)<-[:SIGUE_A]-(other)
      RETURN u.nombre AS Usuario, COUNT(other) AS Influencia
      ORDER BY Influencia DESC
      LIMIT 10
    `;
    const result = await session.run(query);
    const influentialUsers = result.records.map(record => ({
      name: record.get('Usuario'),
      influence: record.get('Influencia')
    }));
    res.json({ influentialUsers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/**
 * 3️⃣ Personalized Recommendations for Publications (Recomendaciones Personalizadas)
 * Sugerir publicaciones basadas en los intereses del usuario.
 */
/**
 * @swagger
 * /advanced/personalized-recommendations/{userId}:
 *   get:
 *     summary: Obtiene recomendaciones personalizadas para un usuario
 *     description: Retorna hasta 5 publicaciones recomendadas basadas en los intereses del usuario.
 *     tags:
 *       - AdvancedQueries
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario para el cual se generarán las recomendaciones.
 *     responses:
 *       200:
 *         description: Lista de publicaciones recomendadas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       publication:
 *                         type: string
 *                         description: Título de la publicación recomendada.
 *                         example: "Cómo aprender Node.js en 2024"
 *                       relevance:
 *                         type: integer
 *                         description: Nivel de relevancia de la publicación para el usuario.
 *                         example: 3
 *       400:
 *         description: ID de usuario inválido.
 *       500:
 *         description: Error en el servidor al ejecutar la consulta.
 */

router.get('/personalized-recommendations/:userId', async (req, res) => {
  const session = driver.session();
  const userId = parseInt(req.params.userId, 10);
  try {
    const query = `
      MATCH (u:Usuario {id: $userId})-[:TIENE_INTERÉS_EN]->(c:Categoría)<-[:RELACIONADO_CON]-(p:Publicación)
      RETURN p.título AS Publicación, COUNT(c) AS Relevancia
      ORDER BY Relevancia DESC
      LIMIT 5
    `;
    const result = await session.run(query, { userId });
    const recommendations = result.records.map(record => ({
      publication: record.get('Publicación'),
      relevance: record.get('Relevancia')
    }));
    res.json({ recommendations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/**
 * 1️⃣ Trending Categories
 * Retorna las 5 categorías con mayor cantidad de publicaciones recientes (después del 1/01/2024)
 */
/**
 * @swagger
 * /advanced/trending-categories:
 *   get:
 *     summary: Obtiene las 5 categorías con más publicaciones recientes
 *     description: Retorna las categorías con mayor número de publicaciones desde el 1 de enero de 2024.
 *     tags:
 *       - AdvancedQueries
 *     responses:
 *       200:
 *         description: Lista de las categorías en tendencia.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 trendingCategories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                         description: Nombre de la categoría en tendencia.
 *                         example: "Tecnología"
 *                       publicationCount:
 *                         type: integer
 *                         description: Número de publicaciones recientes en la categoría.
 *                         example: 25
 *       500:
 *         description: Error en el servidor al ejecutar la consulta.
 */

router.get('/trending-categories', async (req, res) => {
    const session = driver.session();
    try {
      const query = `
        MATCH (p:Publicación)-[:RELACIONADO_CON]->(cat:Categoría)
        WHERE p.fecha_publicación > date("2024-01-01")
        RETURN cat.nombre AS Categoria, count(p) AS NumeroDePublicaciones
        ORDER BY NumeroDePublicaciones DESC
        LIMIT 10
      `;
      const result = await session.run(query);
      const trends = result.records.map(record => ({
        category: record.get('Categoria'),
        publicationCount: record.get('NumeroDePublicaciones').low || record.get('NumeroDePublicaciones')
      }));
      res.json({ trendingCategories: trends });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * 2️⃣ Top Engaged Publications
   * Retorna las 5 publicaciones con mayor engagement (suma de comentarios y reacciones)
   */
  /**
 * @swagger
 * /advanced/top-engagement-publications:
 *   get:
 *     summary: Obtiene las 5 publicaciones con mayor engagement
 *     description: Retorna las publicaciones con más interacciones (comentarios + reacciones), ordenadas por engagement en orden descendente.
 *     tags:
 *       - AdvancedQueries
 *     responses:
 *       200:
 *         description: Lista de las publicaciones con mayor engagement.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 topEngagedPublications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                         description: Título de la publicación.
 *                         example: "Nueva tecnología en IA revoluciona la industria"
 *                       comments:
 *                         type: integer
 *                         description: Número de comentarios en la publicación.
 *                         example: 45
 *                       reactions:
 *                         type: integer
 *                         description: Número de reacciones en la publicación.
 *                         example: 120
 *                       engagement:
 *                         type: integer
 *                         description: Total de interacciones (comentarios + reacciones).
 *                         example: 165
 *       500:
 *         description: Error en el servidor al ejecutar la consulta.
 */

  router.get('/top-engagement-publications', async (req, res) => {
    const session = driver.session();
    try {
      const query = `
        MATCH (p:Publicación)
        OPTIONAL MATCH (p)<-[c:COMENTA_EN]-()
        OPTIONAL MATCH (p)<-[r:REACCIONA_A]-()
        RETURN p.título AS Publicacion, count(DISTINCT c) AS Comentarios, count(DISTINCT r) AS Reacciones,
               (count(DISTINCT c) + count(DISTINCT r)) AS Engagement
        ORDER BY Engagement DESC
        LIMIT 10
      `;
      const result = await session.run(query);
      const publications = result.records.map(record => ({
        title: record.get('Publicacion'),
        comments: record.get('Comentarios').low || record.get('Comentarios'),
        reactions: record.get('Reacciones').low || record.get('Reacciones'),
        engagement: record.get('Engagement').low || record.get('Engagement')
      }));
      res.json({ topEngagedPublications: publications });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * 3️⃣ Suggest Conferences for a User
   * Sugiere hasta 5 conferencias para el usuario basado en los intereses (categorías) asociados a publicaciones.
   */
  /**
 * @swagger
 * /advanced/suggest-conferences/{userId}:
 *   get:
 *     summary: Obtiene conferencias recomendadas para un usuario
 *     description: Retorna hasta 5 conferencias basadas en los intereses del usuario y publicaciones relacionadas.
 *     tags:
 *       - AdvancedQueries
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario para quien se generarán las recomendaciones de conferencias.
 *     responses:
 *       200:
 *         description: Lista de conferencias recomendadas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestedConferences:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       conference:
 *                         type: object
 *                         description: Información sobre la conferencia recomendada.
 *                         example: { "nombre": "Tech Summit 2024", "ubicación": "San Francisco", "fecha": "2024-09-10" }
 *                       relevance:
 *                         type: integer
 *                         description: Nivel de relevancia de la conferencia para el usuario.
 *                         example: 5
 *       400:
 *         description: ID de usuario inválido.
 *       500:
 *         description: Error en el servidor al ejecutar la consulta.
 */

  router.get('/suggest-conferences/:userId', async (req, res) => {
    const session = driver.session();
    const userId = parseInt(req.params.userId, 10);
    try {
      const query = `
        MATCH (u:Usuario {id: $userId})-[:TIENE_INTERÉS_EN]->(cat:Categoría)
        <-[:RELACIONADO_CON]-(p:Publicación)-[:PRESENTADA_EN]->(conf:Conferencia)
        RETURN conf, count(p) AS relevancia
        ORDER BY relevancia DESC
        LIMIT 10
      `;
      const result = await session.run(query, { userId });
      const conferences = result.records.map(record => ({
        conference: record.get('conf').properties,
        relevance: record.get('relevancia').low || record.get('relevancia')
      }));
      res.json({ suggestedConferences: conferences });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  

  
  /**
   * 5️⃣ Network Summary
   * Proporciona un resumen del grafo, contando nodos y relaciones por tipo.
   */
  /**
 * @swagger
 * /advanced/network-summary:
 *   get:
 *     summary: Obtiene un resumen de la red
 *     description: Retorna un resumen con la cantidad de nodos y relaciones en la base de datos de Neo4j.
 *     tags:
 *       - AdvancedQueries
 *     responses:
 *       200:
 *         description: Resumen de la red con nodos y relaciones.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 networkSummary:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         description: Indica si es un nodo o una relación.
 *                         example: "Nodo"
 *                       name:
 *                         type: string
 *                         description: Nombre del nodo o tipo de relación.
 *                         example: "Usuario"
 *                       count:
 *                         type: integer
 *                         description: Cantidad de nodos o relaciones de ese tipo.
 *                         example: 1500
 *       500:
 *         description: Error en el servidor al ejecutar la consulta.
 */

  router.get('/network-summary', async (req, res) => {
    const session = driver.session();
    try {
      const query = `
        MATCH (n)
        RETURN 'Nodo' AS Tipo, labels(n)[0] AS Nombre, count(n) AS Cantidad
        UNION ALL
        MATCH ()-[r]->()
        RETURN 'Relación' AS Tipo, type(r) AS Nombre, count(r) AS Cantidad
      `;
      const result = await session.run(query);
      const summary = result.records.map(record => ({
        type: record.get('Tipo'),
        name: record.get('Nombre'),
        count: record.get('Cantidad').low || record.get('Cantidad')
      }));
      res.json({ networkSummary: summary });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  

module.exports = router;
