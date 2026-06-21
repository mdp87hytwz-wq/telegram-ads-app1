const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  tg.expand();
}

const API_BASE = window.APP_CONFIG.API_BASE_URL;

function authHeaders() {
  const initData = tg ? tg.initData : '';
  return { 'X-Telegram-Init-Data': initData };
}

async function apiGet(pathName, params = {}) {
  const url = new URL(API_BASE + pathName);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();
}

async function apiPost(pathName, body) {
  const res = await fetch(API_BASE + pathName, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();
}

async function apiPostForm(pathName, formData) {
  const res = await fetch(API_BASE + pathName, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();
}

async function apiDelete(pathName) {
  const res = await fetch(API_BASE + pathName, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();
}

const Api = { get: apiGet, post: apiPost, postForm: apiPostForm, del: apiDelete };
