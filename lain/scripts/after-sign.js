/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

function codesign(target, extraArgs = []) {
  execFileSync(
    'codesign',
    ['--force', '--sign', '-', '--options', 'runtime', ...extraArgs, target],
    { stdio: 'inherit' }
  );
}

function collectSignTargets(frameworksDir) {
  const targets = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name.endsWith('.app') ||
          entry.name.endsWith('.framework')
        ) {
          walk(fullPath);
          targets.push(fullPath);
          continue;
        }

        walk(fullPath);
        continue;
      }

      if (entry.name.endsWith('.dylib')) {
        targets.push(fullPath);
      }
    }
  }

  if (fs.existsSync(frameworksDir)) {
    walk(frameworksDir);
  }

  return targets;
}

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const productFilename = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${productFilename}.app`);
  const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');
  const mainBinary = path.join(appPath, 'Contents', 'MacOS', productFilename);
  const entitlements = path.join(
    context.packager.projectDir,
    'build',
    'entitlements.mac.plist'
  );

  console.log(`[afterSign] Re-signing nested macOS bundle: ${appPath}`);

  for (const target of collectSignTargets(frameworksDir)) {
    const extraArgs = target.endsWith('.app')
      ? ['--entitlements', entitlements]
      : [];
    codesign(target, extraArgs);
  }

  codesign(mainBinary, ['--entitlements', entitlements]);
  codesign(appPath, ['--entitlements', entitlements]);
};
