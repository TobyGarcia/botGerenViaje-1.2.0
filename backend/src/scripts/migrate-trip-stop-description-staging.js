import { readFile } from 'node:fs/promises';
import { databasePool } from '../database/pool.js';
try {
  const result = await databasePool.query('SELECT current_database() AS name');
  if (result.rows[0]?.name !== 'gerenciamiento_viajes_stg') throw new Error('La migración requiere la base de pruebas gerenciamiento_viajes_stg.');
  const sql = await readFile(new URL('../../../database/migrations/043_trip_stop_description.sql', import.meta.url), 'utf8');
  await databasePool.query("SET lock_timeout='5s'");
  await databasePool.query(sql);
  console.log('Migración 043 aplicada en pruebas.');
} finally { await databasePool.end(); }
