import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const windowsFonts = {
  body: "C:\\Windows\\Fonts\\arial.ttf",
  bold: "C:\\Windows\\Fonts\\arialbd.ttf",
  contact: "C:\\Windows\\Fonts\\calibri.ttf",
};

const fallbackFontPath = (key: keyof typeof windowsFonts, fileName: string) => {
  const configured = process.env[key === "body" ? "PDF_FONT_ARIAL_PATH" : key === "bold" ? "PDF_FONT_ARIAL_BOLD_PATH" : "PDF_FONT_CALIBRI_PATH"];
  if (configured) {
    return configured;
  }
  if (existsSync(windowsFonts[key])) {
    return windowsFonts[key];
  }
  return path.join(process.cwd(), "fonts", fileName);
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: "./test-results/playwright",
  use: {
    baseURL: "http://127.0.0.1:3105",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", testMatch: /.*\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", testMatch: /.*\.spec\.ts/, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", testMatch: /.*\.spec\.ts/, use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3105",
    url: "http://127.0.0.1:3105",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PDF_FONT_ARIAL_PATH: fallbackFontPath("body", "Arial.ttf"),
      PDF_FONT_ARIAL_BOLD_PATH: fallbackFontPath("bold", "Arial-Bold.ttf"),
      PDF_FONT_CALIBRI_PATH: fallbackFontPath("contact", "Calibri.ttf"),
    },
  },
});