const express = require('express');
const router = express.Router();
const { driver } = require('../db');

// 📌 Crear un nodo con 1 label y propiedades
router.post('/create', async (req, res) => {
    const { label, properties } = req.body;
    const session = driver.session();
    try {
      if (label === 'Usuario') {
        const maxQuery = `MATCH (n:Usuario) RETURN max(n.id) AS maxId`;
        const maxResult = await session.run(maxQuery);
        let maxId = maxResult.records[0].get('maxId');
  
        // Convertir BigInt a Number si es necesario
        maxId = maxId ? Number(maxId) : 0;
        properties.id = maxId + 1;
      }
  
      const query = `CREATE (n:${label} $properties) RETURN n`;
      const result = await session.run(query, { properties });
      res.json(result.records[0].get('n').properties);
    } catch (error) {
      console.error('Error al crear nodo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
      await session.close();
    }
  });
  
// 📌 Obtener todos los nodos de un tipo
router.get('/:label', async (req, res) => {
    const { label } = req.params;
    // Convertir skip y limit usando parseInt para asegurarnos de que sean enteros
    const skip = parseInt(req.query.skip || "0", 10);
    const limit = parseInt(req.query.limit || "100", 10);

    const session = driver.session();
    try {
      // Incrustar los valores en el query en lugar de pasarlos como parámetros
      const query = `
        MATCH (n:${label}) 
        RETURN n 
        SKIP ${skip} LIMIT ${limit}
      `;
      const result = await session.run(query);
      const nodes = result.records.map(record => record.get('n').properties);
      res.json(nodes);
    } catch (error) {
      console.error('Error al obtener nodos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
      await session.close();
    }
  });  

// 📌 Obtener un nodo por ID
router.get('/:label/:id', async (req, res) => {
  const { label, id } = req.params;
  const session = driver.session();
  try {
    const query = `MATCH (n:${label} {id: $id}) RETURN n`;
    const result = await session.run(query, { id: parseInt(id) });
    if (result.records.length === 0) return res.status(404).json({ error: 'Nodo no encontrado' });
    res.json(result.records[0].get('n').properties);
  } catch (error) {
    console.error('Error al obtener nodo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    await session.close();
  }
});

// 📌 Actualizar propiedades de un nodo
router.put('/update/:label/:id', async (req, res) => {
  const { label, id } = req.params;
  const properties = req.body;
  const session = driver.session();
  try {
    const query = `
      MATCH (n:${label} {id: $id}) 
      SET n += $properties 
      RETURN n
    `;
    const result = await session.run(query, { id: parseInt(id), properties });
    if (result.records.length === 0) return res.status(404).json({ error: 'Nodo no encontrado' });
    res.json(result.records[0].get('n').properties);
  } catch (error) {
    console.error('Error al actualizar nodo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    await session.close();
  }
});

// 📌 Eliminar un nodo
router.delete('/delete/:label/:id', async (req, res) => {
  const { label, id } = req.params;
  const session = driver.session();
  try {
    const query = `MATCH (n:${label} {id: $id}) DETACH DELETE n`;
    await session.run(query, { id: parseInt(id) });
    res.json({ message: 'Nodo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar nodo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    await session.close();
  }
});

module.exports = router;