/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const root = path.resolve(__dirname, '..');
const resourcesDir = path.join(root, 'resources');
const svgPath = path.join(resourcesDir, 'icon.svg');
const png1024Path = path.join(resourcesDir, 'icon.png');
const icoPath = path.join(resourcesDir, 'icon.ico');
const icnsPath = path.join(resourcesDir, 'icon.icns');
const iconsetDir = path.join(resourcesDir, 'icon.iconset');

const sizes = [16, 32, 64, 128, 256, 512, 1024];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function writePngsFromSvg(svg) {
  for (const size of sizes) {
    const out = path.join(resourcesDir, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  }
  fs.copyFileSync(path.join(resourcesDir, 'icon-1024x1024.png'), png1024Path);
}

function buildIcns() {
  ensureDir(iconsetDir);
  const mapping = [
    ['icon-16x16.png', 'icon_16x16.png'],
    ['icon-32x32.png', 'icon_16x16@2x.png'],
    ['icon-32x32.png', 'icon_32x32.png'],
    ['icon-64x64.png', 'icon_32x32@2x.png'],
    ['icon-128x128.png', 'icon_128x128.png'],
    ['icon-256x256.png', 'icon_128x128@2x.png'],
    ['icon-256x256.png', 'icon_256x256.png'],
    ['icon-512x512.png', 'icon_256x256@2x.png'],
    ['icon-512x512.png', 'icon_512x512.png'],
    ['icon-1024x1024.png', 'icon_512x512@2x.png'],
  ];

  for (const [src, dst] of mapping) {
    fs.copyFileSync(path.join(resourcesDir, src), path.join(iconsetDir, dst));
  }

  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath], {
    stdio: 'inherit',
  });
}

async function buildIco() {
  const buffers = await Promise.all(
    [16, 24, 32, 48, 64, 128, 256].map(async (s) =>
      sharp(png1024Path).resize(s, s).png().toBuffer()
    )
  );
  const icoBuf = await pngToIco(buffers);
  fs.writeFileSync(icoPath, icoBuf);
}

async function main() {
  ensureDir(resourcesDir);

  if (!fs.existsSync(svgPath)) {
    throw new Error(`Missing ${path.relative(root, svgPath)}. Create it first.`);
  }

  const svg = fs.readFileSync(svgPath, 'utf8');

  console.log('Generating PNG icons from SVG...');
  await writePngsFromSvg(svg);

  if (process.platform === 'darwin') {
    console.log('Generating macOS .icns...');
    buildIcns();
  } else {
    console.log('Skipping .icns (not on macOS).');
  }

  console.log('Generating Windows .ico...');
  await buildIco();

  console.log('Done. Icons written to resources/.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

