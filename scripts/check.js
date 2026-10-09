const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function check(directory) {
  if (!fs.existsSync(directory)) return;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) check(file);
    else if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }
}
for (const directory of ['src', 'tests', 'scripts']) check(directory);
console.log('JavaScript syntax checks passed.');
