import test from 'node:test';import assert from 'node:assert/strict';import {startupPolicy} from '../utils/startup-policy.js';
test('arranque preparado permite servidor productivo sin DDL, jobs, borrado ni polling',()=>{
 assert.deepEqual(startupPolicy({NODE_ENV:'production',AUTO_MIGRATIONS_ENABLED:'false',BACKGROUND_TASKS_ENABLED:'false',AUDIT_RETENTION_ENABLED:'false',TELEGRAM_POLLING_ENABLED:'false'}),{autoMigrations:false,background:false,auditRetention:false,telegramPolling:false});
 assert.equal(startupPolicy({NODE_ENV:'production',TELEGRAM_POLLING_ENABLED:'false'}).telegramPolling,false);
 assert.equal(startupPolicy({NODE_ENV:'production',AUDIT_RETENTION_ENABLED:'false'}).auditRetention,false);
 assert.equal(startupPolicy({NODE_ENV:'production'}).telegramPolling,true);
 assert.equal(startupPolicy({}).autoMigrations,true);
 assert.throws(()=>startupPolicy({AUTO_MIGRATIONS_ENABLED:'maybe'}));
});
