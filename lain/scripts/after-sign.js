/* eslint-disable no-console */
const path = require('path');
const { execFileSync } = require('child_process');

// electron-builder hook: called after signing.
// We re-sign the whole bundle ad-hoc + deep to avoid "different Team IDs"
// dyld failures on newer macOS when the downloaded Electron frameworks keep
// their original signatures.
exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const productFilename = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${productFilename}.app`);

  console.log(`[afterSign] Ad-hoc deep codesign: ${appPath}`);
  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--options', 'runtime', appPath],
    { stdio: 'inherit' }
  );
};

