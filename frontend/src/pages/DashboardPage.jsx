import { useEffect, useState, useMemo } from "react";
import { LearningBuddyAPI } from "../lib/api";
import { Backend, getToken } from "../lib/backend";

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k]) return obj[k];
  }
  return undefined;
}

export default function DashboardPage() {
  const [paths, setPaths] = useState([]);
  const [error, setError] = useState("");
  const [recs, setRecs] = useState(null);
  const [progress, setProgress] = useState([]);
  const [summary, setSummary] = useState([]);
  const [profile, setProfile] = useState(null);
  const [subskills, setSubskills] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [recsLoading, setRecsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const data = await LearningBuddyAPI.learningPaths({ select: "*", limit: 5 });
        if (mounted && Array.isArray(data) && data.length) {
          setPaths(data);
          return;
        }
      } catch (e) {
        // abaikan, coba backend lokal sebagai fallback
      }

      // Fallback: baca dari backend lokal yang memuat Excel
      try {
        const res = await fetch("/api/data/lp_course_mapping");
        if (!res.ok) throw new Error("Gagal memuat data lokal");
        const payload = await res.json();
        const rows = payload.rows || [];
        if (mounted) setPaths(rows);
      } catch (e) {
        if (mounted) setError(e?.message || String(e));
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, []);

  const loadRecs = async () => {
    if (!getToken()) {
      setError("Silakan login terlebih dahulu untuk melihat rekomendasi personal.");
      return;
    }
    setError("");
    setRecsLoading(true);
    try {
      const data = await Backend.recommendByOnboarding();
      setRecs(data);
      setStatusMsg("Rekomendasi diperbarui berdasarkan progres terkinimu.");
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setRecsLoading(false);
    }
  };

  const syncProgress = async () => {
    try {
      const [pc, sm] = await Promise.all([Backend.progressByCourse(), Backend.progressSummary(7)]);
      setProgress(pc);
      setSummary(sm);
    } catch (e) {}
  };

  useEffect(() => { syncProgress(); }, []);

  useEffect(() => {
    Backend.onboardingProfile().then(setProfile).catch(() => setProfile(null));
    Backend.assessmentLatest().then(setSubskills).catch(() => setSubskills([]));
  }, []);

  const mark = async (action, c) => {
    try {
      if (!getToken()) {
        setError("Silakan login sebelum mencatat progres.");
        return;
      }
      const identifier = c.id ?? c.course_id ?? c.slug ?? pick(c,["name","title","course_name"]);
      const fallbackSkillObj = subskills.find((s) => s.level !== "Advanced");
      const payload = {
        action,
        course_name: pick(c,["name","title","course_name"]) || "",
        subskill: c.subskill || (fallbackSkillObj ? fallbackSkillObj.subskill : undefined),
        minutes: action === "complete" ? 40 : 20,
      };
      if (identifier) payload.course_id = String(identifier);
      await Backend.progress(action, {
        ...payload,
      });
      setStatusMsg(`Progres ${payload.course_name || identifier} diperbarui (${action}).`);
      await syncProgress();
    } catch (e) { setError(e?.message || String(e)); }
  };

  const topSubskills = useMemo(() => {
    const map = new Map();
    subskills.forEach((item) => {
      if (!map.has(item.subskill)) {
        map.set(item.subskill, item);
      }
    });
    return Array.from(map.values()).sort((a,b) => a.score - b.score).slice(0,6);
  }, [subskills]);

  return (
    <div className="auth-wrap">
      <div className="card" style={{width:"100%", maxWidth:900}}>
        <h1>Dashboard</h1>
        <p className="muted">Persiapkan roadmap belajarmu dengan data onboarding dan progres aktual.</p>
        {error && <div className="muted" style={{ color: "#b91c1c" }}>{error}</div>}
        {statusMsg && <div className="muted" style={{ color: "#0f172a", fontWeight:600 }}>{statusMsg}</div>}

        {profile ? (
          <div style={{background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:16, marginBottom:18}}>
            <div style={{fontWeight:700}}>Profil Belajar</div>
            <div className="muted">Role: {profile.role || "-"} • Level: {profile.experience || "-"}</div>
            <div style={{marginTop:8}}>{profile.goal || "Belum ada tujuan."}</div>
          </div>
        ) : (
          <div className="muted" style={{marginBottom:18}}>Lengkapi onboarding untuk melihat rekomendasi personal. <a className="link" href="/onboarding">Mulai onboarding</a></div>
        )}

        {topSubskills.length > 0 && (
          <div style={{marginBottom:18}}>
            <h2>Prioritas Skill</h2>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12}}>
              {topSubskills.map((s) => (
                <div key={s.subskill} style={{border:"1px solid #e2e8f0", borderRadius:10, padding:12}}>
                  <div style={{fontWeight:700}}>{s.subskill}</div>
                  <div className="muted">Level: {s.level} ({s.score})</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2>Learning Path</h2>
        {paths.length > 0 ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            gap: 12, marginBottom: 16
          }}>
            {paths.slice(0, 8).map((p, i) => (
              <button key={i} onClick={() => setSelectedPathId(p.id || p.learning_path_id || i)} style={{
                background: (p.id || p.learning_path_id || i) === selectedPathId ? "#e8edff" : "#fff", border: "1px solid #e2e8f0",
                borderRadius: 10, padding: 12, boxShadow: "var(--shadow)", textAlign:"left", cursor:"pointer"
              }}>
                <div style={{fontWeight:700}}>{pick(p,["learning_path_name","name","title","lp_name"])||`Learning Path #${p.id||i+1}`}</div>
                {pick(p,["description"]) && (
                  <div className="muted" style={{marginTop:6}}>{pick(p,["description"])}</div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="muted" style={{marginBottom:16}}>Tidak ada data atau jaringan dibatasi.</div>
        )}

        {(() => {
          const selectedPath = paths.find((p, idx) => (p.id || p.learning_path_id || idx) === selectedPathId);
          return selectedPath ? (
          <div style={{marginBottom:18, border:"1px solid #e2e8f0", borderRadius:12, padding:16}}>
            <div style={{fontWeight:700}}>Langkah untuk {pick(selectedPath,["learning_path_name","name","title","lp_name"])} </div>
            <div className="muted" style={{marginTop:6}}>Prioritaskan sub-skill berikut agar selaras dengan role ini:</div>
            <ul>
              {topSubskills.slice(0,3).map((s) => (
                <li key={s.subskill}>{s.subskill} • {s.level}</li>
              ))}
            </ul>
          </div>
          ) : null;
        })()}

        <h2>Rekomendasi untukmu</h2>
        <button className="btn primary" onClick={loadRecs} style={{marginBottom:10}} disabled={recsLoading}>
          {recsLoading ? "Memuat..." : "Ambil Rekomendasi"}
        </button>
        {recs ? (
          <div>
            {(recs.role || recs.experience) && (
              <div className="muted" style={{marginBottom:8}}>
                {recs.role ? `Role: ${recs.role}` : ""} {recs.experience ? `• Level: ${recs.experience}` : ""}
              </div>
            )}
            {(recs.courses || []).length > 0 ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                gap: 12
              }}>
                {(recs.courses || []).slice(0,8).map((c, i) => (
                  <div key={i} style={{background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12}}>
                    <div style={{fontWeight:700}}>{pick(c,["name","title","course_name"])||`Course #${i+1}`}</div>
                    {pick(c,["level"]) && <div className="muted" style={{marginTop:6}}>Level: {pick(c,["level"])}</div>}
                    <div style={{display:"flex", gap:8, marginTop:10}}>
                      <button className="btn" onClick={() => mark('start', c)}>Mulai</button>
                      <button className="btn" onClick={() => mark('complete', c)}>Selesai</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">Belum ada rekomendasi dari profilmu. Lengkapi onboarding dan asesmen, lalu coba klik Ambil Rekomendasi lagi.</div>
            )}
          </div>
        ) : (
          <div className="muted">Klik tombol di atas untuk memuat rekomendasi berbasis onboarding.</div>
        )}

        <h2 style={{marginTop:18}}>Ringkasan Mingguan</h2>
        {summary && summary.length > 0 ? (
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12}}>
            {summary.map((s, i) => (
              <div key={i} style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:12}}>
                <div style={{fontWeight:700}}>{s.subskill || 'Umum'}</div>
                <div className="muted" style={{marginTop:6}}>Status: {s.status} • Jumlah: {s.cnt} • Menit: {s.mins||0}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Belum ada progres. Klik Mulai/Selesai pada kursus untuk merekam aktivitas.</div>
        )}

        {progress.length > 0 && (
          <div style={{marginTop:18}}>
            <h2>Log Aktivitas Terbaru</h2>
            <ul>
              {progress.slice(0,5).map((p, idx) => (
                <li key={idx}>{p.course_name || p.course_id || 'Kursus'} • {p.status} • {new Date(p.updated_at).toLocaleString()}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
