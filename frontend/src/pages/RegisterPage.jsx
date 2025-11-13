import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Backend } from "../lib/backend";

export default function RegisterPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) return setError("Semua field wajib diisi");
    if (password !== confirm) return setError("Konfirmasi password tidak cocok");
    setLoading(true);
    try {
      await Backend.register({ name, email, password });
      nav("/chat");
    } catch (err) {
      setError(String(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap" role="main">
      <form className="card" onSubmit={onSubmit}>
        <h1>Register</h1>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" className="input" placeholder="Confirm Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <div className="muted" style={{ color: "#b91c1c" }}>{error}</div>}
        <div className="actions">
          <button disabled={loading} className="btn primary" type="submit">
            {loading ? "Memproses…" : "Sign Up"}
          </button>
        </div>
        <div className="muted" style={{textAlign: "center", marginTop: 10}}>
          Sudah memiliki akun? <Link className="link" to="/login">Sign In</Link>
        </div>
      </form>
    </div>
  );
}
