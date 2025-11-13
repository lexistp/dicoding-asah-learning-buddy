import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Backend } from "../lib/backend";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!email || !password) throw new Error("Email dan password wajib diisi");
      await Backend.login({ email, password });
      nav("/chat");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap" role="main">
      <form className="card" onSubmit={onSubmit}>
        <h1>Login</h1>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="muted" style={{textAlign: "right"}}>Lupa Password</div>
        </div>
        {error && <div className="muted" style={{ color: "#b91c1c" }}>{error}</div>}
        <div className="actions">
          <button disabled={loading} className="btn primary" type="submit">
            {loading ? "Memproses…" : "Log In"}
          </button>
        </div>
        <div className="muted" style={{textAlign: "center", marginTop: 10}}>
          Belum memiliki akun? <Link className="link" to="/register">Sign up</Link>
        </div>
      </form>
    </div>
  );
}
