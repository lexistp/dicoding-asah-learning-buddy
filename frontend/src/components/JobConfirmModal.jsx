export default function JobConfirmModal({ open, onClose, jobRole, skills = [], onChangeDesc, onStart }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-card confirm">
        <div className="modal-header">
          <div className="modal-title">🎯 Konfirmasi Job Role</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ gap: 16 }}>
          <div className="confirm-hero">
            <div className="hero-title">{jobRole || "Job role terdeteksi"}</div>
            <div className="hero-subtitle">Job role yang cocok untuk Anda!</div>
          </div>
          <div>
            <div className="modal-subtitle">🧠 Skills yang Akan Diuji ({skills.length})</div>
            <div className="modal-chips" style={{ marginTop: 8 }}>
              {skills.map((s) => <span key={s} className="chip">{s}</span>)}
            </div>
          </div>
          <div className="confirm-info">
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Apa selanjutnya?</div>
            <div style={{ fontSize: 13, color: "#334155" }}>
              Anda akan mengikuti assessment untuk mengetahui level kemampuan Anda di setiap skill. Assessment terdiri dari 18 pertanyaan pilihan ganda.
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn ghost" onClick={onChangeDesc}>← Ubah Deskripsi</button>
          <button className="btn primary" onClick={onStart}>✓ Lanjut Assessment</button>
        </div>
      </div>
    </div>
  );
}

const styles = `
.modal-card.confirm { width: min(720px, 95vw); }
.confirm-hero { background: linear-gradient(135deg, #dcfce7, #bbf7d0); border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; text-align: center; }
.hero-title { font-size: 22px; font-weight: 800; color: #166534; }
.hero-subtitle { font-size: 14px; color: #166534; }
.confirm-info { background: #fef9c3; border: 1px solid #fef08a; border-radius: 12px; padding: 12px; }
`;

if (typeof document !== "undefined" && !document.getElementById("job-confirm-styles")) {
  const style = document.createElement("style");
  style.id = "job-confirm-styles";
  style.textContent = styles;
  document.head.appendChild(style);
}
