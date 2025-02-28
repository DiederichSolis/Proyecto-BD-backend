// src/conn.js
const neo4j = require('neo4j-driver');

// Reemplaza con los datos de tu instancia Aura
const uri = 'neo4j+s://f74355f9.databases.neo4j.io';
const user = 'neo4j';
const password = '1qCaAoUnqsSLVFw09crcZAW3hoXfJO9xp7pURBZRO94';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

module.exports = driver;