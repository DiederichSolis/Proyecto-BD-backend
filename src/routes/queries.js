const express = require('express');
const router = express.Router();
const { driver } = require('../db');

/**
 * 1️⃣ Recomendaciones de Publicaciones para un Usuario
 * GET /queries/recommend-publications/:userId
 * Retorna las 5 publicaciones con mayor impacto relacionadas a las categorías de interés del usuario.
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
router.get('/trending-categories', async (req, res) => {
  const session = driver.session();
  try {
    const query = `
      MATCH (p:Publicación)-[:RELACIONADO_CON]->(cat:Categoría)
      WHERE p.fecha_publicación > date("2024-01-01")
      RETURN cat.nombre AS Categoria, count(p) AS NumeroDePublicaciones
      ORDER BY NumeroDePublicaciones DESC
      LIMIT 5
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
