// Usage: node render.js TekGeo___Promo_Video_Preview.html
// Output: tekgeo-promo.mp4 (1920x1080, 30fps, 1230 frames = 41s, video only)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const input = process.argv[2] || 'TekGeo___Promo_Video_Preview.html';
const TOTAL = 1230;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.resolve(input));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3000); // allow Google Fonts (Hind Siliguri / Inter) to load

  const ff = spawn('ffmpeg', [
    '-y', '-f', 'image2pipe', '-framerate', '30', '-i', '-',
    '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p',
    'tekgeo-promo.mp4'
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let n = 0; n < TOTAL; n++) {
    const b64 = await page.evaluate(n => {
      seekToFrame(n);
      return document.getElementById('c').toDataURL('image/png').split(',')[1];
    }, n);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) {
      await new Promise(r => ff.stdin.once('drain', r));
    }
    if (n % 60 === 0) console.log(`frame ${n}/${TOTAL}`);
  }

  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('Done: tekgeo-promo.mp4');
})();
