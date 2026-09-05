import React from "react";

const MESSAGES = [
  { lang: "English", text: "Your account has been blocked. Please contact support." },
  { lang: "Русский", text: "Ваш аккаунт заблокирован. Обратитесь в поддержку." },
  { lang: "Українська", text: "Ваш акаунт заблоковано. Зверніться до підтримки." },
  { lang: "Deutsch", text: "Ihr Konto wurde gesperrt. Bitte wenden Sie sich an den Support." },
  { lang: "日本語", text: "アカウントはブロックされました。サポートにご連絡ください。" },
  { lang: "中文", text: "您的账户已被封禁。请联系客服。" },
  { lang: "Polski", text: "Twoje konto zostało zablokowane. Skontaktuj się z pomocą." },
  { lang: "Español", text: "Tu cuenta ha sido bloqueada. Contacta al soporte." },
];

export default function BlockedModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10000, padding: 20, overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "#1c1c1e", padding: "28px 24px", borderRadius: 16,
          maxWidth: 400, width: "100%", color: "#fff", textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, color: "var(--brand-coral)", marginBottom: 12 }}>⛔</div>
        <h2 style={{ margin: "0 0 16px 0", fontSize: 20 }}>Account blocked</h2>
        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {MESSAGES.map(({ lang, text }) => (
            <div key={lang} style={{ fontSize: 13, lineHeight: 1.4, color: "#ddd" }}>
              <span style={{ color: "#888", fontWeight: 600 }}>{lang}: </span>
              {text}
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "var(--brand-mint)", color: "var(--bg-base)", border: "none",
            padding: "12px 28px", borderRadius: 12, fontSize: 15,
            fontWeight: 700, cursor: "pointer", width: "100%",
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
