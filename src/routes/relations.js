const express = require('express');
const router = express.Router();
const { driver } = require('../db');

// Función para sanitizar labels y tipos de relaciones
function sanitizeLabel(label) {
  return label.replace(/[^\p{L}\p{N}_]/gu, '');
}

/**
 * @swagger
 * /relations/{label1}/{id1}/{relation}/{label2}/{id2}:
 *   post:
 *     summary: Crea una relación entre dos nodos existentes.
 *     tags:
 *       - Relations
 *     parameters:
 *       - in: path
 *         name: label1
 *         required: true
 *         description: Etiqueta del primer nodo.
 *         schema:
 *           type: string
 *       - in: path
 *         name: id1
 *         required: true
 *         description: ID del primer nodo.
 *         schema:
 *           type: integer
 *       - in: path
 *         name: relation
 *         required: true
 *         description: Tipo de relación entre los nodos.
 *         schema:
 *           type: string
 *       - in: path
 *         name: label2
 *         required: true
 *         description: Etiqueta del segundo nodo.
 *         schema:
 *           type: string
 *       - in: path
 *         name: id2
 *         required: true
 *         description: ID del segundo nodo.
 *         schema:
 *           type: integer
 *       - in: body
 *         name: properties
 *         required: true
 *         description: Propiedades de la relación.
 *         schema:
 *           type: object
 *           properties:
 *             fecha:
 *               type: string
 *               format: date
 *               example: "2024-03-01"
 *     responses:
 *       201:
 *         description: Relación creada exitosamente.
 *       400:
 *         description: Datos inválidos en la solicitud.
 */
