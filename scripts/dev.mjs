// Starts api + web dev servers side by side (no extra tooling like concurrently).
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const procs = [
  spawn(npm, ['run', 'dev', '-w', '@apas/api'], { stdio: 'inherit' }),
  spawn(npm, ['run', 'dev', '-w', '@apas/web'], { stdio: 'inherit' }),
];

const shutdown = (code = 0) => {
  for (const p of procs) if (!p.killed) p.kill('SIGTERM');
  process.exit(code);
};

for (const p of procs) p.on('exit', (code) => shutdown(code ?? 0));
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
