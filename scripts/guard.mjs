import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'rolldown/experimental';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK_FILES = ['src/dev/test-hook.js', 'src/core/test-pins.js'];
const CLOCK_FILE = 'src/core/test-pins.js';
const LAYERS = { core: ['core'], models: ['core', 'models'], ui: ['core', 'ui'], feature: ['core', 'models', 'ui'], dev: ['dev'], app: ['core', 'models', 'ui', 'dev'] };
const CHECKED = /^(src|scripts|e2e|checks)\/.*\.(js|mjs)$/;

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walk(child, visit); return; }
  if (typeof node.type === 'string') visit(node);
  for (const key in node) if (key !== 'start' && key !== 'end') walk(node[key], visit);
}

function lineAt(code, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < code.length; i++) if (code.charCodeAt(i) === 10) line++;
  return line;
}

function layerOf(file) {
  if (file === 'src/main.js' || file.startsWith('src/app/')) return { layer: 'app' };
  const feature = file.match(/^src\/features\/([^/]+)\//);
  if (feature) return { layer: 'feature', feature: feature[1] };
  const top = file.match(/^src\/([^/]+)\//)?.[1];
  return { layer: ['core', 'models', 'ui', 'dev'].includes(top) ? top : null };
}

function layerProblem(file, target) {
  const from = layerOf(file), to = layerOf(target);
  if (!from.layer) return `put ${file} in src/core, src/models, src/ui, src/dev, src/app or src/features/<name>`;
  if (!to.layer) return `${target} is outside the layers`;
  if (to.layer === 'feature') {
    if (from.layer === 'feature' && from.feature === to.feature) return null;
    if (from.layer !== 'feature' && from.layer !== 'app') return `${from.layer} code must not import features (${target})`;
    return target === `src/features/${to.feature}/index.js` ? null : `import the ${to.feature} feature through src/features/${to.feature}/index.js, not ${target}`;
  }
  if (to.layer === 'app') return target === 'src/main.js' ? 'nothing imports src/main.js' : from.layer === 'app' ? null : `${from.layer} code must not import the app shell (${target})`;
  return LAYERS[from.layer].includes(to.layer) ? null : `${from.layer} code must not import ${to.layer} (${target})`;
}

const propertyName = node => node.computed ? node.property?.value : node.property?.name;

export function checkSource(file, code) {
  const { program, errors } = parseSync(file, code);
  if (errors.length) return [{ file, line: 1, rule: 'parse', message: errors[0].message }];
  const found = [], add = (node, rule, message) => found.push({ file, line: lineAt(code, node.start), rule, message });
  const game = file.startsWith('src/') && !file.endsWith('.test.js');
  walk(program, node => {
    if (game && file !== CLOCK_FILE) {
      if (node.type === 'MemberExpression' && node.object?.type === 'Identifier' && ((node.object.name === 'Date' && propertyName(node) === 'now') || (node.object.name === 'Math' && propertyName(node) === 'random'))) add(node, 'clock', `use clockNow/clockRandom from src/core/test-pins.js instead of ${node.object.name}.${propertyName(node)}`);
      if (node.type === 'NewExpression' && node.callee?.name === 'Date' && !node.arguments.length) add(node, 'clock', 'use new Date(clockNow()) so tests can pin the clock');
    }
    if (game && !HOOK_FILES.includes(file)) {
      const name = node.type === 'MemberExpression' ? propertyName(node) : null;
      if (name === '__littleHours' || name === '__littleHoursTest') add(node, 'test-hook', `${name} belongs only in ${HOOK_FILES.join(' or ')}`);
    }
    const source = (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration' || node.type === 'ImportExpression') ? node.source?.value : null;
    if (typeof source !== 'string' || !source.startsWith('.')) return;
    const target = relative(root, resolve(root, dirname(file), source));
    if (game && !target.startsWith('src/')) add(node, 'imports', `game code must not import ${target}`);
    if (game && target === 'src/dev/test-hook.js' && file !== 'src/main.js') add(node, 'imports', 'only src/main.js may install the test hook');
    if (game && target.startsWith('src/') && !target.endsWith('.css')) { const problem = layerProblem(file, target); if (problem) add(node, 'layers', problem); }
    if (file.startsWith('scripts/lh') && target.startsWith('src/')) add(node, 'imports', `lh drives the app through the browser; it must not import ${target}`);
  });
  return found;
}

export function commentLines(file, code) {
  const { comments } = parseSync(file, code);
  const lines = new Set();
  for (const comment of comments) for (let line = lineAt(code, comment.start); line <= lineAt(code, comment.end); line++) lines.add(line);
  return lines;
}

const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function addedLines(base) {
  const added = new Map(), removed = new Set();
  let file = null;
  for (const line of git(['diff', '--unified=0', '--no-color', '--no-ext-diff', base, '--']).split('\n')) {
    if (line.startsWith('+++ ')) { file = line.startsWith('+++ b/') ? line.slice(6) : null; continue; }
    if (line.startsWith('-') && !line.startsWith('--- ')) { removed.add(line.slice(1).trim()); continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file) {
      const start = Number(hunk[1]), count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      const set = added.get(file) || new Set();
      for (let n = start; n < start + count; n++) set.add(n);
      added.set(file, set);
    }
  }
  for (const untracked of git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)) added.set(untracked, 'all');
  return { added, removed };
}

function defaultBase() {
  try { return git(['merge-base', 'HEAD', 'origin/main']); } catch { return null; }
}

function main() {
  const given = process.argv.find(arg => arg.startsWith('--base='))?.slice(7) || process.env.GUARD_BASE;
  const baseArg = given && !/^0+$/.test(given) ? given : defaultBase();
  const files = git(['ls-files', '--cached', '--others', '--exclude-standard']).split('\n').filter(file => CHECKED.test(file) && existsSync(join(root, file)));
  const problems = [];
  for (const file of files) problems.push(...checkSource(file, readFileSync(join(root, file), 'utf8')));
  let base = null;
  if (baseArg) { try { base = git(['rev-parse', '--verify', `${baseArg}^{commit}`]); } catch {} }
  if (base) {
    const { added, removed } = addedLines(base);
    for (const [file, lines] of added) {
      if (!CHECKED.test(file) || !existsSync(join(root, file))) continue;
      const code = readFileSync(join(root, file), 'utf8'), text = code.split('\n');
      for (const line of commentLines(file, code)) if ((lines === 'all' || lines.has(line)) && !removed.has(text[line - 1].trim())) problems.push({ file, line, rule: 'no-new-comments', message: 'new code comments are not allowed; say it in the code, the commit message, or the docs' });
    }
  }
  for (const problem of problems) console.log(`${problem.file}:${problem.line}  ${problem.rule}  ${problem.message}`);
  console.log(`guard: ${files.length} files, ${problems.length} problem(s)${base ? `, new comments checked against ${base.slice(0, 7)}` : ', comment check skipped (no base commit)'}`);
  process.exit(problems.length ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
