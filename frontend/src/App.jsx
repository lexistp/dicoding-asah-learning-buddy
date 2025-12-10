import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import OnboardingPage from "./pages/OnboardingPage";
import ChatPage from "./pages/ChatPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import EmbedChat from "./pages/EmbedChat";
import HomePage from "./pages/HomePage";
import LearningStrategyPage from "./pages/LearningStrategyPage";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import "./styles.css";

function isAuthenticated() {
  try {
    return Boolean(localStorage.getItem("lb_auth"));
  } catch (_) {
    return false;
  }
}

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

function AppShell() {
  const location = useLocation();
  const isEmbed = location.pathname.startsWith("/embed");
  
  // Sembunyikan navbar di halaman login, register, dan embed
  const hideNavbar = isEmbed || location.pathname === "/login" || location.pathname === "/register";

  return (
    <div className="app-shell">
      {!hideNavbar && <Navbar />}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/learning-strategy" element={<LearningStrategyPage />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/embed"
            element={
              <ProtectedRoute>
                <EmbedChat />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
      {!hideNavbar && <Footer />}
    </div>
  );
}
