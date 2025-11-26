import { Link, useNavigate, useLocation } from "react-router-dom";
import { Backend, getToken } from "../lib/backend";

function isAuthed() {
  return Boolean(getToken());
}

export default function Navbar() {
  const nav = useNavigate();
  const loc = useLocation();
  const authed = isAuthed();

  const logout = () => {
    Backend.logout();
    nav("/login");
  };

  return (
    <header className="nav">
      <Link className="brand" to="/">
        <div className="brand-logo">LB</div>
        <span>Learning Buddy</span>
      </Link>
      <div className="nav-actions">
        {authed ? (
          <>
            {loc.pathname !== "/dashboard" && (
              <Link className="btn" to="/dashboard">Dashboard</Link>
            )}
            <button className="btn" onClick={logout}>Keluar</button>
          </>
        ) : (
          <>
            {loc.pathname !== "/login" && (
              <Link className="btn" to="/login">Login</Link>
            )}
            {loc.pathname !== "/register" && (
              <Link className="btn primary" to="/register">Register</Link>
            )}
          </>
        )}
      </div>
    </header>
  );
}
