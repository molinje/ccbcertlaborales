#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, 'webapp', 'manifest.json');
const mtaPath = path.join(rootDir, 'mta.yaml');

function bumpPatch(version) {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const newVersion = bumpPatch(pkg.version);

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest['sap.app'].applicationVersion.version = newVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const mtaYaml = fs.readFileSync(mtaPath, 'utf8');
const topLevelVersionLine = /^version:.*$/m;
if (!topLevelVersionLine.test(mtaYaml)) {
  throw new Error(`No se encontró una línea "version:" de nivel superior en ${mtaPath}`);
}
fs.writeFileSync(mtaPath, mtaYaml.replace(topLevelVersionLine, `version: ${newVersion}`));

console.log(`Version bumped to ${newVersion} (package.json + webapp/manifest.json + mta.yaml)`);
