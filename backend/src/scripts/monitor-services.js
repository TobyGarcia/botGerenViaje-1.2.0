import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readTelegramAuditConfig, createTelegramAuditSender } from '../services/telegram-audit.service.js';
import { readMonitorTargets, createServiceMonitor } from '../services/service-monitor.service.js';

// Explicit opt-in; never starts polling or loads the operational .env automatically.
if (process.env.SERVICE_MONITOR_ENABLED !== 'true') {
  console.log('Service monitor disabled.');
} else {
  try {
    const config = readTelegramAuditConfig();
    if (!config.enabled) throw new Error('MONITOR_REQUIRES_ALERT_CONFIGURATION');
    const targets = readMonitorTargets(process.env.MONITOR_TARGETS_JSON);
    const stateFile = resolve(process.env.MONITOR_STATE_FILE || './monitor-state/state.json');
    let restored = {};
    try { restored = JSON.parse(await readFile(stateFile, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('MONITOR_STATE_UNREADABLE'); }
    const monitor = createServiceMonitor({ targets, restored, environment: config.environment, send: createTelegramAuditSender(config),
      persist: async snapshot => {
        await mkdir(dirname(stateFile), { recursive: true });
        await writeFile(stateFile + '.tmp', JSON.stringify(snapshot), { mode: 0o600 });
        await rename(stateFile + '.tmp', stateFile);
      }
    });
    // One sequential scheduler avoids concurrent writes to the snapshot file.
    let stopped = false, nextCheck = 0;
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopped = true; });
    while (!stopped) {
      if (Date.now() >= nextCheck) { await monitor.check(); nextCheck = Date.now() + 30000; }
      await monitor.deliver();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch {
    console.error(JSON.stringify({ type: 'service_monitor_start_failed', hint: 'Check configuration and state-file access.' }));
    process.exitCode = 1;
  }
}
