// Usage: node render.js <input.html> [output.mp4]
// Works for any TekGeo canvas video (16:9 or square): frame count and fps are read from the page itself.
// Output size = the canvas size. Video only (no audio).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const input = process.argv[2];
if (!input) { console.error('Usage: node render.js <input.html> [output.mp4]'); process.exit(1); }
const out = process.argv[3] || path.basename(input, path.extname(input)) + '.mp4';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1300 } });
  await page.goto('file://' + path.resolve(input));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3000); // allow Google Fonts (Hind Siliguri / Inter) to load

  const { total, fps } = await page.evaluate(() => ({
    total: window.TOTAL_FRAMES || (+document.querySelector('input[type=range]').max + 1),
    fps: window.FPS || 30
  }));
  console.log(`Rendering ${total} frames @ ${fps}fps (${(total / fps).toFixed(1)}s) -> ${out}`);

  const ff = spawn('ffmpeg', [
    '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p',
    out
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let n = 0; n < total; n++) {
    const b64 = await page.evaluate(n => {
      seekToFrame(n);
      return document.getElementById('c').toDataURL('image/png').split(',')[1];
    }, n);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) {
      await new Promise(r => ff.stdin.once('drain', r));
    }
    if (n % 60 === 0) console.log(`frame ${n}/${total}`);
  }

  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('Done: ' + out);
})();