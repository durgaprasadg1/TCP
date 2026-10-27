import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`Computation Workbench API listening on http://localhost:${config.port}/api`);
  console.log(`Allowed CORS origins: ${config.corsOrigins.join(', ')}`);
});
