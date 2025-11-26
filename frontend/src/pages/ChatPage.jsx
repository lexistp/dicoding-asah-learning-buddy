import { useEffect, useState } from "react";
import ChatBubble from "../components/ChatBubble";
import { Backend } from "../lib/backend";

export default function ChatPage({ compact = false }) {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null); // id percakapan
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);

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
    let cid = active;
    if (!cid) {
      cid = await newConversation();
    }
    const next = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await Backend.sendMessage(cid, text);
      setMessages((m) => [...m, { role: "bot", text: reply }]);
      setConvs((list) => list.map((item) => {
        if (item.id === cid && item.title.toLowerCase().startsWith("obrolan baru")) {
          return { ...item, title: text.slice(0, 40) };
        }
        return item;
      }));
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "(Offline) Baik, saya catat." }]);
    } finally { setLoading(false); }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const suggestionPrompts = profile ? [
    "Skill apa yang paling berkembang minggu ini?",
    `Rekomendasi kelas untuk ${profile.role || 'role saya'}?`,
    "Berikan motivasi belajar dong",
    "Langkah pertama yang harus saya lakukan hari ini?"
  ] : [
    "Rekomendasi kelas pemula",
    "Skill apa yang paling berkembang minggu ini?",
    "Tips belajar konsisten"
  ];

  return (
    <div className={compact ? "chat-shell embed" : "chat-shell"} role="main">
      {!compact && (
        <aside className="sidebar">
          <h3>Menu</h3>
          <div className="menu">
            <div className="item" onClick={newConversation}>➕ Obrolan baru</div>
            <div className="item" style={{background:"transparent", border:"none", cursor:"default"}}>🕘 Riwayat obrolan</div>
            {convs.length === 0 && <div className="muted">Belum ada percakapan.</div>}
            {convs.map((c) => (
              <div key={c.id} className="item" style={{justifyContent:"space-between", background: c.id === active ? "#e8edff" : "#fff"}}>
                <span style={{flex:1, cursor:"pointer"}} onClick={() => openConv(c.id)}>
                  {c.title || `Obrolan #${c.id}`}
                </span>
                <button className="btn" style={{padding:"2px 8px"}} onClick={() => removeConversation(c.id)}>✕</button>
              </div>
            ))}
          </div>
        </aside>
      )}
      <section className="chat-area" style={compact ? {boxShadow:"none", border:"1px solid #e2e8f0", borderRadius:12} : {}}>
        <div className="chat-view" style={{background: compact ? "#fff" : "var(--brand-blue)"}}>
          {messages.length === 0 ? (
            <div style={{textAlign:"left", width:"100%", maxWidth:compact?"100%":700}}>
              <div className="welcome" style={{color: compact ? "var(--text)" : "#fff", textAlign:"left"}}>
                {profile ? `Halo ${profile.role || ''}! Apa kabar?` : "Selamat Datang — Tanyakan apapun masalahmu 😉"}
              </div>
              <div className="muted" style={{color: compact ? "var(--muted)" : "#fff"}}>Coba pilih salah satu topik di bawah ini:</div>
              <div className="suggestion-list">
                {suggestionPrompts.map((s) => (
                  <button key={s} className="suggestion-chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{width: "100%", maxWidth: compact ? "100%" : 900, margin: "0 auto", textAlign: "left"}}>
              {messages.map((m, i) => (
                <ChatBubble key={i} role={m.role} text={m.text} />
              ))}
            </div>
          )}
        </div>
        <div className="composer" style={compact ? {background:"#fff", borderTop:"1px solid #e2e8f0"} : {}}>
          <div className="composer-inner">
            <textarea className="input" rows={2} placeholder="Tanyakan pada kami" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} />
            <button className="btn primary" onClick={send} aria-label="Kirim" disabled={loading}>{loading ? "…" : "➤"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
