import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      }
    },
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        channel: 'chrome'
      }
    }
  ],
  webServer: [
    {
      command: 'node src/server.js',
      cwd: path.resolve(rootDir, 'backend'),
      url: 'http://localhost:5000/api/health',
      reuseExistingServer: true,
      timeout: 30000,
      env: {
        PORT: '5000',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/civicfix_playwright_test'
      }
    },
    {
      command: 'node ./node_modules/vite/bin/vite.js --port 5173',
      cwd: path.resolve(rootDir, 'frontend'),
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000
    }
  ]
});
