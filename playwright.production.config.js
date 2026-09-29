import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testMatch: ['development.spec.js', 'focus-mode.spec.js', 'focus-outlook.spec.js', 'fishing-ui.spec.js', 'garden.spec.js', 'place-transitions.spec.js'],
  grepInvert: /@dev-diagnostics/,
  projects: [{ ...base.projects[0], name: 'production', metadata: { production: true } }],
  use: { ...base.use, baseURL: 'http://127.0.0.1:4183' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4183 --strictPort',
    url: 'http://127.0.0.1:4183',
    reuseExistingServer: false,
  },
});
