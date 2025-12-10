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
  if (!res.ok) {
    let text = await res.text();
    try {
      const data = JSON.parse(text);
      text = data.detail || data.message || text;
    } catch (_) {
      // plain text
    }
    throw new Error(text);
  }
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
  onboardingProfile() {
    return jfetch("/onboarding/last");
  },

  // Assessment
  submitAssessment(payload) {
    return jfetch("/assessment/submit", { method: "POST", body: JSON.stringify(payload) });
  },
  assessmentLatest() {
    return jfetch("/assessment/last");
  },

  // ML
  recommendByOnboarding() {
    return jfetch("/recommend/by_onboarding");
  },
  extractSkills(text) {
    return jfetch("/ml/extract_skills", { method: "POST", body: JSON.stringify({ text }) });
  },
  recommendByQuery(query, limit = 6) {
    return jfetch("/ml/recommend_by_query", { method: "POST", body: JSON.stringify({ query, limit }) });
  },
  recommendCoursesST({ user_input, user_level = null, top_k = 5 }) {
    return jfetch("/ml-advanced/recommend_courses_st", {
      method: "POST",
      body: JSON.stringify({ user_input, user_level, top_k }),
    });
  },
  predictNextSkills({ query, top_n = 5 }) {
    return jfetch("/ml-advanced/predict_next_skills", {
      method: "POST",
      body: JSON.stringify({ query, top_n }),
    });
  },
  detectJobAndSkills(description, top_k = 6) {
    return jfetch("/ml-advanced/detect_job_and_skills", { method: "POST", body: JSON.stringify({ description, top_k }) });
  },
  generateAssessment(subskills, total_questions = 18) {
    return jfetch("/ml-advanced/generate_assessment", { method: "POST", body: JSON.stringify({ subskills, total_questions }) });
  },
  submitAssessmentAdvanced(payload) {
    return jfetch("/ml-advanced/submit_assessment", { method: "POST", body: JSON.stringify(payload) });
  },
  generateLearningStrategy({ query, goal = null, top_n = 5 }) {
    return jfetch("/ml-advanced/generate_learning_strategy", { method: "POST", body: JSON.stringify({ query, goal, top_n }) });
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
  deleteConversation(cid) {
    return jfetch(`/conversations/${cid}`, { method: "DELETE" });
  },

  // Progress
  progress(action, { course_id, course_name, subskill, minutes }) {
    return jfetch("/progress", { method: "POST", body: JSON.stringify({ action, course_id, course_name, subskill, minutes }) });
  },
  progressByCourse() {
    return jfetch("/progress/by_course");
  },
  progressSummary(days = 7) {
    return jfetch(`/progress/summary?days=${days}`);
  }
};
