import { useMemo, useState } from "react";
import ChatBubble from "../components/ChatBubble";
import { Backend } from "../lib/backend";

const SAMPLE_QUERY = "Sehabis HTML, apa lagi yang harus dipelajari untuk jadi web developer?";
const SAMPLE_GOAL = "Menjadi Web Developer yang siap kerja";

export default function LearningStrategyPage() {
  const [query, setQuery] = useState(SAMPLE_QUERY);
  const [goal, setGoal] = useState(SAMPLE_GOAL);
  const [topN, setTopN] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const chips = useMemo(() => {
    if (!result?.next_skills || !result.next_skills.length) return ["JavaScript", "CSS", "Git", "React", "REST API"];
    return result.next_skills.slice(0, 6);
  }, [result]);

  const run = async () => {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setError("Pertanyaan tidak boleh kosong.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await Backend.generateLearningStrategy({
        query: cleanQuery,
        goal: goal?.trim() || null,
        top_n: Number(topN) || 5,
      });
      setResult(data);
    } catch (e) {
      setError(e.message || "Gagal memuat strategi belajar.");
    } finally {
      setLoading(false);
    }
  };

  const useSample = (q, g) => {
    setQuery(q);
    setGoal(g || "");
    setResult(null);
    setError("");
  };

  return (
    <div className="strategy-page">
      <style>{`
        .strategy-page {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 18px 48px;
          display: grid;
          gap: 18px;
        }
        .strategy-grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 18px;
        }
        .panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
        }
        .panel h1 {
          margin: 0 0 8px;
          font-size: 26px;
        }
        .panel p {
          margin: 0 0 18px;
          color: #475569;
        }
        .field-row {
          display: grid;
          gap: 10px;
          margin-bottom: 12px;
        }
        .field-row label {
          font-weight: 600;
          color: #1f2937;
        }
        .field-row input,
        .field-row textarea {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 15px;
          background: #f8fafc;
        }
        .field-row textarea {
          resize: vertical;
          min-height: 70px;
          max-height: 150px;
        }
        .field-inline {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .field-inline input {
          width: 120px;
        }
        .actions {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .btn-primary {
          background: linear-gradient(120deg, #2563eb, #1d4ed8);
          color: #fff;
          border: none;
          padding: 12px 18px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.25);
        }
        .btn-ghost {
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          padding: 10px 14px;
          border-radius: 12px;
          color: #0f172a;
          cursor: pointer;
        }
        .chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .chip {
          background: #eef2ff;
          color: #312e81;
          padding: 8px 12px;
          border-radius: 999px;
          font-weight: 600;
          border: 1px solid #c7d2fe;
        }
        .strategy-card {
          background: linear-gradient(145deg, #f8fafc, #eef2ff);
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 12px 14px;
        }
        .tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ecfeff;
          color: #0f172a;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 12px;
          border: 1px solid #a5f3fc;
        }
        .strategy-text {
          white-space: pre-wrap;
          font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
          font-size: 13px;
          margin-top: 12px;
          color: #0f172a;
          line-height: 1.5;
        }
        .error {
          color: #b91c1c;
          font-weight: 700;
          margin-top: 6px;
        }
        .meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .meta .pill {
          background: #e2e8f0;
          color: #0f172a;
          padding: 6px 10px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
        }
        .chat-preview {
          max-height: 600px;
          overflow: auto;
          padding-right: 8px;
        }
        @media (max-width: 980px) {
          .strategy-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="panel">
        <h1>Saran Strategi Belajar</h1>
        <p>Pertanyaanmu akan dikirim ke endpoint <code>/ml-advanced/generate_learning_strategy</code> yang memakai alur di <code>learning_strategy.py</code>. Bagian ini berdiri sendiri supaya tidak mengganggu halaman lain.</p>
        <div className="field-row">
          <label>Pertanyaan</label>
          <textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Contoh: Sehabis HTML, apa lagi yang harus dipelajari untuk jadi web developer?" />
        </div>
        <div className="field-row">
          <label>Tujuan (opsional)</label>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Contoh: Menjadi Front-End Developer profesional" />
        </div>
        <div className="field-inline">
          <label>Jumlah skill yang diambil</label>
          <input type="number" min={1} max={10} value={topN} onChange={(e) => setTopN(e.target.value)} />
        </div>
        <div className="actions">
          <button className="btn-primary" onClick={run} disabled={loading}>
            {loading ? "Menghasilkan strategi..." : "Generate Strategi"}
          </button>
          <button className="btn-ghost" onClick={() => useSample(SAMPLE_QUERY, SAMPLE_GOAL)}>Pakai contoh bawaan</button>
          <button className="btn-ghost" onClick={() => useSample("Saya sudah memahami dasar SQL, habis ini belajar apa lagi?", "Jadi Data Analyst yang kuat di visualisasi")}>Contoh Data Analyst</button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="chips">
          {chips.map((item) => <span className="chip" key={item}>{item}</span>)}
        </div>
      </div>

      <div className="strategy-grid">
        <div className="panel">
          <div className="meta">
            <span className="pill">Preview Chat</span>
            <span className="pill">{loading ? "Model aktif" : "Realtime dari backend"}</span>
          </div>
          <div className="chat-preview">
            <ChatBubble role="user" text={<div><div style={{ fontWeight: 700, marginBottom: 6 }}>User</div>{query || "(belum ada pertanyaan)"}</div>} />
            <ChatBubble
              role="bot"
              text={
                <div className="strategy-card">
                  <div className="tag">Saran strategi belajar</div>
                  <div className="chips" style={{ marginTop: 10 }}>
                    {chips.map((item) => <span className="chip" key={`chip-${item}`}>{item}</span>)}
                  </div>
                  <div className="strategy-text">
                    {loading ? "Sedang menyusun strategi belajar berbasis skill..." : (result?.strategy || "Tekan Generate untuk melihat strategi dari backend.")}
                  </div>
                </div>
              }
            />
          </div>
        </div>

        <div className="panel">
          <h3>Alur singkat yang dipakai</h3>
          <p>Komponen ini hanya memanggil API ML-Advanced. Kamu bisa kirim file ini ke teman tanpa menyentuh file lain.</p>
          <ul>
            <li>Frontend memanggil <code>Backend.generateLearningStrategy()</code> dengan query dan goal.</li>
            <li>Backend menjalankan <code>RoadmapGenerator.predict_next_skills</code> untuk menentukan skill lanjutan.</li>
            <li><code>LearningStrategyGenerator.generate_actionable_learning_strategy</code> menyusun roadmap dan tips.</li>
            <li>Hasil ditampilkan di bubble bot dengan format apa adanya.</li>
          </ul>
          <p>Jika Gemini tidak aktif, backend akan mengembalikan error sesuai konfigurasi environment.</p>
        </div>
      </div>
    </div>
  );
}
