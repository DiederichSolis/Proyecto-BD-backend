const express = require('express');
const router = express.Router();
const { driver } = require('../db');

// Crear un nodo con ID incremental y label en la URL
router.post('/:label', async (req, res) => {
    const session = driver.session();
    const { label } = req.params; // Obtener el label desde la URL
    const properties = req.body; // Propiedades desde el body

    if (!properties || Object.keys(properties).length === 0) {
        return res.status(400).json({ error: "Se requieren propiedades para el nodo." });
    }

    try {
        // Obtener el ID más alto dentro de los nodos del mismo tipo
        const getMaxIdQuery = `
            MATCH (n:${label})
            RETURN COALESCE(MAX(n.id), 0) AS maxId
        `;
        const result = await session.run(getMaxIdQuery);
        const maxId = result.records.length > 0 ? result.records[0].get('maxId').low : 0;

        // Incrementar el ID
        const newId = maxId + 1;
        properties.id = newId;

        // Crear el nodo con el ID autoincremental
        const createNodeQuery = `
            CREATE (n:${label} $properties)
            RETURN n
        `;
        const createResult = await session.run(createNodeQuery, { properties });
        const node = createResult.records[0].get('n').properties;

        res.status(201).json({ message: "Nodo creado exitosamente", node });
    } catch (error) {
        console.error("Error al crear nodo:", error);
        res.status(500).json({ error: "Error al crear nodo" });
    } finally {
        await session.close();
    }
});

// Función para sanitizar el label (solo letras, números y guión bajo)
function sanitizeLabel(label) {
    // Permite letras (incluyendo acentuadas), números y guión bajo
    return label.replace(/[^\p{L}\p{N}_]/gu, '');
  }

  // Función para convertir valores de query a su tipo correcto
function parseValue(val) {
    if (typeof val !== 'string') return val;
    const lower = val.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    if (!isNaN(val)) return Number(val);
    return val;
  }
  
  router.post('/create/:labels', async (req, res) => {
    const session = driver.session();
    try {
      // Obtener y sanitizar los labels
      const rawLabels = req.params.labels;
      if (!rawLabels) {
        return res.status(400).json({ error: "Se requieren labels." });
      }
      const labelsArr = rawLabels.split(',')
        .map(label => sanitizeLabel(label.trim()))
        .filter(label => label.length > 0);
      
      if (labelsArr.length === 0) {
        return res.status(400).json({ error: "Se requiere al menos un label válido." });
      }
      
      // Verificar las propiedades recibidas
      const properties = req.body;
      if (!properties || Object.keys(properties).length === 0) {
        return res.status(400).json({ error: "Se requieren propiedades para el nodo." });
      }
      
      // Usar el primer label para obtener el id máximo
      const primaryLabel = labelsArr[0];
      const matchQuery = `MATCH (n:${primaryLabel}) RETURN COALESCE(MAX(n.id), 0) AS maxId`;
      const result = await session.run(matchQuery);
      const maxId = result.records.length > 0 
        ? (result.records[0].get("maxId").toNumber ? result.records[0].get("maxId").toNumber() : result.records[0].get("maxId"))
        : 0;
      properties.id = maxId + 1;
      
      // Construir la cadena de labels: e.g. :Usuario:Investigador
      const labelsString = labelsArr.map(label => `:${label}`).join('');
      const createQuery = `CREATE (n${labelsString} $props) RETURN n`;
      
      const createResult = await session.run(createQuery, { props: properties });
      const node = createResult.records[0].get("n").properties;
      
      res.status(201).json({ message: "Nodo creado exitosamente", node });
    } catch (error) {
      console.error("Error al crear nodo:", error);
      res.status(500).json({ error: "Error al crear nodo", details: error.message });
    } finally {
      await session.close();
    }
  });


 /**
 * GET /nodes/read/:label
 * Consultar muchos nodos de un label, con filtros opcionales a través de query parameters.
 * Ejemplo: GET /nodes/read/Usuario?activo=true&rol=estudiante
 */
