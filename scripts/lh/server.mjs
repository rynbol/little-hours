import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { ensureDir, lhDir, repoRoot } from './state.mjs';

const git = (args, cwd = repoRoot) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function describeRef(ref) {
  if (!ref || ref === '.') return { key: 'here', root: repoRoot, label: `working tree (${git(['rev-parse', '--short', 'HEAD'])}${git(['status', '--porcelain']) ? ' + edits' : ''})` };
  const sha = git(['rev-parse', '--verify', `${ref}^{commit}`]);
  return { key: ref.replace(/[^\w.-]+/g, '_'), sha, ref, label: `${ref} (${sha.slice(0, 7)})` };
}

function prepareWorktree(info) {
  const root = join(ensureDir(join(lhDir, 'refs')), info.key);
  if (!existsSync(root)) git(['worktree', 'add', '--detach', '--force', root, info.sha]);
  else { git(['checkout', '--detach', '--force', info.sha], root); git(['clean', '-fdq', '-e', 'node_modules'], root); }
  const modules = join(root, 'node_modules');
  const sameLock = readFileSync(join(root, 'package-lock.json'), 'utf8') === readFileSync(join(repoRoot, 'package-lock.json'), 'utf8');
  if (!existsSync(modules)) {
    if (sameLock) symlinkSync(join(repoRoot, 'node_modules'), modules);
    else execFileSync('npm', ['ci', '--silent'], { cwd: root, stdio: 'inherit' });
  }
  return root;
}

export async function serve(ref) {
  const info = describeRef(ref);
  const root = info.root || prepareWorktree(info);
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    clearScreen: false,
    cacheDir: join(lhDir, 'vite-cache', info.key),
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: { ignored: ['**/.lh/**', '**/node_modules/**', '**/dist/**'] } },
  });
  await server.listen();
  const url = server.resolvedUrls.local[0].replace(/\/$/, '');
  await fetch(url + '/').catch(() => {});
  await fetch(url + '/src/main.js').catch(() => {});
  return { url, root, label: info.label, close: () => server.close() };
}
