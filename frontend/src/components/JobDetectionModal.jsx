import { useMemo, useState } from "react";

export default function JobDetectionModal({ open, onClose, onDetect, loading, detected }) {
  const [desc, setDesc] = useState("");
  const examples = [
    "Saya tertarik membuat aplikasi web interaktif dengan React dan ingin mendalami frontend development",
    "Saya ingin belajar machine learning dan AI untuk membuat model prediktif",
    "Saya suka menganalisis data dan membuat visualisasi untuk business insights",
    "Saya tertarik dengan cloud computing dan deployment aplikasi di AWS/GCP",
  ];

  const chips = useMemo(() => (detected?.skills || []).map((s) => s.name || s), [detected]);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title">🧭 Deteksi Job Role & Skills</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p>Ceritakan minat dan tujuan belajar Anda. Kami akan mendeteksi job role yang cocok beserta skills yang perlu dikuasai.</p>
          <label className="modal-label">Deskripsi Minat & Tujuan Belajar</label>
          <textarea
            className="modal-input"
            rows={4}
            placeholder="Contoh: saya suka web development dan ingin membuat website interaktif…"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <div className="modal-subtitle">💡 Atau pilih contoh:</div>
          <div className="modal-example-list">
            {examples.map((ex) => (
              <button key={ex} className="modal-example" onClick={() => setDesc(ex)}>{ex}</button>
            ))}
          </div>
          {chips?.length ? (
            <div className="modal-detected">
              <div className="modal-subtitle">Skills terdeteksi:</div>
              <div className="modal-chips">
                {chips.map((c) => <span key={c} className="chip">{c}</span>)}
              </div>
            </div>
          ) : null}
        </div>
        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose}>Batal</button>
          <button className="btn primary" onClick={() => onDetect(desc)} disabled={loading || !desc.trim()}>
            {loading ? "Mendeteksi..." : "Deteksi Sekarang"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Minimal styles scoped via class selectors */
const styles = `
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.modal-card { width: min(900px, 95vw); background: #f8fafc; border-radius: 18px; box-shadow: 0 20px 60px rgba(15,23,42,0.18); border: 1px solid #e2e8f0; overflow: hidden; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; background: linear-gradient(135deg, #e0f2fe, #eef2ff); }
.modal-title { font-weight: 800; font-size: 18px; color: #0f172a; }
.modal-close { border: none; background: transparent; font-size: 20px; cursor: pointer; color: #475569; }
.modal-body { padding: 18px 20px; display: grid; gap: 12px; }
.modal-label { font-weight: 700; font-size: 14px; color: #0f172a; }
.modal-input { width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; font-size: 14px; background: #fff; }
.modal-subtitle { font-weight: 700; font-size: 13px; color: #0f172a; }
.modal-example-list { display: grid; gap: 8px; }
.modal-example { text-align: left; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #fff; cursor: pointer; font-size: 14px; color: #0f172a; }
.modal-example:hover { border-color: #3b82f6; background: #eff6ff; }
.modal-detected { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
.modal-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.chip { background: #eef2ff; color: #312e81; padding: 6px 10px; border-radius: 12px; font-weight: 700; font-size: 12px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; background: #fff; border-top: 1px solid #e2e8f0; }
.btn { border: none; border-radius: 12px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
.btn.ghost { background: #f8fafc; border: 1px solid #e2e8f0; color: #0f172a; }
.btn.primary { background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; }
`;

if (typeof document !== "undefined" && !document.getElementById("job-detect-styles")) {
  const style = document.createElement("style");
  style.id = "job-detect-styles";
  style.textContent = styles;
  document.head.appendChild(style);
}
