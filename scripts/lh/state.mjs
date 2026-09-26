import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
export const lhDir = join(repoRoot, '.lh');
const pidFile = join(lhDir, 'pids.json');

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function outDir(command, keep = 12) {
  const root = ensureDir(join(lhDir, 'out'));
  for (const old of readdirSync(root).sort().slice(0, -keep + 1)) rmSync(join(root, old), { recursive: true, force: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return ensureDir(join(root, `${stamp}-${command}`));
}

export function tracked() {
  try { return JSON.parse(readFileSync(pidFile, 'utf8')); } catch { return []; }
}

function save(list) {
  ensureDir(lhDir);
  writeFileSync(pidFile, JSON.stringify(list, null, 2));
}

export function track(entry) { save([...tracked().filter(item => item.pid !== entry.pid), entry]); }
export function untrack(pid) { save(tracked().filter(item => item.pid !== pid)); }

export function commandOf(pid) {
  try { return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim(); } catch { return ''; }
}

export function stopTracked() {
  const stopped = [];
  for (const entry of tracked()) {
    const command = commandOf(entry.pid);
    if (command && command.includes(entry.marker)) {
      try { process.kill(entry.pid, 'SIGKILL'); stopped.push(entry.pid); } catch {}
    }
    if (entry.dir && existsSync(entry.dir)) rmSync(entry.dir, { recursive: true, force: true });
    untrack(entry.pid);
  }
  return stopped;
}
