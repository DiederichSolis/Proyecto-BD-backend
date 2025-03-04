const express = require('express');
const { Parser } = require('json2csv');
const pdf = require('pdfkit');
const fs = require('fs');
const router = express.Router();
const { driver } = require('../db');

// 📌 Exportar usuarios en CSV
/**
 * @swagger
 *  /api/export/users/csv:
 *   get:
 *     summary: Exporta la lista de usuarios en formato CSV
 *     description: Genera y descarga un archivo CSV con información de los usuarios registrados en la base de datos.
 *     tags:
 *       - ExportRankingTrends
 *     responses:
 *       200:
 *         description: Archivo CSV generado con la lista de usuarios.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Error en el servidor al exportar el archivo CSV.
 */

router.get('/export/users/csv', async (req, res) => {
    const session = driver.session();
    try {
        const result = await session.run(`MATCH (u:Usuario) RETURN u.nombre AS Nombre, u.rol AS Rol, u.universidad AS Universidad, u.reputación AS Reputación`);
        const users = result.records.map(record => record.toObject());

        const parser = new Parser();
        const csv = parser.parse(users);

        res.header('Content-Type', 'text/csv');
        res.attachment('usuarios.csv');
        return res.send(csv);
    } catch (error) {
        res.status(500).json({ error: 'Error exportando CSV', details: error.message });
    } finally {
        await session.close();
    }
});

// 📌 Exportar usuarios en PDF
/**
 * @swagger
 * /api/export/users/pdf:
 *   get:
 *     summary: Exporta la lista de usuarios en formato PDF
 *     description: Genera y descarga un archivo PDF con información de los usuarios registrados en la base de datos.
 *     tags:
 *       - ExportRankingTrends
 *     responses:
 *       200:
 *         description: Archivo PDF generado con la lista de usuarios.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Error en el servidor al exportar el archivo PDF.
 */

router.get('/export/users/pdf', async (req, res) => {
    const session = driver.session();
    try {
        const result = await session.run(`MATCH (u:Usuario) RETURN u.nombre AS Nombre, u.rol AS Rol, u.universidad AS Universidad, u.reputación AS Reputación`);
        const users = result.records.map(record => record.toObject());

        const doc = new pdf();
        res.setHeader('Content-Disposition', 'attachment; filename=usuarios.pdf');
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        doc.fontSize(16).text('Lista de Usuarios', { align: 'center' });
        doc.moveDown();

        users.forEach(user => {
            doc.fontSize(12).text(`Nombre: ${user.Nombre}`);
            doc.text(`Rol: ${user.Rol}`);
            doc.text(`Universidad: ${user.Universidad}`);
            doc.text(`Reputación: ${user.Reputación}`);
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        res.status(500).json({ error: 'Error exportando PDF', details: error.message });
    } finally {
        await session.close();
    }
});

// 📌 Ranking de publicaciones por reputación académica
/**
 * @swagger
 * /api/ranking/publications:
 *   get:
 *     summary: Obtiene el ranking de las 10 publicaciones más relevantes
 *     description: Retorna las 10 publicaciones con mayor reputación, calculada en función de citas, reacciones y comentarios.
 *     tags:
 *       - ExportRankingTrends
 *     responses:
 *       200:
 *         description: Lista de las 10 publicaciones con mayor reputación.
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
 *                       Título:
 *                         type: string
 *                         description: Título de la publicación.
 *                         example: "Avances en inteligencia artificial"
 *                       Citas:
 *                         type: integer
 *                         description: Número de citas de la publicación.
 *                         example: 25
 *                       Reacciones:
 *                         type: integer
 *                         description: Número de reacciones que recibió la publicación.
 *                         example: 150
 *                       Comentarios:
 *                         type: integer
 *                         description: Número de comentarios en la publicación.
 *                         example: 45
 *                       Reputación:
 *                         type: integer
 *                         description: Puntuación de reputación basada en la fórmula (Citas + Reacciones * 2 + Comentarios * 3).
 *                         example: 460
 *       500:
 *         description: Error en el servidor al obtener el ranking de publicaciones.
 */

router.get('/ranking/publications', async (req, res) => {
    const session = driver.session();
    try {
        const query = `
        MATCH (p:Publicación)
        OPTIONAL MATCH (p)<-[:REACCIONA_A]-(u:Usuario)
        OPTIONAL MATCH (p)<-[:COMENTA_EN]-(c:Usuario)
        RETURN p.título AS Título, 
               p.citas AS Citas, 
               COUNT(u) AS Reacciones, 
               COUNT(c) AS Comentarios,
               (p.citas + COUNT(u) * 2 + COUNT(c) * 3) AS Reputación
        ORDER BY Reputación DESC
        LIMIT 10
        `;

        const result = await session.run(query);
        const publications = result.records.map(record => record.toObject());

        res.json({ publications });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo ranking', details: error.message });
    } finally {
        await session.close();
    }
});

// 📌 Identificar categorías de investigación emergentes
/**
 * @swagger
 * /api/trends/research:
 *   get:
 *     summary: Obtiene las 5 categorías de investigación más populares en los últimos 6 meses
 *     description: Retorna las categorías con más publicaciones recientes en los últimos 6 meses.
 *     tags:
 *       - ExportRankingTrends
 *     responses:
 *       200:
 *         description: Lista de las categorías de investigación con más publicaciones recientes.
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
 *                       Categoría:
 *                         type: string
 *                         description: Nombre de la categoría de investigación.
 *                         example: "Inteligencia Artificial"
 *                       PublicacionesRecientes:
 *                         type: integer
 *                         description: Número de publicaciones en esta categoría en los últimos 6 meses.
 *                         example: 120
 *       500:
 *         description: Error en el servidor al obtener las tendencias de investigación.
 */

router.get('/trends/research', async (req, res) => {
    const session = driver.session();
    try {
        const query = `
        MATCH (p:Publicación)-[:RELACIONADO_CON]->(c:Categoría)
        WHERE p.fecha_publicación >= date() - duration({ months: 6 })  // Últimos 6 meses
        RETURN c.nombre AS Categoría, 
               COUNT(p) AS PublicacionesRecientes
        ORDER BY PublicacionesRecientes DESC
        LIMIT 5
        `;

        const result = await session.run(query);
        const trends = result.records.map(record => record.toObject());

        res.json({ trends });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo tendencias', details: error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;