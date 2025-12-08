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
      // Fallback ke endpoint chatbot sederhana jika API percakapan bermasalah
      try {
        const reply = await sendMessageToBot(text);
        setMessages((m) => [...m, { role: "bot", text: reply }]);
      } catch (_) {
        setMessages((m) => [...m, { role: "bot", text: "(Offline) Baik, saya catat." }]);
      }
    } finally { setLoading(false); }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
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
  ];

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
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #f0f9ff 100%);
          background-size: 200% 200%;
          animation: gradientShift 15s ease infinite;
          height: 100%;
          overflow: hidden;
          position: relative;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scroll-behavior: smooth;
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

          <div className="chat-input-container">
            <div className="quick-actions-row">
              {quickActionsList.map((qa, idx) => (
                <button
                  key={idx}
                  className="quick-action-btn"
                  onClick={() => send(qa.text)}
                  disabled={loading}
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
        </section>
      </div>
    </>
  );
}
