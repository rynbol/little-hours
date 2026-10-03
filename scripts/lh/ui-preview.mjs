import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const researchRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../wilds-assets/ui-research');

export async function serveUiResearch() {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/plain' };
  const server = createServer(async (request, response) => {
    try {
      const path = resolve(researchRoot, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
      if (!path.startsWith(researchRoot + sep) || !types[extname(path)]) {
        response.writeHead(404).end('Not found');
        return;
      }
      const data = await readFile(path);
      response.writeHead(200, { 'Content-Type': types[extname(path)], 'Cache-Control': 'no-store' }).end(data);
    } catch { response.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await serveUiResearch();
  console.log(`${server.url}/mocks/index.html`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
}
