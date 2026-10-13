import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventory} from './dimension-inventory-lib.mjs';
const strict = process.argv.includes('--strict');
const summaryOnly = process.argv.includes('--summary');
const args = process.argv.slice(2).filter(argument => !['--strict', '--summary'].includes(argument));
const root = path.resolve(args[0] || fileURLToPath(new URL('../src/', import.meta.url)));
const policyPath = path.join(root, 'core/contracts/dimension-policy.v1.json');
const policy = fs.existsSync(policyPath) ? JSON.parse(fs.readFileSync(policyPath, 'utf8')) : null;
const result = inventory(root, {policy});
const summary = {status: result.status, scannedFiles: result.scannedFiles, findingCount: result.findingCount, byCategory: result.byCategory, byStatus: result.byStatus, unresolvedCount: result.unresolvedCount, byLayer: result.byLayer};
if (args[1]) {
  fs.writeFileSync(args[1], JSON.stringify(result, null, 2)+'\n');
  console.log(JSON.stringify(summary));
} else if (summaryOnly) console.log(JSON.stringify(summary));
else process.stdout.write(JSON.stringify(result, null, 2)+'\n');
if (strict && result.unresolvedCount) process.exitCode = 1;
