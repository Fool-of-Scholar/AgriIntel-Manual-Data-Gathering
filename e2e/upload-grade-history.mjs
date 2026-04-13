import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const UPLOAD_FILE =
  process.env.UPLOAD_FILE ||
  path.join(
    ROOT,
    'test-assets',
    'sample-crop.svg'
  );

const OUT_DIR = path.join(ROOT, 'artifacts', 'e2e');

const FALLBACK_PNG_BASE64 =
  // 1x1 PNG (opaque orange) — tiny but valid image
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4/58BAAT/Af8YJ0cWAAAAAElFTkSuQmCC';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function screenshot(page, name) {
  const filePath = path.join(OUT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function expectVisible(page, selector, timeout = 20000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

async function run() {
  await ensureDir(OUT_DIR);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', async (d) => {
    try { await d.accept(); } catch (_) {}
  });
  page.on('pageerror', (e) => console.error('[pageerror]', e));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console.error]', msg.text());
  });

  const timings = {};
  const shots = {};

  // 1) Open app
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expectVisible(page, 'text=AgriIntel');
  shots.initial = await screenshot(page, '01-initial.png');

  // 2) Upload (hidden input is present on page)
  const input = page.locator('#fileInput').first();
  const hasFile = await fs
    .access(UPLOAD_FILE)
    .then(() => true)
    .catch(() => false);
  if (hasFile) {
    await input.setInputFiles(UPLOAD_FILE);
  } else {
    const buffer = Buffer.from(FALLBACK_PNG_BASE64, 'base64');
    await input.setInputFiles({
      name: 'fallback.png',
      mimeType: 'image/png',
      buffer
    });
  }

  // wait for preview to appear
  await expectVisible(page, '#previewContainer');
  shots.preview = await screenshot(page, '02-preview-after-select.png');

  // wait until upload finishes OR fails
  // (uploadStatus text can be flaky/brief; uploadBox.processing is more reliable)
  const t0 = Date.now();
  let uploadSettled = true;
  try {
    await page.waitForFunction(() => {
      const box = document.querySelector('#uploadBox');
      if (!box) return false;
      return !box.classList.contains('processing');
    }, null, { timeout: 30000 });
  } catch {
    uploadSettled = false;
  }
  timings.upload_ms = Date.now() - t0;
  shots.upload_done = await screenshot(page, uploadSettled ? '03-upload-done.png' : '03-upload-timeout.png');

  // 3) Calculate grade
  const gradeBtn = page.locator('#gradeBtn').first();
  await gradeBtn.click();
  await expectVisible(page, '#resultCard');
  shots.result = await screenshot(page, '04-result-card.png');

  // 4) Save
  await page.locator('#confirmBtn').first().click();
  await expectVisible(page, '#saveForm');
  await page.locator('#graderName').fill('E2E Tester');
  await page.locator('#notes').fill('Playwright E2E save + history check.');

  const saveBtn = page.locator('#saveBtn').first();
  const t1 = Date.now();
  await saveBtn.click();
  await expectVisible(page, '#successMsg');
  timings.save_ms = Date.now() - t1;
  shots.success = await screenshot(page, '05-success.png');

  // 5) History page should show new row
  await page.goto(`${BASE_URL}/history.html`, { waitUntil: 'domcontentloaded' });
  await expectVisible(page, 'text=Mga nakaraang grade', 30000);

  // Wait for a row that contains AGR- (batch id)
  await page.waitForFunction(() => {
    const tbody = document.querySelector('#historyTable');
    if (!tbody) return false;
    return (tbody.textContent || '').includes('AGR-');
  }, null, { timeout: 30000 });
  shots.history = await screenshot(page, '06-history-has-new-row.png');

  await browser.close();

  const report = {
    baseUrl: BASE_URL,
    uploadFile: UPLOAD_FILE,
    timings,
    screenshots: shots
  };

  const reportPath = path.join(OUT_DIR, 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

