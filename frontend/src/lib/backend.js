const API = "/api";

let token = null;

export function setToken(t) {
  token = t;
  try { localStorage.setItem("lb_auth", JSON.stringify({ token })); } catch {}
}

export function getToken() {
  if (token) return token;
  try {
    const raw = localStorage.getItem("lb_auth");
    if (raw) token = JSON.parse(raw).token;
  } catch {}
  return token;
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function jfetch(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...authHeaders(),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const Backend = {
  // Auth
  async register({ name, email, password }) {
    const data = await jfetch("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    setToken(data.token);
    return data;
  },
  async login({ email, password }) {
    const data = await jfetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setToken(data.token);
    return data;
  },
  logout() {
    token = null;
    try { localStorage.removeItem("lb_auth"); } catch {}
  },

  // Onboarding
  saveOnboarding(payload) {
    return jfetch("/onboarding", { method: "POST", body: JSON.stringify(payload) });
  },

  // Assessment
  submitAssessment(payload) {
    return jfetch("/assessment/submit", { method: "POST", body: JSON.stringify(payload) });
  },

  // Conversations
  createConversation(title) {
    return jfetch("/conversations", { method: "POST", body: JSON.stringify({ title }) });
  },
  listConversations() {
    return jfetch("/conversations");
  },
  getMessages(cid) {
    return jfetch(`/conversations/${cid}/messages`);
  },
  async sendMessage(cid, text) {
    const data = await jfetch(`/conversations/${cid}/messages`, { method: "POST", body: JSON.stringify({ text }) });
    return data.reply;
  },
};
