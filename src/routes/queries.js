const express = require('express');
const router = express.Router();
const { driver } = require('../db');

/**
 * 1️⃣ Recomendaciones de Publicaciones para un Usuario
 * GET /queries/recommend-publications/:userId
 * Retorna las 5 publicaciones con mayor impacto relacionadas a las categorías de interés del usuario.
 */

/**
 * @swagger
 * /queries/recommend-publications/{userId}:
 *   get:
 *     summary: Obtiene recomendaciones de publicaciones para un usuario
 *     description: Retorna hasta 5 publicaciones recomendadas basadas en los intereses del usuario, ordenadas por impacto.
 *     tags:
 *       - Queries
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario para quien se generarán las recomendaciones de publicaciones.
 *     responses:
 *       200:
 *         description: Lista de publicaciones recomendadas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       publication:
 *                         type: object
 *                         description: Información sobre la publicación recomendada.
 *                         example: { "título": "Avances en Machine Learning", "autor": "John Doe", "impacto": 95 }
 *                       category:
 *                         type: object
 *                         description: Información sobre la categoría de la publicación recomendada.
 *                         example: { "nombre": "Inteligencia Artificial" }
 *       400:
 *         description: ID de usuario inválido.
 *       500:
 *         description: Error en el servidor al generar recomendaciones.
 */