router.get('/read/:label', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const filters = req.query;
  
    try {
      let conditions = [];
      let params = {};
      
      // Crear condiciones a partir de los filtros enviados en la query, convirtiendo los valores
      Object.entries(filters).forEach(([key, value]) => {
        conditions.push(`n.${key} = $${key}`);
        params[key] = parseValue(value);
      });
      
      const query = `MATCH (n:${label}) ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''} RETURN n`;
      const result = await session.run(query, params);
      const nodes = result.records.map(record => record.get('n').properties);
      
      res.json({ nodes });
    } catch (error) {
      console.error("Error al consultar nodos:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * GET /nodes/read/:label/:id
   * Consultar un solo nodo de un label por su ID.
   * Ejemplo: GET /nodes/read/Usuario/5
   */
  router.get('/read/:label/:id', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const id = parseInt(req.params.id, 10);
    
    try {
      const query = `MATCH (n:${label} {id: $id}) RETURN n`;
      const result = await session.run(query, { id });
      
      if (result.records.length === 0) {
        return res.status(404).json({ error: 'Nodo no encontrado' });
      }
      
      const node = result.records[0].get('n').properties;
      res.json({ node });
    } catch (error) {
      console.error("Error al consultar nodo:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * GET /nodes/aggregate/:label
   * Realizar consultas agregadas sobre los nodos de un label.
   * Si se pasa el parámetro de query "groupBy", se agrupa por esa propiedad.
   * Ejemplos:
   *   - GET /nodes/aggregate/Publicación   (retorna el conteo total)
   *   - GET /nodes/aggregate/Publicación?groupBy=rol  (retorna el conteo por rol)
   */
  router.get('/aggregate/:label', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const groupBy = req.query.groupBy;
    
    try {
      let query;
      if (groupBy) {
        // Agrupar por la propiedad indicada
        query = `MATCH (n:${label}) RETURN n.${groupBy} AS group, count(n) AS count`;
      } else {
        // Solo contar los nodos
        query = `MATCH (n:${label}) RETURN count(n) AS count`;
      }
      
      const result = await session.run(query);
      const data = result.records.map(record => record.toObject());
      
      res.json({ data });
    } catch (error) {
      console.error("Error al realizar consulta agregada:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });

  // **1️⃣ Agregar una o más propiedades a un nodo específico**
router.patch('/update/:label/:id', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const id = parseInt(req.params.id);
    const properties = req.body;
  
    if (!properties || Object.keys(properties).length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades a agregar." });
    }
  
    try {
      const setQuery = Object.keys(properties).map(key => `n.${key} = $${key}`).join(', ');
      const query = `MATCH (n:${label} {id: $id}) SET ${setQuery} RETURN n`;
      
      const result = await session.run(query, { id, ...properties });
      
      if (result.records.length === 0) {
        return res.status(404).json({ error: "Nodo no encontrado." });
      }
  
      res.json({ message: "Propiedades agregadas con éxito", node: result.records[0].get("n").properties });
    } catch (error) {
      console.error("Error al agregar propiedades:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  // **2️⃣ Agregar una o más propiedades a múltiples nodos usando filtros**
  router.patch('/update/:label', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const { filter, properties } = req.body;
  
    if (!properties || Object.keys(properties).length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades a agregar." });
    }
    if (!filter || Object.keys(filter).length === 0) {
      return res.status(400).json({ error: "Se requiere al menos un filtro para actualizar múltiples nodos." });
    }
  
    try {
      const filterConditions = Object.keys(filter).map(key => `n.${key} = $${key}`).join(' AND ');
      const setQuery = Object.keys(properties).map(key => `n.${key} = $${key}`).join(', ');
  
      const query = `MATCH (n:${label}) WHERE ${filterConditions} SET ${setQuery} RETURN count(n) AS updatedCount`;
  
      const result = await session.run(query, { ...filter, ...properties });
      const updatedCount = result.records[0].get("updatedCount").low;
  
      res.json({ message: `Propiedades agregadas a ${updatedCount} nodos.` });
    } catch (error) {
      console.error("Error al agregar propiedades a múltiples nodos:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  // **3️⃣ Actualizar propiedades de un nodo específico**
  router.put('/update/:label/:id', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const id = parseInt(req.params.id);
    const properties = req.body;
  
    if (!properties || Object.keys(properties).length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades a actualizar." });
    }
  
    try {
      const setQuery = Object.keys(properties).map(key => `n.${key} = $${key}`).join(', ');
      const query = `MATCH (n:${label} {id: $id}) SET ${setQuery} RETURN n`;
  
      const result = await session.run(query, { id, ...properties });
  
      if (result.records.length === 0) {
        return res.status(404).json({ error: "Nodo no encontrado." });
      }
  
      res.json({ message: "Propiedades actualizadas con éxito", node: result.records[0].get("n").properties });
    } catch (error) {
      console.error("Error al actualizar propiedades:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  // **4️⃣ Actualizar propiedades de múltiples nodos con filtros**
  router.put('/update/:label', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const { filter, properties } = req.body;
  
    if (!properties || Object.keys(properties).length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades a actualizar." });
    }
    if (!filter || Object.keys(filter).length === 0) {
      return res.status(400).json({ error: "Se requiere al menos un filtro para actualizar múltiples nodos." });
    }
  
    try {
      const filterConditions = Object.keys(filter).map(key => `n.${key} = $${key}`).join(' AND ');
      const setQuery = Object.keys(properties).map(key => `n.${key} = $${key}`).join(', ');
  
      const query = `MATCH (n:${label}) WHERE ${filterConditions} SET ${setQuery} RETURN count(n) AS updatedCount`;
  
      const result = await session.run(query, { ...filter, ...properties });
      const updatedCount = result.records[0].get("updatedCount").low;
  
      res.json({ message: `Propiedades actualizadas en ${updatedCount} nodos.` });
    } catch (error) {
      console.error("Error al actualizar múltiples nodos:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  // **5️⃣ Eliminar una o más propiedades de un nodo específico**
  router.delete('/properties/:label/:id', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const id = parseInt(req.params.id);
    const { properties } = req.body;
  
    if (!properties || properties.length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades a eliminar." });
    }
  
    try {
      const removeQuery = properties.map(key => `REMOVE n.${key}`).join(' ');
      const query = `MATCH (n:${label} {id: $id}) ${removeQuery} RETURN n`;
  
      await session.run(query, { id });
  
      res.json({ message: `Propiedades eliminadas: ${properties.join(', ')}` });
    } catch (error) {
      console.error("Error al eliminar propiedades:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  

  router.delete('/properties/:label', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const { filter, properties } = req.body;
  
    if (!properties || properties.length === 0) {
      return res.status(400).json({ error: "Se requieren propiedades a eliminar." });
    }
    if (!filter || Object.keys(filter).length === 0) {
      return res.status(400).json({ error: "Se requiere al menos un filtro para eliminar propiedades en múltiples nodos." });
    }
  
    try {
      // Construcción de condiciones para el filtro
      const filterConditions = Object.keys(filter).map(key => `n.${key} = $${key}`).join(' AND ');
      
      // Construcción de eliminación de propiedades
      const removeQuery = properties.map(key => `REMOVE n.${key}`).join(' ');
  
      const query = `MATCH (n:${label}) WHERE ${filterConditions} ${removeQuery} RETURN count(n) AS updatedCount`;
  
      const result = await session.run(query, { ...filter });
  
      const updatedCount = result.records[0].get("updatedCount").low;
      
      res.json({ message: `Propiedades eliminadas en ${updatedCount} nodos.` });
    } catch (error) {
      console.error("Error al eliminar propiedades de múltiples nodos:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });

  /**
 * 1️⃣ Eliminar un nodo por ID
 * DELETE /nodes/:label/:id
 */
router.delete('/:label/:id', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const id = parseInt(req.params.id);
  
    try {
      // Primero verificamos si el nodo existe
      const checkQuery = `MATCH (n:${label} {id: $id}) RETURN n`;
      const checkResult = await session.run(checkQuery, { id });
  
      if (checkResult.records.length === 0) {
        return res.status(404).json({ error: "Nodo no encontrado." });
      }
  
      // Eliminamos el nodo y sus relaciones
      const deleteQuery = `MATCH (n:${label} {id: $id}) DETACH DELETE n`;
      await session.run(deleteQuery, { id });
  
      res.json({ message: `Nodo con ID ${id} eliminado exitosamente.` });
    } catch (error) {
      console.error("Error al eliminar nodo:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
  /**
   * 2️⃣ Eliminar múltiples nodos con un filtro
   * DELETE /nodes/:label
   */
  router.delete('/:label', async (req, res) => {
    const session = driver.session();
    const label = sanitizeLabel(req.params.label);
    const { filter } = req.body;
  
    if (!filter || Object.keys(filter).length === 0) {
      return res.status(400).json({ error: "Se requiere al menos un filtro para eliminar nodos." });
    }
  
    try {
      // Construcción de condiciones para el filtro
      const filterConditions = Object.keys(filter).map(key => `n.${key} = $${key}`).join(' AND ');
  
      // Verificamos cuántos nodos cumplen el filtro antes de eliminarlos
      const countQuery = `MATCH (n:${label}) WHERE ${filterConditions} RETURN count(n) AS total`;
      const countResult = await session.run(countQuery, filter);
      const total = countResult.records[0].get("total").low;
  
      if (total === 0) {
        return res.status(404).json({ error: "No se encontraron nodos con el filtro especificado." });
      }
  
      // Eliminamos los nodos y sus relaciones
      const deleteQuery = `MATCH (n:${label}) WHERE ${filterConditions} DETACH DELETE n`;
      await session.run(deleteQuery, filter);
  
      res.json({ message: `${total} nodos eliminados exitosamente.` });
    } catch (error) {
      console.error("Error al eliminar múltiples nodos:", error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  });
  
module.exports = router;