import { readFile } from 'node:fs/promises';
import { databasePool } from '../database/pool.js';
try {
  const result = await databasePool.query('SELECT current_database() AS name');
  if (result.rows[0]?.name !== 'gerenciamiento_viajes_stg') throw new Error('Solo se permite la base de pruebas.');
  await databasePool.query("SET lock_timeout='5s'");
  await databasePool.query("SET TIME ZONE 'America/Mexico_City'");
  await databasePool.query(await readFile(new URL('../../../database/migrations/045_viaje_inspeccion_uso.sql', import.meta.url), 'utf8'));
  console.log('Migración 045 aplicada en pruebas.');
} finally { await databasePool.end(); }
