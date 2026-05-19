import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

async function read(path) {
  return readFile(join(root, path), 'utf8');
}

async function htmlFiles(dir = root) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory() && !['.git', 'node_modules'].includes(entry.name)) {
      files.push(...await htmlFiles(abs));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(abs);
    }
  }
  return files;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const nav = await read('js/platform-nav.js');
if (nav.includes('label: "Signals"') || nav.includes('id: "pipeline"') || nav.includes('/pipeline.html')) {
  fail('platform-nav.js must not include Signals or pipeline navigation.');
}

const brainQueries = await read('js/brain-queries.js');
if (!brainQueries.includes('fn_get_research_reviewer_queue')) {
  fail('brain-queries.js must expose the read-only reviewer queue RPC.');
}
if (brainQueries.includes('generate_research_reviewer_queue') || brainQueries.includes('record_reviewer_queue_decision')) {
  fail('browser queries must not expose reviewer queue generate/write RPCs.');
}

const brainReview = await read('brain-review.html');
if (!brainReview.includes('id="reviewer-queue"')) {
  fail('brain-review.html must include the Reviewer Queue panel.');
}

const ideas = await read('ideas.html');
if (!ideas.includes('href="/brain-review.html"')) {
  fail('ideas.html inbox must link to /brain-review.html.');
}
if (ideas.includes('href="/pipeline.html"')) {
  fail('ideas.html must not link to /pipeline.html.');
}

const pipeline = await read('pipeline.html');
if (!pipeline.includes('url=/brain-review.html') || !pipeline.includes('href="/brain-review.html"')) {
  fail('pipeline.html must redirect to /brain-review.html.');
}
if (pipeline.includes('page-pipeline.js') || pipeline.includes('EDINET Activist Signals')) {
  fail('pipeline.html must not render the retired signal table.');
}

const htmlRefs = [];
for (const file of await htmlFiles()) {
  const body = await readFile(file, 'utf8');
  if (body.includes('page-pipeline.js')) htmlRefs.push(file);
}
if (htmlRefs.length) {
  fail(`HTML still references page-pipeline.js: ${htmlRefs.join(', ')}`);
}

if (!process.exitCode) console.log('Track App regression checks passed.');
