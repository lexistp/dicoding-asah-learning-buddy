export default function ChatBubble({ role = "bot", text }) {
  return (
    <>
      <style>{`
        @keyframes bubbleSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -100% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        .bubble-row {
          display: flex;
          margin-bottom: 16px;
          animation: bubbleSlideIn 0.4s ease-out;
        }

        .bubble {
          max-width: 75%;
          padding: 14px 18px;
          border-radius: 18px;
          font-size: 15px;
          line-height: 1.6;
          word-wrap: break-word;
          position: relative;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
        }

        .bubble:hover {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
          transform: translateY(-2px);
        }

        .bubble.user {
          margin-left: auto;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          color: white;
          border-bottom-right-radius: 4px;
          border: 2px solid #1e40af;
          position: relative;
          overflow: hidden;
        }

        .bubble.user::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.2),
            transparent
          );
          transition: left 0.5s;
        }

        .bubble.user:hover::before {
          left: 100%;
        }

        .bubble.bot {
          margin-right: auto;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          color: #1e293b;
          border-bottom-left-radius: 4px;
          border: 2px solid #e2e8f0;
          position: relative;
        }

        .bubble.bot::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: -2px;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          transition: width 0.3s ease;
        }

        .bubble.bot:hover::after {
          width: calc(100% + 4px);
        }

        /* Avatar indicator */
        .bubble::before {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          top: 50%;
          transform: translateY(-50%);
        }

        .bubble.user::before {
          right: -14px;
          background: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }

        .bubble.bot::before {
          left: -14px;
          background: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
        }

        /* Text styling */
        .bubble p {
          margin: 0;
        }

        .bubble strong {
          font-weight: 700;
        }

        .bubble code {
          background: rgba(0, 0, 0, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
        }

        .bubble.user code {
          background: rgba(255, 255, 255, 0.2);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .bubble {
            max-width: 85%;
            padding: 12px 16px;
            font-size: 14px;
          }
        }
      `}</style>

      <div className="bubble-row">
        <div className={`bubble ${role}`}>
          {text}
        </div>
      </div>
    </>
  );
}