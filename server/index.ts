import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { loadEnvironment } from './env';
import { Store } from './store';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnvironment(path.join(root, '.env'));
const port = Number(process.env.PORT ?? 3001);
const dataDirectory = path.resolve(root, process.env.FOLIO_DATA_DIR ?? 'data');
if (!dataDirectory.startsWith(`${root}${path.sep}`))
  throw new Error('Data directory must be inside the project root.');
const store = new Store(dataDirectory);
await store.migrate();
const server = createApp(root, store).listen(port, '127.0.0.1', () => {
  console.log(`Folio API: http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => server.close(() => process.exit(0)));
