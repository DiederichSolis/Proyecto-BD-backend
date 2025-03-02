const express = require('express');
const { Parser } = require('json2csv');
const pdf = require('pdfkit');
const fs = require('fs');
const router = express.Router();
const { driver } = require('../db');

// 📌 Exportar usuarios en CSV
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