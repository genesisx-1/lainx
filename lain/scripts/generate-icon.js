/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const resourcesDir = path.join(root, 'resources');
const icnsPath = path.join(resourcesDir, 'icon.icns');
const requiredPngs = [
  'icon-16x16.png',
  'icon-32x32.png',
  'icon-64x64.png',
  'icon-128x128.png',
  'icon-256x256.png',
  'icon-512x512.png',
  'icon-1024x1024.png',
  'icon.png',
  'icon.ico',
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  ensureDir(resourcesDir);
  const missing = requiredPngs.filter((file) => !fs.existsSync(path.join(resourcesDir, file)));

  if (missing.length > 0) {
    throw new Error(
      `Missing prebuilt icon assets: ${missing.join(', ')}. ` +
      'Rebuild them on a machine with sharp installed.'
    );
  }

  if (process.platform === 'darwin' && !fs.existsSync(icnsPath)) {
    throw new Error('Missing resources/icon.icns. Rebuild icons on macOS before packaging.');
  }

  if (process.platform === 'darwin') {
    try {
      execFileSync('iconutil', ['-c', 'icns', path.join(resourcesDir, 'icon.iconset'), '-o', icnsPath], {
        stdio: 'ignore',
      });
    } catch {
      // Existing .icns is already sufficient for packaging.
    }
  }

  console.log('Icon assets already present. Nothing to regenerate.');
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
