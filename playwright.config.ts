import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

const executablePath = [
  process.env.CHROMIUM_BIN,
  ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
    .filter((base): base is string => Boolean(base))
    .flatMap(base => [path.join(base, 'Google/Chrome/Application/chrome.exe'), path.join(base, 'Microsoft/Edge/Application/msedge.exe')]),
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(candidate => candidate && existsSync(candidate));
const deployedBaseUrl = process.env.UTP_TEST_BASE_URL;

export default defineConfig({
  testDir: './pengujian',
  testMatch: 'project-memory-ui.spec.ts',
  outputDir: '.local/playwright',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: deployedBaseUrl || 'http://127.0.0.1:4173',
    browserName: 'chromium',
    reducedMotion: 'no-preference',
    colorScheme: 'light',
    launchOptions: executablePath ? { executablePath } : {},
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: deployedBaseUrl ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
