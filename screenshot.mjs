import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

const url   = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

const existing = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png'));
let maxN = 0;
existing.forEach(f => { const m = f.match(/^screenshot-(\d+)/); if (m) maxN = Math.max(maxN, parseInt(m[1])); });
const n = maxN + 1;
const filename = label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
const outPath  = path.join(screenshotDir, filename);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--run-all-compositor-stages-before-draw', '--disable-features=PaintHolding'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 });
page.on('pageerror', err => console.error('Page error:', err.message));

await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

// Scroll through page to trigger IntersectionObserver for below-fold elements
const pageHeight = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= pageHeight; y += 500) {
  await page.evaluate(sy => window.scrollTo(0, sy), y);
  await new Promise(r => setTimeout(r, 80));
}
await page.evaluate(() => window.scrollTo(0, 0));

// Wait for ALL animations to fully complete naturally
// max letter delay ≈ 0.9s + duration 0.85s = 1.75s; hero-fade max = 0.65s + 0.65s = 1.3s
await new Promise(r => setTimeout(r, 3000));

// Trigger a forced repaint by toggling a style
await page.evaluate(() => {
  document.body.style.zoom = '1.0001';
  document.body.getBoundingClientRect(); // force layout
  document.body.style.zoom = '1';
  document.body.getBoundingClientRect();
});

await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(`Screenshot saved: ${outPath}`);
