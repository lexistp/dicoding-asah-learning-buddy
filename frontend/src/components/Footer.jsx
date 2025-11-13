export default function Footer() {
  return (
    <footer className="footer">
      <div className="left">
        <div className="brand-logo" style={{width: 24, height: 24}}>LB</div>
        <div>
          <div style={{fontWeight: 700}}>Learning Buddy</div>
          <div className="muted">“Your guide to better understanding”</div>
        </div>
      </div>
      <div className="right">
        <div>contact</div>
        <div>Email : learning@ggmail.com</div>
        <div style={{marginTop: 6}}>© 2025 Learning Buddy</div>
      </div>
    </footer>
  );
}