router.post('/:label1/:id1/:relation/:label2/:id2', async (req, res) => {
  const session = driver.session();
  const label1 = sanitizeLabel(req.params.label1);
  const label2 = sanitizeLabel(req.params.label2);
  const relation = sanitizeLabel(req.params.relation);
  const id1 = parseInt(req.params.id1);
  const id2 = parseInt(req.params.id2);
  const properties = req.body;

  if (!properties || Object.keys(properties).length < 3) {
    return res.status(400).json({ error: "Se requieren al menos 3 propiedades para la relación." });
  }

  try {
    const query = `
      MATCH (a:${label1} {id: $id1}), (b:${label2} {id: $id2})
      CREATE (a)-[r:${relation} $properties]->(b)
      RETURN r
    `;

    const result = await session.run(query, { id1, id2, properties });

    if (result.records.length === 0) {
      return res.status(404).json({ error: "No se pudieron encontrar los nodos especificados." });
    }

    res.status(201).json({ message: "Relación creada exitosamente", relation: result.records[0].get("r").properties });
  } catch (error) {
    console.error("Error al crear la relación:", error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});



/**
 * 1️⃣ Agregar propiedades a una relación específica
 * PATCH /relations/update/:label1/:id1/:relation/:label2/:id2
 */
router.patch('/update/:label1/:id1/:relation/:label2/:id2', async (req, res) => {
    const session = driver.session();
    const label1 = sanitizeLabel(req.params.label1);
    const label2 = sanitizeLabel(req.params.label2);
    const relation = sanitizeLabel(req.params.relation);
    const id1 = parseInt(req.params.id1);
    const id2 = parseInt(req.params.id2);
    const properties = req.body;
  
    if (!properties || Object.keys(properties).length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades para agregar." });
    }
  
    try {
      const setQuery = Object.keys(properties).map(key => `r.${key} = $${key}`).join(', ');
      const query = `
        MATCH (a:${label1} {id: $id1})-[r:${relation}]->(b:${label2} {id: $id2})
        SET ${setQuery}
        RETURN r
      `;
  
      const result = await session.run(query, { id1, id2, ...properties });
  
      if (result.records.length === 0) {
        return res.status(404).json({ error: "Relación no encontrada." });
      }
  
      res.json({ message: "Propiedades agregadas con éxito", relation: result.records[0].get("r").properties });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * 2️⃣ Agregar propiedades a múltiples relaciones
   * PATCH /relations/update/:relation
   */
  router.patch('/update/:relation', async (req, res) => {
    const session = driver.session();
    const relation = sanitizeLabel(req.params.relation);
    const { filter, properties } = req.body;
  
    if (!properties || Object.keys(properties).length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades para agregar." });
    }
    if (!filter || Object.keys(filter).length === 0) {
      return res.status(400).json({ error: "Se requiere un filtro para aplicar la actualización." });
    }
  
    try {
      const filterConditions = Object.keys(filter).map(key => `r.${key} = $${key}`).join(' AND ');
      const setQuery = Object.keys(properties).map(key => `r.${key} = $${key}`).join(', ');
  
      const query = `
        MATCH ()-[r:${relation}]->()
        WHERE ${filterConditions}
        SET ${setQuery}
        RETURN count(r) AS updatedCount
      `;
  
      const result = await session.run(query, { ...filter, ...properties });
      res.json({ message: `Propiedades agregadas a ${result.records[0].get("updatedCount").low} relaciones.` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * 3️⃣ Actualizar propiedades de una relación específica
   * PUT /relations/update/:label1/:id1/:relation/:label2/:id2
   */
  router.put('/update/:label1/:id1/:relation/:label2/:id2', async (req, res) => {
    const session = driver.session();
    const label1 = sanitizeLabel(req.params.label1);
    const label2 = sanitizeLabel(req.params.label2);
    const relation = sanitizeLabel(req.params.relation);
    const id1 = parseInt(req.params.id1);
    const id2 = parseInt(req.params.id2);
    const properties = req.body;
  
    if (!properties || Object.keys(properties).length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades para actualizar." });
    }
  
    try {
      const setQuery = Object.keys(properties).map(key => `r.${key} = $${key}`).join(', ');
      const query = `
        MATCH (a:${label1} {id: $id1})-[r:${relation}]->(b:${label2} {id: $id2})
        SET ${setQuery}
        RETURN r
      `;
  
      const result = await session.run(query, { id1, id2, ...properties });
  
      if (result.records.length === 0) {
        return res.status(404).json({ error: "Relación no encontrada." });
      }
  
      res.json({ message: "Propiedades actualizadas con éxito", relation: result.records[0].get("r").properties });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * 4️⃣ Eliminar una o más propiedades de una relación
   * DELETE /relations/properties/:label1/:id1/:relation/:label2/:id2
   */
  router.delete('/properties/:label1/:id1/:relation/:label2/:id2', async (req, res) => {
    const session = driver.session();
    const label1 = sanitizeLabel(req.params.label1);
    const label2 = sanitizeLabel(req.params.label2);
    const relation = sanitizeLabel(req.params.relation);
    const id1 = parseInt(req.params.id1);
    const id2 = parseInt(req.params.id2);
    const { properties } = req.body;
  
    if (!properties || properties.length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades a eliminar." });
    }
  
    try {
      const removeQuery = properties.map(key => `REMOVE r.${key}`).join(' ');
      const query = `
        MATCH (a:${label1} {id: $id1})-[r:${relation}]->(b:${label2} {id: $id2})
        ${removeQuery}
        RETURN r
      `;
  
      await session.run(query, { id1, id2 });
      res.json({ message: `Propiedades eliminadas: ${properties.join(', ')}` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });

  /**
 * 5️⃣ Actualizar propiedades en múltiples relaciones al mismo tiempo
 * PUT /relations/update/:relation
 */
router.put('/update/:relation', async (req, res) => {
    const session = driver.session();
    const relation = sanitizeLabel(req.params.relation);
    const { filter, properties } = req.body;
  
    if (!properties || Object.keys(properties).length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades para actualizar." });
    }
    if (!filter || Object.keys(filter).length === 0) {
      return res.status(400).json({ error: "Se requiere al menos un filtro para actualizar múltiples relaciones." });
    }
  
    try {
      // Construcción de condiciones del filtro
      const filterConditions = Object.keys(filter).map(key => `r.${key} = $${key}`).join(' AND ');
      const setQuery = Object.keys(properties).map(key => `r.${key} = $${key}`).join(', ');
  
      const query = `
        MATCH ()-[r:${relation}]->()
        WHERE ${filterConditions}
        SET ${setQuery}
        RETURN count(r) AS updatedCount
      `;
  
      const result = await session.run(query, { ...filter, ...properties });
      const updatedCount = result.records[0].get("updatedCount").low;
  
      res.json({ message: `Propiedades actualizadas en ${updatedCount} relaciones.` });
    } catch (error) {
      console.error("Error al actualizar múltiples relaciones:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * 6️⃣ Eliminar una o más propiedades de múltiples relaciones al mismo tiempo
   * DELETE /relations/properties/:relation
   */
  router.delete('/properties/:relation', async (req, res) => {
    const session = driver.session();
    const relation = sanitizeLabel(req.params.relation);
    const { filter, properties } = req.body;
  
    if (!properties || properties.length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades a eliminar." });
    }
    if (!filter || Object.keys(filter).length === 0) {
      return res.status(400).json({ error: "Se requiere un filtro para eliminar propiedades de múltiples relaciones." });
    }
  
    try {
      const filterConditions = Object.keys(filter).map(key => `r.${key} = $${key}`).join(' AND ');
      const removeQuery = properties.map(key => `REMOVE r.${key}`).join(' ');
  
      const query = `
        MATCH ()-[r:${relation}]->()
        WHERE ${filterConditions}
        ${removeQuery}
        RETURN count(r) AS updatedCount
      `;
  
      const result = await session.run(query, { ...filter });
      const updatedCount = result.records[0].get("updatedCount").low;
  
      res.json({ message: `Propiedades eliminadas en ${updatedCount} relaciones.` });
    } catch (error) {
      console.error("Error al eliminar propiedades de múltiples relaciones:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });  

  /**
 * 1️⃣ Eliminar una relación específica entre dos nodos
 * DELETE /relations/:label1/:id1/:relation/:label2/:id2
 */
router.delete('/:label1/:id1/:relation/:label2/:id2', async (req, res) => {
    const session = driver.session();
    const label1 = sanitizeLabel(req.params.label1);
    const label2 = sanitizeLabel(req.params.label2);
    const relation = sanitizeLabel(req.params.relation);
    const id1 = parseInt(req.params.id1);
    const id2 = parseInt(req.params.id2);
  
    try {
      // Verificar si la relación existe
      const checkQuery = `
        MATCH (a:${label1} {id: $id1})-[r:${relation}]->(b:${label2} {id: $id2})
        RETURN r
      `;
      const checkResult = await session.run(checkQuery, { id1, id2 });
  
      if (checkResult.records.length === 0) {
        return res.status(404).json({ error: "Relación no encontrada." });
      }
  
      // Eliminar la relación
      const deleteQuery = `
        MATCH (a:${label1} {id: $id1})-[r:${relation}]->(b:${label2} {id: $id2})
        DELETE r
      `;
      await session.run(deleteQuery, { id1, id2 });
  
      res.json({ message: `Relación ${relation} eliminada exitosamente entre ${label1} (ID ${id1}) y ${label2} (ID ${id2}).` });
    } catch (error) {
      console.error("Error al eliminar relación:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * 2️⃣ Eliminar múltiples relaciones según un filtro
   * DELETE /relations/:relation
   */
  router.delete('/:relation', async (req, res) => {
    const session = driver.session();
    const relation = sanitizeLabel(req.params.relation);
    const { filter } = req.body;
  
    if (!filter || Object.keys(filter).length === 0) {
      return res.status(400).json({ error: "Se requiere un filtro para eliminar relaciones." });
    }
  
    try {
      // Construcción de condiciones del filtro
      const filterConditions = Object.keys(filter).map(key => `r.${key} = $${key}`).join(' AND ');
  
      // Verificar cuántas relaciones cumplen el filtro
      const countQuery = `MATCH ()-[r:${relation}]->() WHERE ${filterConditions} RETURN count(r) AS total`;
      const countResult = await session.run(countQuery, filter);
      const total = countResult.records[0].get("total").low;
  
      if (total === 0) {
        return res.status(404).json({ error: "No se encontraron relaciones con el filtro especificado." });
      }
  
      // Eliminar las relaciones
      const deleteQuery = `MATCH ()-[r:${relation}]->() WHERE ${filterConditions} DELETE r`;
      await session.run(deleteQuery, filter);
  
      res.json({ message: `${total} relaciones ${relation} eliminadas exitosamente.` });
    } catch (error) {
      console.error("Error al eliminar múltiples relaciones:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  

module.exports = router;