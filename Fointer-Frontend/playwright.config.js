import { defineConfig } from "@playwright/test";

const fakeMediaArgs = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--autoplay-policy=no-user-gesture-required",
];

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.FOINTER_E2E_ORIGIN || "http://127.0.0.1:5173",
    headless: true,
    launchOptions: { args: fakeMediaArgs },
  },
});
