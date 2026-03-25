#!/usr/bin/env node

/**
 * Capture a screenshot of the running dev server.
 *
 * Usage:
 *   npm run ss [page]
 *
 * Arguments:
 *   page  Optional path segment appended to the base URL. Also used as the
 *         filename prefix. Defaults to "base" (captures the root page).
 *
 * Examples:
 *   npm run ss            # localhost:3000 → base-{timestamp}.png
 *   npm run ss calculator # localhost:3000/calculator → calculator-{timestamp}.png
 *
 * Environment:
 *   SCREENSHOT_URL  Base URL to capture (default: http://localhost:3000)
 *
 * Output:
 *   .claude/screenshots/{page}-{timestamp}.png  Timestamped capture
 *   .claude/screenshots/latest.png              Always the most recent capture
 */

import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const BASE_URL =
  process.env.SCREENSHOT_URL || "http://localhost:3000";
const OUTPUT_DIR = path.join(
  process.cwd(),
  ".claude",
  "screenshots",
);

async function screenshot() {
  const pageName = process.argv[2] || "base";
  const safePrefix = pageName.replace(/\//g, "-");
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
  const filename = `${safePrefix}-${timestamp}.png`;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const url =
      pageName === "base"
        ? BASE_URL
        : `${BASE_URL}/${pageName}`;
    console.log(`Navigating to ${url}...`);

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const filepath = path.join(OUTPUT_DIR, filename);
    const latestPath = path.join(OUTPUT_DIR, "latest.png");

    await page.screenshot({ path: filepath, fullPage: true });
    fs.copyFileSync(filepath, latestPath);

    console.log(`Screenshot saved: ${filepath}`);
    console.log(`Latest alias: ${latestPath}`);
  } finally {
    await browser.close();
  }
}

screenshot().catch((err) => {
  console.error("Screenshot failed:", err.message);
  process.exit(1);
});
