import { readFile } from 'node:fs/promises';
import { databasePool } from '../database/pool.js';
try {
  const r = await databasePool.query('SELECT current_database() AS name');
  if (r.rows[0]?.name !== 'gerenciamiento_viajes_stg') throw new Error('La migración requiere la base de pruebas gerenciamiento_viajes_stg.');
  const sql = await readFile(new URL('../../../database/migrations/042_trip_operations.sql', import.meta.url), 'utf8');
  await databasePool.query(sql);
  console.log('Migración 042 aplicada en pruebas.');
} finally { await databasePool.end(); }
