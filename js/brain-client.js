// @ts-check
// Brain Supabase auth + Edge Function gateway client.
// Single source of truth for all Brain access from the browser.
//
// Hardcoded creds match the existing Track Record convention in
// index.html (which inlines its own Supabase URL + publishable key).
// SUPABASE_BRAIN_ANON_KEY is a public role:anon JWT — the actual
// security boundary is RLS plus the brain-query Edge Function's user
// allowlist. Safe to commit to a public repo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_BRAIN_URL = "https://jviciwafctmmixgjszam.supabase.co";
const SUPABASE_BRAIN_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aWNpd2FmY3RtbWl4Z2pzemFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDQ0MzksImV4cCI6MjA5MjI4MDQzOX0.IClxZsICjX7BrbboeIfdpTmsbOTyFNQ1mJhlRH1WvBY";
const EDGE_FN_BRAIN_QUERY_URL = "https://jviciwafctmmixgjszam.supabase.co/functions/v1/brain-query";

// storageKey isolates Brain auth from Track Record auth so both
// projects can be signed-in simultaneously in the same tab.
export const brainAuth = createClient(SUPABASE_BRAIN_URL, SUPABASE_BRAIN_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "brain-auth" },
});

/** Sign in with email + password. Throws on error. */
export async function brainSignIn(email, password) {
  const { data, error } = await brainAuth.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/** Send a magic-link email. Throws on error. */
export async function brainSignInWithOtp(email) {
  const { error } = await brainAuth.auth.signInWithOtp({ email });
  if (error) throw error;
}

/** Sign out the current Brain session. */
export async function brainSignOut() {
  await brainAuth.auth.signOut();
}

/** Get the current Brain user, or null. */
export async function brainCurrentUser() {
  const { data: { session } } = await brainAuth.auth.getSession();
  return session?.user ?? null;
}

/**
 * Call any whitelisted Brain RPC through the brain-query Edge Function.
 * Throws on auth/network/server error with structured `code` + `status`.
 */
export async function brainQuery(rpcName, params = {}) {
  const { data: { session } } = await brainAuth.auth.getSession();
  if (!session) {
    const err = new Error("Not authenticated to Brain");
    /** @type {any} */(err).code = "BRAIN_NOT_AUTH";
    throw err;
  }

  const res = await fetch(EDGE_FN_BRAIN_QUERY_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rpc_name: rpcName, params }),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    const err = new Error(`brain-query returned non-JSON: ${res.status}`);
    /** @type {any} */(err).status = res.status;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(body?.error ?? `brain-query failed: ${res.status}`);
    /** @type {any} */(err).status = res.status;
    /** @type {any} */(err).code = body?.code;
    throw err;
  }
  return body.data;
}

/**
 * Mount the full-page #brain-login / #brain-app gate, mirroring the
 * existing index.html signInWithPassword + signInWithOtp pattern.
 *
 * The page must contain:
 *   <div id="brain-login"></div>
 *   <div id="brain-app" style="display:none">…page content…</div>
 *   (optional) any element with id="brain-signout" inside #brain-app
 *
 * Calls onAuthed(user) once a session exists. If the user signs out
 * later, the page reloads to bounce back to the login screen.
 */
export async function mountBrainAuthGate({ onAuthed }) {
  const loginEl = document.getElementById("brain-login");
  const appEl = document.getElementById("brain-app");
  if (!loginEl || !appEl) {
    throw new Error("mountBrainAuthGate: missing #brain-login or #brain-app");
  }

  loginEl.innerHTML = `
    <div class="brain-login-wrap">
      <div class="brain-login-card">
        <h1>Penrose <span>Brain</span></h1>
        <div class="brain-login-subtitle">Research access — separate from Track Record</div>
        <label for="brain-email">Email</label>
        <input type="email" id="brain-email" autocomplete="email" placeholder="yuki@penrose-japan.co.uk"/>
        <label for="brain-password">Password</label>
        <input type="password" id="brain-password" autocomplete="current-password"/>
        <button class="brain-login-btn" id="brain-login-submit" type="button">Sign in</button>
        <button class="brain-login-btn brain-login-magic" id="brain-magic-submit" type="button">Email magic link instead</button>
        <div id="brain-login-msg"></div>
      </div>
    </div>
  `;

  const msg = document.getElementById("brain-login-msg");
  const setMsg = (kind, text) => { msg.className = "brain-login-" + kind; msg.textContent = text; };

  document.getElementById("brain-login-submit").addEventListener("click", async () => {
    const email = /** @type {HTMLInputElement} */(document.getElementById("brain-email")).value.trim();
    const password = /** @type {HTMLInputElement} */(document.getElementById("brain-password")).value;
    if (!email || !password) { setMsg("err", "Email + password required"); return; }
    setMsg("", "");
    try {
      await brainSignIn(email, password);
      showApp(await brainCurrentUser());
    } catch (e) { setMsg("err", e.message ?? "Sign-in failed"); }
  });

  document.getElementById("brain-magic-submit").addEventListener("click", async () => {
    const email = /** @type {HTMLInputElement} */(document.getElementById("brain-email")).value.trim();
    if (!email) { setMsg("err", "Email required"); return; }
    try {
      await brainSignInWithOtp(email);
      setMsg("ok", "Check your email for the magic link.");
    } catch (e) { setMsg("err", e.message ?? "Magic-link send failed"); }
  });

  function showLogin() { loginEl.style.display = "block"; appEl.style.display = "none"; }
  function showApp(user) {
    loginEl.style.display = "none";
    appEl.style.display = "block";
    const signOut = document.getElementById("brain-signout");
    if (signOut && !signOut.dataset.brainWired) {
      signOut.dataset.brainWired = "1";
      signOut.addEventListener("click", async (e) => {
        e.preventDefault();
        await brainSignOut();
        location.reload();
      });
    }
    const emailSlot = document.getElementById("brain-user-email");
    if (emailSlot) emailSlot.textContent = user?.email ?? "";
    onAuthed?.(user);
  }

  const user = await brainCurrentUser();
  if (user) showApp(user); else showLogin();
}
