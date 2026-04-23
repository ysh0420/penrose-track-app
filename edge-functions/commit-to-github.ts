// Supabase edge function: commit-to-github
// Deployed to: prdjmipmkomhvokwrjid (penrose-track project)
// Purpose: Generic GitHub commit/delete proxy used by Claude to update repo files
// Uses GITHUB_PAT env var (fine-grained PAT with contents: write on ysh0420/penrose-track-app)
//
// POST body: { action: 'commit'|'delete', path, content?, message?, branch?, repo? }
// default action: 'commit', default repo: ysh0420/penrose-track-app, default branch: main
// verify_jwt: false (GITHUB_PAT is the security boundary)

const GITHUB_PAT = Deno.env.get('GITHUB_PAT');
const DEFAULT_REPO = 'ysh0420/penrose-track-app';
const DEFAULT_BRANCH = 'main';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!GITHUB_PAT) return json({ error: 'GITHUB_PAT secret not set' }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const action = String(body.action || 'commit');
  const path = String(body.path || '');
  const branch = String(body.branch || DEFAULT_BRANCH);
  const repo = String(body.repo || DEFAULT_REPO);
  const message = String(body.message || (action === 'delete' ? 'Delete ' + path : 'Update ' + path));

  if (!path) return json({ error: 'path required' }, 400);

  const ghHeaders = {
    'Authorization': 'Bearer ' + GITHUB_PAT,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'penrose-track-app-deployer'
  };

  const getUrl = 'https://api.github.com/repos/' + repo + '/contents/' + path + '?ref=' + branch;
  const getResp = await fetch(getUrl, { headers: ghHeaders });

  let existingSha: string | null = null;
  if (getResp.ok) {
    const existing = await getResp.json();
    existingSha = existing.sha;
  } else if (getResp.status !== 404) {
    const err = await getResp.text();
    return json({ error: 'GitHub GET failed', status: getResp.status, detail: err }, 500);
  }

  if (action === 'delete') {
    if (!existingSha) return json({ ok: true, note: 'File already does not exist', path, repo });
    const delResp = await fetch('https://api.github.com/repos/' + repo + '/contents/' + path, {
      method: 'DELETE',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha: existingSha, branch })
    });
    if (!delResp.ok) {
      const err = await delResp.text();
      return json({ error: 'GitHub DELETE failed', status: delResp.status, detail: err }, 500);
    }
    const result = await delResp.json();
    return json({ ok: true, path, repo, branch, action: 'deleted', commit_sha: result.commit?.sha, commit_url: result.commit?.html_url });
  }

  const content = String(body.content || '');
  if (!content) return json({ error: 'content required for commit' }, 400);

  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const contentB64 = btoa(binary);

  const putBody: Record<string, unknown> = { message, content: contentB64, branch };
  if (existingSha) putBody.sha = existingSha;

  const putResp = await fetch('https://api.github.com/repos/' + repo + '/contents/' + path, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody)
  });

  if (!putResp.ok) {
    const err = await putResp.text();
    return json({ error: 'GitHub PUT failed', status: putResp.status, detail: err }, 500);
  }

  const result = await putResp.json();
  return json({
    ok: true, path, repo, branch,
    action: existingSha ? 'updated' : 'created',
    commit_sha: result.commit?.sha,
    commit_url: result.commit?.html_url,
    content_url: result.content?.html_url
  });
});