router.get('/recommend-publications/:userId', async (req, res) => {
  const session = driver.session();
  const userId = parseInt(req.params.userId, 10);
  try {
    const query = `
      MATCH (u:Usuario {id: $userId})-[:TIENE_INTERÉS_EN]->(cat:Categoría)<-[:RELACIONADO_CON]-(p:Publicación)
      RETURN p, cat
      ORDER BY p.impacto DESC
      LIMIT 5
    `;
    const result = await session.run(query, { userId });
    const publications = result.records.map(record => ({
      publication: record.get('p').properties,
      category: record.get('cat').properties
    }));
    res.json({ publications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/**
 * 2️⃣ Sugerencia de Colaboradores Potenciales
 * GET /queries/suggest-collaborators/:userId
 * Sugiere hasta 5 usuarios que comparten intereses con el usuario y a los que este no sigue.
 */

/**
 * @swagger
 * /queries/suggest-collaborators/{userId}:
 *   get:
 *     summary: Sugiere posibles colaboradores para un usuario
 *     description: Retorna hasta 5 usuarios con intereses comunes, que aún no han sido seguidos por el usuario especificado.
 *     tags:
 *       - Queries
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario para quien se generarán las recomendaciones de colaboradores.
 *     responses:
 *       200:
 *         description: Lista de posibles colaboradores.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 collaborators:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         description: Información sobre el usuario recomendado como colaborador.
 *                         example: { "nombre": "Ana López", "universidad": "MIT", "especialidad": "Ciencia de Datos" }
 *                       commonInterests:
 *                         type: integer
 *                         description: Número de intereses en común con el usuario.
 *                         example: 3
 *       400:
 *         description: ID de usuario inválido.
 *       500:
 *         description: Error en el servidor al generar recomendaciones de colaboradores.
 */

router.get('/suggest-collaborators/:userId', async (req, res) => {
  const session = driver.session();
  const userId = parseInt(req.params.userId, 10);
  try {
    const query = `
      MATCH (u:Usuario {id: $userId})-[:TIENE_INTERÉS_EN]->(cat:Categoría)<-[:TIENE_INTERÉS_EN]-(other:Usuario)
      WHERE NOT (u)-[:SIGUE_A]->(other) AND u <> other
      RETURN other, count(cat) AS interesesComunes
      ORDER BY interesesComunes DESC
      LIMIT 5
    `;
    const result = await session.run(query, { userId });
    const collaborators = result.records.map(record => ({
      user: record.get('other').properties,
      commonInterests: record.get('interesesComunes').low || record.get('interesesComunes')
    }));
    res.json({ collaborators });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/**
 * 3️⃣ Tendencias en Publicaciones por Categoría
 * GET /queries/trending-categories
 * Retorna las 5 categorías con mayor número de publicaciones a partir de una fecha determinada.
 */
/**
 * @swagger
 * /queries/trending-categories:
 *   get:
 *     summary: Obtiene las 5 categorías con más publicaciones recientes
 *     description: Retorna las categorías con mayor número de publicaciones desde el 1 de enero de 2024.
 *     tags:
 *       - Queries
 *     responses:
 *       200:
 *         description: Lista de las categorías en tendencia.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 trends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                         description: Nombre de la categoría en tendencia.
 *                         example: "Inteligencia Artificial"
 *                       publicationCount:
 *                         type: integer
 *                         description: Número de publicaciones recientes en la categoría.
 *                         example: 120
 *       500:
 *         description: Error en el servidor al obtener las categorías en tendencia.
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
    res.json({ trends });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/**
 * 4️⃣ Recomendación de Conferencias para un Usuario
 * GET /queries/suggest-conferences/:userId
 * Sugiere hasta 5 conferencias basadas en las categorías de interés relacionadas a publicaciones.
 */

/**
 * @swagger
 * /queries/suggest-conferences/{userId}:
 *   get:
 *     summary: Sugiere conferencias relevantes para un usuario
 *     description: Retorna hasta 5 conferencias basadas en los intereses del usuario y publicaciones relacionadas.
 *     tags:
 *       - Queries
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
 *                 conferences:
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
 *         description: Error en el servidor al generar recomendaciones de conferencias.
 */
router.get('/suggest-conferences/:userId', async (req, res) => {
  const session = driver.session();
  const userId = parseInt(req.params.userId, 10);
  try {
    const query = `
      MATCH (u:Usuario {id: $userId})-[:TIENE_INTERÉS_EN]->(cat:Categoría)<-[:RELACIONADO_CON]-(p:Publicación)-[:PRESENTADA_EN]->(conf:Conferencia)
      RETURN conf, count(p) AS relevancia
      ORDER BY relevancia DESC
      LIMIT 5
    `;
    const result = await session.run(query, { userId });
    const conferences = result.records.map(record => ({
      conference: record.get('conf').properties,
      relevance: record.get('relevancia').low || record.get('relevancia')
    }));
    res.json({ conferences });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/**
 * 5️⃣ Usuarios Más Influyentes
 * GET /queries/influential-users
 * Retorna los 5 usuarios con mayor suma de impacto en sus publicaciones.
 */

/**
 * @swagger
 * /queries/influential-users:
 *   get:
 *     summary: Obtiene los 5 usuarios más influyentes
 *     description: Retorna los 5 usuarios con mayor impacto total basado en la suma del impacto de sus publicaciones.
 *     tags:
 *       - Queries
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
 *                       totalImpact:
 *                         type: integer
 *                         description: Suma del impacto de todas sus publicaciones.
 *                         example: 850
 *       500:
 *         description: Error en el servidor al obtener los usuarios influyentes.
 */

router.get('/influential-users', async (req, res) => {
  const session = driver.session();
  try {
    const query = `
      MATCH (u:Usuario)-[:PUBLICA]->(p:Publicación)
      RETURN u.nombre AS Usuario, sum(p.impacto) AS ImpactoTotal
      ORDER BY ImpactoTotal DESC
      LIMIT 5
    `;
    const result = await session.run(query);
    const users = result.records.map(record => ({
      name: record.get('Usuario'),
      totalImpact: record.get('ImpactoTotal').low || record.get('ImpactoTotal')
    }));
    res.json({ influentialUsers: users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

/**
 * 6️⃣ Nivel de Engagement de las Publicaciones
 * GET /queries/publication-engagement
 * Calcula el engagement de las publicaciones basado en el número de comentarios y reacciones.
 */

/**
 * @swagger
 * /queries/publication-engagement:
 *   get:
 *     summary: Obtiene las 5 publicaciones con mayor engagement
 *     description: Retorna las publicaciones con más interacciones (comentarios + reacciones), ordenadas por engagement en orden descendente.
 *     tags:
 *       - Queries
 *     responses:
 *       200:
 *         description: Lista de las 5 publicaciones con mayor engagement.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicationEngagement:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       publication:
 *                         type: string
 *                         description: Título de la publicación.
 *                         example: "El impacto de la IA en la educación"
 *                       comments:
 *                         type: integer
 *                         description: Número de comentarios en la publicación.
 *                         example: 35
 *                       reactions:
 *                         type: integer
 *                         description: Número de reacciones en la publicación.
 *                         example: 120
 *                       engagement:
 *                         type: integer
 *                         description: Total de interacciones (comentarios + reacciones).
 *                         example: 155
 *       500:
 *         description: Error en el servidor al obtener el engagement de publicaciones.
 */

router.get('/publication-engagement', async (req, res) => {
  const session = driver.session();
  try {
    const query = `
      MATCH (p:Publicación)
      OPTIONAL MATCH (p)<-[c:COMENTA_EN]-()
      OPTIONAL MATCH (p)<-[r:REACCIONA_A]-()
      RETURN p.título AS Publicacion, count(DISTINCT c) AS Comentarios, count(DISTINCT r) AS Reacciones,
             (count(DISTINCT c) + count(DISTINCT r)) AS Engagement
      ORDER BY Engagement DESC
      LIMIT 5
    `;
    const result = await session.run(query);
    const engagements = result.records.map(record => ({
      publication: record.get('Publicacion'),
      comments: record.get('Comentarios').low || record.get('Comentarios'),
      reactions: record.get('Reacciones').low || record.get('Reacciones'),
      engagement: record.get('Engagement').low || record.get('Engagement')
    }));
    res.json({ publicationEngagement: engagements });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

module.exports = router;
