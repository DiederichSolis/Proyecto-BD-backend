const express = require('express');
const router = express.Router();
const { driver } = require('../db');

/**
 * 1️⃣ Influential Users (Usuarios Influyentes)
 * Retorna los 5 usuarios con mayor número de seguidores (basado en la relación SIGUE_A)
 */
router.get('/influential-users', async (req, res) => {
  const session = driver.session();
  try {
    const query = `
      MATCH (u:Usuario)<-[:SIGUE_A]-(other)
      RETURN u.nombre AS Usuario, COUNT(other) AS Influencia
      ORDER BY Influencia DESC
      LIMIT 5
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
        LIMIT 5
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
  router.get('/suggest-conferences/:userId', async (req, res) => {
    const session = driver.session();
    const userId = parseInt(req.params.userId, 10);
    try {
      const query = `
        MATCH (u:Usuario {id: $userId})-[:TIENE_INTERÉS_EN]->(cat:Categoría)
        <-[:RELACIONADO_CON]-(p:Publicación)-[:PRESENTADA_EN]->(conf:Conferencia)
        RETURN conf, count(p) AS relevancia
        ORDER BY relevancia DESC
        LIMIT 5
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
