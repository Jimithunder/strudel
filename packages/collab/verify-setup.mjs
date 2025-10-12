#!/usr/bin/env node

/*
verify-setup.mjs - Verify collaboration setup is correct
*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');

console.log('🔍 Verifying Collaboration Setup...\n');

let allGood = true;

// Check files exist
const filesToCheck = [
  'packages/collab/package.json',
  'packages/collab/server.mjs',
  'packages/collab/collab.mjs',
  'packages/collab/README.md',
  'website/src/repl/components/CollaborationButton.jsx',
];

console.log('📁 Checking required files:');
for (const file of filesToCheck) {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING!`);
    allGood = false;
  }
}

// Check dependencies
console.log('\n📦 Checking dependencies:');
try {
  const collabPkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8')
  );
  const requiredDeps = ['yjs', 'y-websocket', 'ws'];
  for (const dep of requiredDeps) {
    if (collabPkg.dependencies[dep]) {
      console.log(`  ✅ ${dep} (${collabPkg.dependencies[dep]})`);
    } else {
      console.log(`  ❌ ${dep} - MISSING!`);
      allGood = false;
    }
  }
} catch (err) {
  console.log(`  ❌ Failed to read package.json: ${err.message}`);
  allGood = false;
}

console.log('\n📦 Checking CodeMirror dependencies:');
try {
  const cmPkg = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'packages/codemirror/package.json'), 'utf-8')
  );
  const requiredDeps = ['yjs', 'y-codemirror.next'];
  for (const dep of requiredDeps) {
    if (cmPkg.dependencies[dep]) {
      console.log(`  ✅ ${dep} (${cmPkg.dependencies[dep]})`);
    } else {
      console.log(`  ❌ ${dep} - MISSING!`);
      allGood = false;
    }
  }
} catch (err) {
  console.log(`  ❌ Failed to read CodeMirror package.json: ${err.message}`);
  allGood = false;
}

// Check npm scripts
console.log('\n🔧 Checking npm scripts:');
try {
  const rootPkg = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
  );
  if (rootPkg.scripts.collab) {
    console.log(`  ✅ "collab" script defined`);
  } else {
    console.log(`  ❌ "collab" script - MISSING!`);
    allGood = false;
  }
} catch (err) {
  console.log(`  ❌ Failed to read root package.json: ${err.message}`);
  allGood = false;
}

// Check imports in modified files
console.log('\n📝 Checking code integrations:');
try {
  const replContext = fs.readFileSync(
    path.join(rootDir, 'website/src/repl/useReplContext.jsx'),
    'utf-8'
  );
  if (replContext.includes('createCollaborationProvider')) {
    console.log(`  ✅ useReplContext imports collaboration utilities`);
  } else {
    console.log(`  ❌ useReplContext missing collaboration imports`);
    allGood = false;
  }
  
  if (replContext.includes('isCollaborating')) {
    console.log(`  ✅ useReplContext has collaboration state`);
  } else {
    console.log(`  ❌ useReplContext missing collaboration state`);
    allGood = false;
  }
} catch (err) {
  console.log(`  ❌ Failed to read useReplContext.jsx: ${err.message}`);
  allGood = false;
}

try {
  const header = fs.readFileSync(
    path.join(rootDir, 'website/src/repl/components/Header.jsx'),
    'utf-8'
  );
  if (header.includes('CollaborationButton')) {
    console.log(`  ✅ Header imports CollaborationButton`);
  } else {
    console.log(`  ❌ Header missing CollaborationButton import`);
    allGood = false;
  }
} catch (err) {
  console.log(`  ❌ Failed to read Header.jsx: ${err.message}`);
  allGood = false;
}

try {
  const codemirror = fs.readFileSync(
    path.join(rootDir, 'packages/codemirror/codemirror.mjs'),
    'utf-8'
  );
  if (codemirror.includes('yCollab')) {
    console.log(`  ✅ CodeMirror imports yCollab`);
  } else {
    console.log(`  ❌ CodeMirror missing yCollab import`);
    allGood = false;
  }
  
  if (codemirror.includes('collabConfig')) {
    console.log(`  ✅ CodeMirror has collabConfig parameter`);
  } else {
    console.log(`  ❌ CodeMirror missing collabConfig parameter`);
    allGood = false;
  }
} catch (err) {
  console.log(`  ❌ Failed to read codemirror.mjs: ${err.message}`);
  allGood = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('✅ All checks passed! Collaboration feature is ready.');
  console.log('\nTo test:');
  console.log('  1. Run: pnpm collab    (in one terminal)');
  console.log('  2. Run: pnpm dev       (in another terminal)');
  console.log('  3. Click "Collaborate" button in the REPL');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the issues above.');
  process.exit(1);
}

