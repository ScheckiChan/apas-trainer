import { createApp } from './app.js';
import { config } from './config.js';
import { migrateGruppeToTrupp } from './migrate.js';
import { initPush } from './push.js';
import { startReminderLoop, stopReminderLoop } from './reminders.js';

migrateGruppeToTrupp(config.dataDir);
initPush();

const server = createApp().listen(config.port, () => {
  console.log(`[api] APAS-Trainer API listening on :${config.port} (data: ${config.dataDir})`);
  startReminderLoop();
});

function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`);
  stopReminderLoop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
