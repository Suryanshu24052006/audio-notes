import { API_URL } from "./site";

// one private session per browser: the api keeps the session, the browser keeps a random token for it.
// sent as a header, not a cookie, because the site and the api are on different domains
// and safari blocks cookies across domains
const KEY = "audio-notes-session";
let memoryToken = null; // used if localStorage is blocked
let pending = null;

function readToken() {
  try {
    return localStorage.getItem(KEY) || memoryToken;
  } catch {
    return memoryToken;
  }
}

function saveToken(token) {
  memoryToken = token;
  try {
    localStorage.setItem(KEY, token);
  } catch {}
}

export function forgetSession() {
  memoryToken = null;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export async function getSessionToken() {
  const saved = readToken();
  if (saved) return saved;

  // several requests can start at once on page load, so they share one POST /sessions
  if (!pending) {
    pending = fetch(API_URL + "/sessions", { method: "POST" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.token) saveToken(body.token);
        return body?.token || null;
      })
      .catch(() => null)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
