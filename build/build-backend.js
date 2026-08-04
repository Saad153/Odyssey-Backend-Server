/* eslint-disable */
// Backend seal pipeline: turn your readable source into distributable bytecode.
//
//   node build/build-backend.js
//
// Stages (only YOUR code is processed - third-party node_modules are public
// npm packages, so there's nothing to hide there and they're left as-is):
//
//   1. esbuild   - bundle index.js + routes + models + functions into ONE file,
//                  with every node_modules dependency marked `external` so
//                  native drivers (pg, mysql2, bcryptjs) and puppeteer's
//                  Chromium still load normally at runtime. Strips all comments.
//   2. obfuscate - javascript-obfuscator mangles names / control flow so the
//                  intermediate JS is unreadable.
//   3. bytenode  - compile to V8 bytecode (app.jsc). The JS source is gone;
//                  what ships can't be opened in an editor and read.
//
// Output goes to build/dist/. See BUILD.md for how to assemble the shippable
// folder (dist + node_modules + launcher + per-install .env) and optionally
// wrap it as a single Node SEA executable.

const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const JavaScriptObfuscator = require('javascript-obfuscator');
const bytenode = require('bytenode');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(__dirname, 'dist');
const BUNDLE = path.join(DIST, 'app.bundle.js');
const OBF = path.join(DIST, 'app.obf.js');
const JSC = path.join(DIST, 'app.jsc');

async function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // Keep everything under node_modules external. We only bundle first-party code.
  const externals = fs
    .readdirSync(path.join(ROOT, 'node_modules'))
    .filter(n => !n.startsWith('.'));

  console.log('1/3 esbuild bundling first-party source...');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'index.js')],
    outfile: BUNDLE,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    legalComments: 'none',
    external: externals,
    logLevel: 'warning',
  });

  console.log('2/3 obfuscating...');
  const code = fs.readFileSync(BUNDLE, 'utf8');
  const obf = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.6,
    deadCodeInjection: false, // keep size/perf sane for a server
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    identifierNamesGenerator: 'hexadecimal',
    // Renaming globals in a bundled server is risky; keep it off.
    renameGlobals: false,
  });
  fs.writeFileSync(OBF, obf.getObfuscatedCode(), 'utf8');

  console.log('3/3 compiling to V8 bytecode (app.jsc)...');
  bytenode.compileFile({ filename: OBF, output: JSC });

  // Drop the intermediate readable artifacts so they can't be shipped by mistake.
  fs.rmSync(BUNDLE, { force: true });
  fs.rmSync(OBF, { force: true });

  // Launcher that the shipped build runs. bytenode must be required first so
  // it can register the .jsc loader.
  const launcher = `require('bytenode');\nrequire('./app.jsc');\n`;
  fs.writeFileSync(path.join(DIST, 'server.js'), launcher, 'utf8');

  console.log('\nDone. Sealed output in build/dist/:');
  console.log('  app.jsc     <- your code as bytecode (no readable source)');
  console.log('  server.js   <- launcher (node build/dist/server.js)');
  console.log('\nNext: see BUILD.md to assemble the shippable folder.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
