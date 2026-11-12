// Renders every *.html in a visual folder to <out>/<name>-{light,dark}.png at
// 2x, cropped to the #frame element. Uses the installed Google Chrome through
// playwright-core (the copy in the sibling coinbase-www checkout by default).
//
//   node render.js <folder>                    # all pages → <folder>/out
//   node render.js <folder> 2-arch             # pages whose name contains "2-arch"
//   node render.js <folder> --out /tmp/check   # write somewhere else
//
// Set PLAYWRIGHT_CORE to a playwright-core path if the default is missing.
const fs = require('fs');
const path = require('path');

function loadChromium() {
  const candidates = [
    process.env.PLAYWRIGHT_CORE,
    path.resolve(__dirname, '../../../../coinbase-www/node_modules/playwright-core'),
    'playwright-core',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate).chromium;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    'playwright-core not found. Set PLAYWRIGHT_CORE, for example to coinbase-www/node_modules/playwright-core.',
  );
}

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outArg = outIndex === -1 ? undefined : args[outIndex + 1];
const positional = args.filter((_, index) => outIndex === -1 || (index !== outIndex && index !== outIndex + 1));
const [folderArg, filter = ''] = positional;

if (!folderArg) {
  console.error('Usage: node render.js <folder> [nameFilter] [--out <dir>]');
  process.exit(1);
}

const folder = path.resolve(folderArg);
const outDir = outArg ? path.resolve(outArg) : path.join(folder, 'out');
const pages = fs
  .readdirSync(folder)
  .filter((file) => file.endsWith('.html') && file.includes(filter))
  .sort();

if (pages.length === 0) {
  console.error(`No .html files in ${folder}${filter ? ` matching "${filter}"` : ''}.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await loadChromium().launch({ channel: 'chrome' });
  try {
    for (const file of pages) {
      for (const theme of ['light', 'dark']) {
        const page = await browser.newPage({
          viewport: { width: 1400, height: 1000 },
          deviceScaleFactor: 2,
        });
        await page.goto(`file://${path.join(folder, file)}?theme=${theme}`);
        const target = path.join(outDir, `${path.basename(file, '.html')}-${theme}.png`);
        await page.locator('#frame').screenshot({ path: target });
        await page.close();
        console.log(`rendered ${path.relative(process.cwd(), target)}`);
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
