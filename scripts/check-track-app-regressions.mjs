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
if (!brainQueries.includes('fn_get_model_portfolio_v2_log_dashboard')) {
  fail('brain-queries.js must expose the read-only Portfolio V2 log RPC.');
}
if (!brainQueries.includes('fn_get_koyfin_watchlist_snapshot_dashboard')) {
  fail('brain-queries.js must expose the read-only Koyfin snapshot dashboard RPC.');
}
if (brainQueries.includes('fn_get_model_portfolio_v2_evaluation_dashboard')) {
  fail('brain-queries.js must not expose the retired V2 evaluation/v1-comparison RPC.');
}
if (brainQueries.includes('generate_research_reviewer_queue') || brainQueries.includes('record_reviewer_queue_decision')) {
  fail('browser queries must not expose reviewer queue generate/write RPCs.');
}
if (brainQueries.includes('start_research_session') || brainQueries.includes('trigger-research')) {
  fail('browser queries must not expose AI/research execution paths.');
}

const portfolioV2 = await read('portfolio-v2-review.html');
if (!portfolioV2.includes('page-portfolio-v2-review.js')) {
  fail('portfolio-v2-review.html must mount the Portfolio V2 Review page script.');
}
if (!portfolioV2.includes('Today’s PM Actions') || !portfolioV2.includes('pv2-pm-decision-queue') || !portfolioV2.includes('pv2-coverage-backlog')) {
  fail('portfolio-v2-review.html must expose the V2 PM cockpit sections.');
}
if (!nav.includes('id: "model-v2"') || !nav.includes('/portfolio-v2-review.html')) {
  fail('platform-nav.js must expose Portfolio V2 Review as the primary model portfolio review entrypoint.');
}
if (!nav.includes('id: "model-v2-log"') || !nav.includes('/portfolio-v2-log.html')) {
  fail('platform-nav.js must expose Portfolio V2 Daily Log in the portfolio navigation.');
}
if (!nav.includes('id: "data-coverage"') || !nav.includes('/data-coverage.html')) {
  fail('platform-nav.js must expose Data Coverage in the Brain navigation.');
}
if (nav.includes('model-v2-evaluation') || nav.includes('/portfolio-v2-evaluation.html')) {
  fail('platform-nav.js must not expose retired V2 Evaluation navigation.');
}
const portfolioV2Js = await read('js/page-portfolio-v2-review.js');
if (portfolioV2Js.includes('getAiModelPortfolioPreview') || portfolioV2Js.includes('recordBrainReviewDecision') || portfolioV2Js.includes('getModelPortfolioDashboard')) {
  fail('Portfolio V2 Review must remain read-only and must not use AI preview or write helpers.');
}
if (portfolioV2Js.includes('start_research_session') || portfolioV2Js.includes('trigger-research') || portfolioV2Js.includes('confirm-rebalance')) {
  fail('Portfolio V2 Review must not expose research execution or rebalance execution.');
}
if (portfolioV2Js.includes('v1_score') || portfolioV2Js.includes('v1_target') || portfolioV2Js.includes('Legacy/debug comparison')) {
  fail('Portfolio V2 Review must not surface v1 comparison as an operating layer.');
}
if (!portfolioV2Js.includes('primaryReason') || !portfolioV2Js.includes('nextRequiredInput') || !portfolioV2Js.includes('renderTodayActions')) {
  fail('Portfolio V2 Review must derive primary_reason, next_required_input, and Today PM Actions deterministically.');
}

const portfolioV2Log = await read('portfolio-v2-log.html');
if (!portfolioV2Log.includes('page-portfolio-v2-log.js')) {
  fail('portfolio-v2-log.html must mount the Portfolio V2 Daily Log page script.');
}
const portfolioV2LogJs = await read('js/page-portfolio-v2-log.js');
if (!portfolioV2LogJs.includes('getModelPortfolioV2LogDashboard')) {
  fail('Portfolio V2 Daily Log must use the read-only V2 log dashboard query.');
}
if (portfolioV2LogJs.includes('getAiModelPortfolioPreview') || portfolioV2LogJs.includes('recordBrainReviewDecision') || portfolioV2LogJs.includes('getModelPortfolioDashboard')) {
  fail('Portfolio V2 Daily Log must remain read-only and must not use AI preview, legacy model book, or write helpers.');
}
if (
  portfolioV2LogJs.includes('start_research_session') ||
  portfolioV2LogJs.includes('trigger-research') ||
  portfolioV2LogJs.includes('confirm-rebalance') ||
  portfolioV2LogJs.includes('publish_research_report')
) {
  fail('Portfolio V2 Daily Log must not expose research execution, rebalance execution, or report publication.');
}
if (portfolioV2LogJs.includes('v1_score') || portfolioV2LogJs.includes('v1_target')) {
  fail('Portfolio V2 Daily Log must not surface v1 score or target weight fields.');
}

const dataCoverageHtml = await read('data-coverage.html');
if (!dataCoverageHtml.includes('page-data-coverage.js')) {
  fail('data-coverage.html must mount the Data Coverage page script.');
}
if (!dataCoverageHtml.includes('Koyfin raw paid-source rows are internal and not displayed here.')) {
  fail('data-coverage.html must include the Koyfin raw-row safety copy.');
}
const dataCoverageJs = await read('js/page-data-coverage.js');
if (!dataCoverageJs.includes('getKoyfinWatchlistSnapshotDashboard')) {
  fail('Data Coverage must use the read-only Koyfin snapshot dashboard query.');
}
for (const rawSnippet of ['sample_rows', 'canonical_symbol', 'company_name', 'last_price', 'computed_features']) {
  if (dataCoverageJs.includes(rawSnippet)) {
    fail(`Data Coverage must not expose raw Koyfin row fields; found ${rawSnippet}.`);
  }
}

const readOnlyBrowserFiles = {
  'js/brain-queries.js': brainQueries,
  'js/page-portfolio-v2-review.js': portfolioV2Js,
  'js/page-portfolio-v2-log.js': portfolioV2LogJs,
  'js/page-data-coverage.js': dataCoverageJs,
};
const forbiddenBrowserSnippets = [
  'startResearchSession',
  'start_research_session',
  'trigger-research',
  'run_research',
  'confirm-rebalance',
  '--write',
  '.insert(',
  '.update(',
  '.delete(',
  'service-role',
  'service_role',
  'SERVICE_ROLE',
  'SUPABASE_SERVICE',
];
for (const [file, body] of Object.entries(readOnlyBrowserFiles)) {
  for (const snippet of forbiddenBrowserSnippets) {
    if (body.includes(snippet)) {
      fail(`${file} must remain read-only; forbidden browser snippet found: ${snippet}`);
    }
  }
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
