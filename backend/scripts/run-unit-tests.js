/**
 * Run all backend unit tests (cross-platform; Windows does not expand test/*.test.js).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, '..', 'test');
const files = fs
  .readdirSync(testDir)
  .filter((name) => name.endsWith('.test.js'))
  .map((name) => path.join(testDir, name))
  .sort();

if (files.length === 0) {
  console.error('No test/*.test.js files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
});

process.exit(result.status === null ? 1 : result.status);
