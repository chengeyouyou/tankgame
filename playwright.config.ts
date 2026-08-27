import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:4173", headless: true },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "edge", use: { browserName: "chromium", channel: "msedge" } },
  ],
  webServer: {
    command: "npm run build && npm exec vite preview -- --host 127.0.0.1",
    port: 4173,
    reuseExistingServer: true,
  },
});
