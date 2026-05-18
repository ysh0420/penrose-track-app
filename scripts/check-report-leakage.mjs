import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOTS = ['data/reports'];
const MANIFESTS = ['data/research-reports.json'];
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

const FORBIDDEN = [
  { name: 'Koyfin paid-data marker', pattern: /Koyfin/i },
  { name: 'TradingView marker', pattern: /TradingView/i },
  { name: 'Source Run lineage', pattern: /Source Run/i },
  { name: 'UUID lineage', pattern: UUID_RE },
  { name: 'Penrose action', pattern: /Penrose action/i },
  { name: 'portfolio action', pattern: /portfolio action/i },
  { name: 'model-book', pattern: /model-book/i },
  { name: 'target price', pattern: /target\s*price|目標株価/i },
  { name: 'investment rating', pattern: /\b(BUY|SELL|HOLD|Maintain core long|core long)\b/i },
  { name: 'manifest conviction', pattern: /conviction_recommendation/i },
];

const SAFE_PLACEHOLDER = /# Authenticated report moved/;

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function checkFile(path) {
  const text = await readFile(path, 'utf8');
  if (SAFE_PLACEHOLDER.test(text)) return [];
  return FORBIDDEN
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => ({ path, rule: rule.name }));
}

async function main() {
  const failures = [];
  for (const root of ROOTS) {
    for await (const path of walk(root)) {
      if (/\.(md|json|txt)$/i.test(path)) failures.push(...await checkFile(path));
    }
  }
  for (const manifest of MANIFESTS) {
    if (await fileExists(manifest)) failures.push(...await checkFile(manifest));
  }

  if (failures.length) {
    console.error('Static report leakage check failed. Internal reports must be served through Supabase/brain-query.');
    for (const failure of failures) {
      console.error(`- ${failure.path}: ${failure.rule}`);
    }
    process.exit(1);
  }
  console.log('Static report leakage check passed.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
