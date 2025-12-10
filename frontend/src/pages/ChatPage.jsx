import { useEffect, useRef, useState } from "react";
import ChatBubble from "../components/ChatBubble";
import { Backend } from "../lib/backend";
import { sendMessageToBot } from "../lib/chatApi";

export default function ChatPage({ compact = false }) {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [progressSummary, setProgressSummary] = useState(null);
  const [progressStats, setProgressStats] = useState([]);
  const [lastSkills, setLastSkills] = useState([]);
  const [lastSchedule, setLastSchedule] = useState([]);
  const [strategySource, setStrategySource] = useState(null); // "gemini" atau "fallback"
  const [lastStrategyText, setLastStrategyText] = useState("");
  const [courseCards, setCourseCards] = useState([]);
  const [miniAssessment, setMiniAssessment] = useState(null); // {assessment, answers}
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(
    typeof window !== "undefined" ? window.innerWidth > 1024 : true
  );
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 1024) setShowContextPanel(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const bottomRef = useRef(null);

  const loadConversations = () => {
    Backend.listConversations().then((list) => {
      setConvs(list);
      if (!list.length) {
        setActive(null);
        setMessages([]);
        return;
      }
      const stillActive = list.find((item) => item.id === active);
      if (!stillActive) {
        const nextId = list[0].id;
        setActive(nextId);
        Backend.getMessages(nextId).then(setMessages).catch(() => setMessages([]));
      }
    }).catch(() => setConvs([]));
  };

  const removeConversation = async (cid) => {
    const ok = window.confirm("Hapus percakapan ini?");
    if (!ok) return;
    try {
      await Backend.deleteConversation(cid);
      setConvs((prev) => prev.filter((c) => c.id !== cid));
      if (active === cid) {
        setActive(null);
        setMessages([]);
      }
      loadConversations();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    Backend.onboardingProfile().then(setProfile).catch(() => setProfile(null));
    Backend.progressSummary(7).then(setProgressSummary).catch(() => setProgressSummary(null));
    Backend.progressByCourse().then((res) => {
      if (Array.isArray(res)) {
        const top3 = res.sort((a, b) => (b.minutes || 0) - (a.minutes || 0)).slice(0, 3);
        setProgressStats(top3);
      }
    }).catch(() => setProgressStats([]));
  }, []);

  useEffect(() => {
    // Auto scroll ke bawah hanya jika ada pesan
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const openConv = async (cid) => {
    setActive(cid);
    try { const msgs = await Backend.getMessages(cid); setMessages(msgs); } catch { setMessages([]); }
  };

  const newConversation = async () => {
    const { id } = await Backend.createConversation("Obrolan baru");
    await openConv(id);
    setConvs((c) => [{ id, title: "Obrolan baru" }, ...c]);
    return id;
  };

  const send = async (customText) => {
    const raw = typeof customText === "string" ? customText : input;
    const text = raw.trim();
    if (!text) return;
    if (typeof customText === "string") setInput("");
    const next = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      let cid = active;
      if (!cid) {
        cid = await newConversation();
        setActive(cid);
      }
      // 1) Coba langsung minta strategi belajar via ML-Advanced (Gemini)
      const strategyRes = await Backend.generateLearningStrategy({
        query: text,
        goal: profile?.goal || null,
        top_n: 5,
      });
      const strategyText = strategyRes?.strategy || "(Tidak ada strategi yang dihasilkan.)";
      const nextSkills = strategyRes?.next_skills || [];
      setLastSkills(nextSkills);
      setLastStrategyText(strategyText || "");
      setStrategySource(strategyText?.toLowerCase().includes("gagal membuat strategi") ? "fallback" : "gemini");
      setLastSchedule(parseSchedule(strategyText));
      setCourseCards([]); // reset kursus jika fokus strategi
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
                <span>Saran strategi belajar</span>
                <span style={{
                  background: strategyText?.toLowerCase().includes("gagal membuat strategi") ? "#f59e0b" : "#10b981",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "4px 8px",
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  {strategyText?.toLowerCase().includes("gagal membuat strategi") ? "Fallback lokal" : "Gemini"}
                </span>
                <button
                  style={{ marginLeft: "auto", border: "none", background: "#e0f2fe", color: "#0f172a", padding: "6px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                  onClick={() => navigator.clipboard?.writeText(strategyText || "")}
                  title="Salin strategi"
                >
                  Salin
                </button>
              </div>
              {nextSkills?.length ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {nextSkills.map((s) => (
                    <span key={s} style={{ background: "#eef2ff", color: "#312e81", padding: "6px 10px", borderRadius: 12, fontWeight: 700, fontSize: 12 }}>
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
              <div style={{ whiteSpace: "pre-wrap" }}>{strategyText}</div>
            </div>
          ),
        },
      ]);
      setConvs((list) => list.map((item) => {
          if (item.id === cid && item.title.toLowerCase().startsWith("obrolan baru")) {
            return { ...item, title: text.slice(0, 40) };
          }
          return item;
        }));
      // auto recommend courses if user explicitly asks
      if (/kelas|course|rekomendasi/i.test(text)) {
        fetchCourses(text);
      }
    } catch {
      // 2) Fallback: kirim ke backend chat default
      try {
        let cid = active;
        if (!cid) {
          cid = await newConversation();
        }
        const reply = await Backend.sendMessage(cid, text);
        setMessages((m) => [...m, { role: "bot", text: reply }]);
        setConvs((list) => list.map((item) => {
          if (item.id === cid && item.title.toLowerCase().startsWith("obrolan baru")) {
            return { ...item, title: text.slice(0, 40) };
          }
          return item;
        }));
      } catch {
        // 3) Fallback offline
        try {
          const reply = await sendMessageToBot(text);
          setMessages((m) => [...m, { role: "bot", text: reply }]);
        } catch (_) {
          setMessages((m) => [...m, { role: "bot", text: "(Offline) Baik, saya catat." }]);
        }
      }
    } finally { setLoading(false); }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const parseSchedule = (text) => {
    if (!text) return [];
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const schedule = [];
    lines.forEach((l) => {
      const match = l.match(/hari\s*(\d+)[:\-]?\s*(.+)/i);
      if (match) {
        schedule.push({
          day: Number(match[1]),
          detail: match[2],
        });
      }
    });
    return schedule;
  };

  const suggestionPrompts = profile ? [
    `Rekomendasi kelas untuk ${profile.role || 'role saya'}?`,
    "Apa yang harus saya pelajari minggu ini?",
    "Bantu susun roadmap belajar Dicoding",
    "Tunjukkan progres terakhir saya"
  ] : [
    "Rekomendasi kelas pemula",
    "Roadmap belajar jadi developer",
    "Tips belajar konsisten"
  ];

  const quickActionsList = [
    { label: "3 rekomendasi cepat", text: "Berikan 3 rekomendasi kursus terbaik untuk saya" },
    { label: "5 rekomendasi", text: "Berikan 5 rekomendasi kursus sesuai profil saya" },
    { label: "Roadmap singkat", text: "Buatkan roadmap belajar singkat sesuai tujuan saya" },
    { label: "Assessment singkat", text: null },
  ];

  const templateQuestions = [
    "Susun plan harian 7 hari untuk jadi React Developer",
    "Kelas Dicoding apa saja yang cocok untuk level intermediate backend?",
    "Skill apa yang paling berkembang minggu ini?",
    "Bantu motivasi singkat supaya tetap konsisten belajar",
  ];

  const fetchCourses = async (queryText) => {
    try {
      const res = await Backend.recommendCoursesST({ user_input: queryText, user_level: profile?.experience || null, top_k: 3 });
      const courses = res.courses || [];
      setCourseCards(courses);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Rekomendasi kelas untukmu</div>
              <div style={{ display: "grid", gap: 10 }}>
                {courses.map((c, idx) => (
                  <div key={idx} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{c.title || c.course_name || "Kelas"}</div>
                    <div style={{ color: "#475569", fontSize: 13 }}>{c.level || c.skill_level || "All level"}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(c.tags || c.skills || []).slice(0, 3).map((t) => (
                        <span key={t} className="pill-skill">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ),
        },
      ]);
    } catch (e) {
      console.error("course recommend failed", e);
    }
  };

  const startMiniAssessment = async () => {
    setAssessmentLoading(true);
    setMiniAssessment(null);
    try {
      const subs = lastSkills.length ? lastSkills.slice(0, 3) : ["HTML", "CSS", "JavaScript"];
      const res = await Backend.generateAssessment(subs, 6);
      const assessment = res.assessment || {};
      const initAnswers = {};
      Object.keys(assessment).forEach((k) => { initAnswers[k] = []; });
      setMiniAssessment({ assessment, answers: initAnswers });
      setMessages((m) => [
        ...m,
        { role: "bot", text: "Assessment singkat siap. Jawab pertanyaan di panel bawah, lalu kirim." },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: `Gagal membuat assessment: ${e.message}` }]);
    } finally {
      setAssessmentLoading(false);
    }
  };

  const toggleAnswer = (subskill, idx) => {
    setMiniAssessment((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const arr = next.answers[subskill] ? [...next.answers[subskill]] : [];
      if (arr.includes(idx)) {
        next.answers[subskill] = arr.filter((i) => i !== idx);
      } else {
        next.answers[subskill] = [...arr, idx];
      }
      return next;
    });
  };

  const submitMiniAssessment = async () => {
    if (!miniAssessment) return;
    setAssessmentLoading(true);
    try {
      const payload = { answers: {} };
      Object.entries(miniAssessment.answers).forEach(([sub, arr]) => {
        payload.answers[sub] = arr.map((i) => `ans_${i}`);
      });
      const res = await Backend.submitAssessmentAdvanced(payload);
      setMessages((m) => [...m, { role: "bot", text: `Hasil assessment singkat:\n${JSON.stringify(res.results || res, null, 2)}` }]);
      setMiniAssessment(null);
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: `Gagal submit assessment: ${e.message}` }]);
    } finally {
      setAssessmentLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .chat-shell-modern {
          display: grid;
          grid-template-columns: 280px 1fr;
          width: 100%;
          max-width: 1400px;
          margin: 40px auto;
          background: #fff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(37, 99, 235, 0.08);
          min-height: 600px;
          height: 80vh;
          max-height: 80vh;
        }

        .sidebar-modern {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          border-right: 1px solid #e2e8f0;
          padding: 24px 0;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          height: 100%;
        }

        .sidebar-header {
          padding: 0 20px 20px;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 16px;
        }

        .sidebar-header h3 {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .new-chat-btn {
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .new-chat-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
        }

        .conversation-list {
          padding: 0 12px;
          flex: 1;
          overflow-y: auto;
        }

        .conversation-section-title {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 8px 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .conversation-item {
          padding: 12px 12px;
          margin-bottom: 4px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          animation: fadeInUp 0.3s ease-out;
          background: white;
          border: 1px solid transparent;
        }

        .conversation-item:hover {
          background: #f1f5f9;
          border-color: #e2e8f0;
          transform: translateX(4px);
        }

        .conversation-item.active {
          background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
          border-color: #93c5fd;
        }

        .conversation-title {
          flex: 1;
          font-size: 14px;
          color: #1e293b;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conversation-item.active .conversation-title {
          color: #2563eb;
          font-weight: 600;
        }

        .delete-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          font-size: 16px;
        }

        .delete-btn:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .chat-area-modern {
          display: flex;
          flex-direction: column;
          background: var(--gradient-hero);
          background-size: 200% 200%;
          animation: gradientShift 15s ease infinite;
          height: 100%;
          overflow: hidden;
          position: relative;
        }

        .chat-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px 0 16px;
          gap: 12px;
        }
        .topbar-left { display: grid; gap: 4px; }
        .topbar-title { font-weight: 800; color: #0f172a; font-size: 18px; }
        .topbar-sub { color: #475569; font-size: 13px; }
        .topbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn-cta { border: 1px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 8px 12px; font-weight: 700; cursor: pointer; color: #1f2937; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .btn-cta.primary { background: var(--gradient-primary); color: #fff; border: none; }
        .btn-cta.ghost { background: #f8fafc; color: #0f172a; }

        .chat-body-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 16px;
          padding: 16px 16px 0 16px;
          overflow: hidden;
        }

        .chat-messages {
          overflow-y: auto;
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scroll-behavior: smooth;
          background: transparent;
          height: 100%;
        }

        .context-panel {
          height: 100%;
          overflow-y: auto;
          padding: 8px 4px 16px 0;
          display: grid;
          gap: 12px;
        }

        .context-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }

        .context-card h4 {
          margin: 0 0 8px;
          font-size: 14px;
          font-weight: 700;
          color: #1f2937;
        }

        .pill-skill {
          background: #eef2ff;
          color: #312e81;
          padding: 6px 10px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 12px;
        }

        .timeline { margin-top: 12px; display: grid; gap: 8px; }
        .timeline-item { display: grid; grid-template-columns: 32px 1fr; gap: 8px; align-items: center; padding: 8px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
        .timeline-dot { width: 32px; height: 32px; border-radius: 50%; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; }
        .timeline-title { font-weight: 700; color: #0f172a; font-size: 14px; }
        .timeline-sub { font-size: 12px; color: #475569; }

        .badge-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12px;
          color: #fff;
        }

        .welcome-container {
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
          animation: fadeInUp 0.6s ease-out;
        }

        .welcome-title {
          font-size: 32px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .welcome-subtitle {
          font-size: 16px;
          color: #64748b;
          margin-bottom: 32px;
        }

        .suggestion-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 12px;
          margin-top: 24px;
        }

        .suggestion-card {
          padding: 16px 20px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 14px;
          color: #1e293b;
          font-weight: 500;
          text-align: left;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          animation: fadeInUp 0.5s ease-out;
          animation-fill-mode: both;
        }

        .suggestion-card:nth-child(1) { animation-delay: 0.1s; }
        .suggestion-card:nth-child(2) { animation-delay: 0.2s; }
        .suggestion-card:nth-child(3) { animation-delay: 0.3s; }
        .suggestion-card:nth-child(4) { animation-delay: 0.4s; }

        .suggestion-card:hover {
          border-color: #3b82f6;
          background: linear-gradient(135deg, #eff6ff 0%, white 100%);
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.15);
        }

        .suggestion-card::before {
          content: '💡';
          margin-right: 8px;
          font-size: 16px;
        }

        .chat-input-container {
          padding: 20px 24px;
          background: white;
          border-top: 1px solid #e2e8f0;
        }

        .quick-actions-row {
          max-width: 900px;
          margin: 0 auto 8px auto;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-start;
        }

        .quick-action-btn {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #eef2ff 0%, #e0f2fe 100%);
          color: #1f2937;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .quick-action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.18);
        }


        .chat-input-wrapper {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .chat-textarea {
          flex: 1;
          padding: 14px 18px;
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          font-size: 15px;
          font-family: inherit;
          resize: none;
          outline: none;
          transition: all 0.3s;
          background: #f8fafc;
          min-height: 52px;
          max-height: 150px;
        }

        .chat-textarea:focus {
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .send-button {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          color: white;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
        }

        .send-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-dots {
          display: flex;
          gap: 4px;
          align-items: center;
          justify-content: center;
        }

        .loading-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: white;
          animation: pulse 1.4s ease-in-out infinite;
        }

        .loading-dot:nth-child(1) { animation-delay: 0s; }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }

        .empty-state {
          text-align: center;
          padding: 20px;
          color: #94a3b8;
          font-size: 13px;
        }

        @media (max-width: 1024px) {
          .chat-shell-modern {
            grid-template-columns: 1fr;
            margin: 20px;
          }
          
          .sidebar-modern {
            display: none;
          }

          .suggestion-grid {
            grid-template-columns: 1fr;
          }

          .chat-body-grid {
            grid-template-columns: 1fr;
          }

          .context-panel {
            grid-template-columns: 1fr;
            grid-auto-flow: row;
          }
        }

        /* Scrollbar styling */
        .conversation-list::-webkit-scrollbar,
        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .conversation-list::-webkit-scrollbar-track,
        .chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .conversation-list::-webkit-scrollbar-thumb,
        .chat-messages::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .conversation-list::-webkit-scrollbar-thumb:hover,
        .chat-messages::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      <div className="chat-shell-modern" role="main">
        {!compact && (
          <aside className="sidebar-modern">
            <div className="sidebar-header">
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Learning Buddy
              </h3>
              <button className="new-chat-btn" onClick={newConversation}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Obrolan Baru
              </button>
            </div>

            <div className="conversation-list">
              <div className="conversation-section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Riwayat Obrolan
              </div>
              
              {convs.length === 0 ? (
                <div className="empty-state">
                  Belum ada percakapan.<br/>Mulai obrolan baru!
                </div>
              ) : (
                convs.map((c) => (
                  <div
                    key={c.id}
                    className={`conversation-item ${c.id === active ? 'active' : ''}`}
                    onClick={() => openConv(c.id)}
                  >
                    <span className="conversation-title">
                      {c.title || `Obrolan #${c.id}`}
                    </span>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeConversation(c.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        <section className="chat-area-modern">
          <div className="chat-topbar">
            <div className="topbar-left">
              <div className="topbar-title">Chat</div>
              <div className="topbar-sub">{profile ? `Halo, ${profile.role || "Learner"}!` : "Selamat datang di Learning Buddy"}</div>
            </div>
              <div className="topbar-actions">
                <button className="btn-cta ghost" onClick={() => setShowContextPanel((v) => !v)}>
                  {showContextPanel ? "Sembunyikan Panel" : "Tampilkan Panel"}
                </button>
                <button className="btn-cta" onClick={() => window.location.assign("/onboarding")}>Deteksi Job & Skills</button>
                <button className="btn-cta" onClick={() => window.location.assign("/dashboard")}>Lihat Roadmap</button>
                <button className="btn-cta primary" onClick={() => window.location.assign("/dashboard")}>Mulai Assessment</button>
                {strategySource && (
                  <span
                    className="badge-status"
                    style={{ background: strategySource === "fallback" ? "var(--brand-amber)" : "var(--brand-green)" }}
                    title={strategySource === "fallback" ? "Gemini tidak tersedia/invalid. Menggunakan strategi lokal." : "Strategi dihasilkan oleh Gemini."}
                  >
                    {strategySource === "fallback" ? "Mode: Fallback" : "Mode: Gemini"}
                  </span>
                )}
              </div>
            </div>
          <div className="chat-body-grid">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="welcome-container">
                  <h1 className="welcome-title">
                    {profile ? `Halo ${profile.role || 'Learner'}! 👋` : "Selamat Datang di Learning Buddy! 🎓"}
                  </h1>
                  <p className="welcome-subtitle">
                    {profile 
                      ? "Apa yang ingin kamu pelajari hari ini? Pilih salah satu topik atau tanyakan langsung!"
                      : "Tanyakan apapun tentang pembelajaran Dicoding. Saya siap membantu!"}
                  </p>

                  {profile && (
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>Tujuan kamu</div>
                          <div style={{ color: "#475569" }}>{profile.goal || "Belum ada goal. Isi di onboarding."}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>Ringkas progres</div>
                          <div style={{ color: "#475569", fontSize: 13, maxWidth: 260, whiteSpace: "pre-wrap" }}>
                            {progressSummary || "Belum ada progres tercatat."}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="suggestion-grid">
                    {suggestionPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        className="suggestion-card"
                        onClick={() => send(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                    <button className="suggestion-card" onClick={() => send("Skill apa yang paling berkembang minggu ini?")}>
                      Skill apa yang paling berkembang minggu ini?
                    </button>
                    <button className="suggestion-card" onClick={() => send("Rekomendasikan roadmap 1 minggu ke depan untuk goal saya")}>
                      Rekomendasikan roadmap 1 minggu ke depan
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto" }}>
                  {messages.map((m, i) => (
                    <div key={i} style={{
                      animation: 'fadeInUp 0.4s ease-out',
                      marginBottom: '16px'
                    }}>
                      <ChatBubble role={m.role} text={m.text} />
                    </div>
                  ))}
                  <div ref={bottomRef} />
                  {loading && (
                    <div style={{
                      padding: '16px 20px',
                      background: 'white',
                      borderRadius: '14px',
                      width: 'fit-content',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      animation: 'fadeInUp 0.3s ease-out'
                    }}>
                      <div className="loading-dots">
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="context-panel" style={{ display: showContextPanel ? "grid" : "none" }}>
              <div className="context-card">
                <h4>Profil & Progres</h4>
                <div style={{ fontSize: 13, color: "#475569", display: "grid", gap: 4 }}>
                  <div><strong>Role:</strong> {profile?.role || "-"}</div>
                  <div><strong>Level:</strong> {profile?.experience || "-"}</div>
                  <div><strong>Goal:</strong> {profile?.goal || "-"}</div>
                  <div style={{ marginTop: 8 }}><strong>Ringkasan progres:</strong></div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{progressSummary || "Belum ada progres tercatat."}</div>
                </div>
              </div>

              <div className="context-card">
                <h4>Roadmap Berikutnya</h4>
                {lastSkills?.length ? (
                  <>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {lastSkills.map((s) => (
                        <span key={s} className="pill-skill">{s}</span>
                      ))}
                    </div>
                    <div className="timeline">
                      {(lastSchedule.length ? lastSchedule : lastSkills.map((s, idx) => ({ day: idx + 1, detail: `${s}: fokus 45-60 menit` }))).map((item, idx) => (
                        <div key={idx} className="timeline-item">
                          <div className="timeline-dot">{item.day || idx + 1}</div>
                          <div className="timeline-body">
                            <div className="timeline-title">Hari {item.day || idx + 1}</div>
                            <div className="timeline-sub">{item.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>Kirim pertanyaan untuk memunculkan roadmap.</div>
                )}
              </div>

              <div className="context-card">
                <h4>Statistik Progres (Top)</h4>
                {progressStats?.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {progressStats.map((p, idx) => (
                      <div key={`${p.course_name || p.course_id || idx}`} style={{ display: "grid", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "#0f172a" }}>
                          <span>{p.course_name || p.course_id || "Kursus"}</span>
                          <span>{p.minutes || 0} mnt</span>
                        </div>
                        <div style={{ height: 6, background: "#e2e8f0", borderRadius: 999 }}>
                          <div style={{ width: `${Math.min(100, (p.minutes || 0) / 120 * 100)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>Belum ada aktivitas minggu ini.</div>
                )}
              </div>
            </div>
          </div>

          <div className="chat-input-container">
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <select
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0" }}
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) send(val);
                  e.target.value = "";
                }}
              >
                <option value="">Template pertanyaan cepat</option>
                {templateQuestions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                className="btn-cta"
                onClick={() => lastStrategyText && navigator.clipboard?.writeText(lastStrategyText)}
                disabled={!lastStrategyText}
              >
                Salin strategi terakhir
              </button>
            </div>
            <div className="quick-actions-row">
              {quickActionsList.map((qa, idx) => (
                <button
                  key={idx}
                  className="quick-action-btn"
                  onClick={() => {
                    if (!qa.text) {
                      startMiniAssessment();
                    } else {
                      send(qa.text);
                    }
                  }}
                  disabled={loading || assessmentLoading}
                >
                  {qa.label}
                </button>
              ))}
            </div>
            <div className="chat-input-wrapper">
              <textarea
                className="chat-textarea"
                rows={1}
                placeholder="Tanyakan pada kami..."
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                }}
                onKeyDown={onKey}
              />
              <button
                className="send-button"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                aria-label="Kirim"
              >
                {loading ? (
                  <div className="loading-dots">
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                  </div>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round" strokeLinejoin="round"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          {miniAssessment && (
            <div style={{ padding: 16, background: "#fff", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Assessment singkat</div>
              <div style={{ display: "grid", gap: 10 }}>
                {Object.entries(miniAssessment.assessment || {}).map(([subskill, questions]) => (
                  <div key={subskill} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{subskill}</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {questions.map((q, idx) => {
                        const checked = miniAssessment.answers?.[subskill]?.includes(idx);
                        return (
                          <label key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={!!checked}
                              onChange={() => toggleAnswer(subskill, idx)}
                            />
                            <span style={{ fontSize: 13, color: "#0f172a" }}>{q}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <button className="btn-cta ghost" onClick={() => setMiniAssessment(null)}>Batalkan</button>
                <button className="btn-cta primary" onClick={submitMiniAssessment} disabled={assessmentLoading}>
                  {assessmentLoading ? "Mengirim..." : "Kirim jawaban"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
