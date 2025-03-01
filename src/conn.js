// src/conn.js
const neo4j = require('neo4j-driver');

// Reemplaza con los datos de tu instancia Aura
const uri = 'neo4j+s://c76bafbf.databases.neo4j.io';
const user = 'neo4j';
const password = 'Nkegm0OApLR2fC1FP_CrHxDrXQfz3EgLShQYYUqtSR4';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

module.exports = driver;