const BASE = "https://jrkqcbmjknzgpbtrupxh.supabase.co/rest/v1";
const KEY = "sb_publishable_h889CjrPIGwCMA9I4oTTaA_2L22Y__R";

export async function apiGet(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const LearningBuddyAPI = {
  learningPaths: (params) => apiGet("/learning_paths", params),
  courses: (params) => apiGet("/courses", params),
  courseLevels: (params) => apiGet("/course_levels", params),
  tutorials: (params) => apiGet("/tutorials", params),
};

