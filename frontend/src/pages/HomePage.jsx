import { Link } from "react-router-dom";
import heroImage from "../assets/gambar_untuk_home.jpeg";

export default function HomePage() {
  return (
    <div className="hero-wrapper">
      <section className="hero" aria-label="Perkenalan Learning Buddy">
        <div className="hero-text">
          <h1>Belajar Lebih Cerdas Bersama Learning Buddy</h1>
          <p>
            Learning Buddy membantu kamu memahami materi Dicoding lebih cepat melalui latihan, penjelasan,
            dan rekomendasi belajar yang personal. Mulai sekarang dan rancang roadmap terbaikmu.
          </p>
          <Link className="btn primary" to="/register">Get Started</Link>
        </div>
        <img src={heroImage} alt="Ilustrasi belajar" loading="lazy" />
      </section>
    </div>
  );
}
