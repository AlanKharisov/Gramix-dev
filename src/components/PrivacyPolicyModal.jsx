import React, { useRef, useState, useEffect, useTransition } from "react";
import { useTranslation } from "react-i18next";
import "./PrivacyPolicyModal.css";

import i18n from "../i18n";
import PrivacyPolicyEn from "./policies/PrivacyPolicyEn";
import PrivacyPolicyRu from "./policies/PrivacyPolicyRu";
import PrivacyPolicyUk from "./policies/PrivacyPolicyUk";
import PrivacyPolicyDe from "./policies/PrivacyPolicyDe";
import PrivacyPolicyEs from "./policies/PrivacyPolicyEs";
import PrivacyPolicyPl from "./policies/PrivacyPolicyPl";
import PrivacyPolicyJa from "./policies/PrivacyPolicyJa";
import PrivacyPolicyZh from "./policies/PrivacyPolicyZh";

const POLICY_MAP = {
  en: PrivacyPolicyEn,
  ru: PrivacyPolicyRu,
  uk: PrivacyPolicyUk,
  de: PrivacyPolicyDe,
  es: PrivacyPolicyEs,
  pl: PrivacyPolicyPl,
  ja: PrivacyPolicyJa,
  zh: PrivacyPolicyZh,
};

export default function PrivacyPolicyModal({
  isOpen,
  onClose,
  requireAgree = false,
  onAgree,
}) {
  const { t } = useTranslation();
  const PolicyContent = POLICY_MAP[i18n.language] || PrivacyPolicyEn;
  const scrollRef = useRef(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [, startTransition] = useTransition();

  // Reset scroll state each time modal opens; also mark done if content fits
  // Reset scroll state each time modal opens; also mark done if content fits
  useEffect(() => {
    let isMounted = true; // Додаємо прапорець життя компонента

    if (isOpen) {
      startTransition(() => {
        setScrolledToBottom(false);
      });
      const timer = setTimeout(() => {
        // Перевіряємо, чи вікно ще відкрите перед тим, як міняти стан
        if (!isMounted) return; 
        
        const el = scrollRef.current;
        if (el && el.scrollHeight <= el.clientHeight + 2) {
          setScrolledToBottom(true);
        }
      }, 60);

      // Функція очищення
      return () => {
        isMounted = false; // Кажемо, що компонент закрився
        clearTimeout(timer);
      };
    }
  }, [isOpen]); // Тут setScrolledToBottom вже не обов'язковий

  if (!isOpen) return null;

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 10) {
      setScrolledToBottom(true);
    }
  };

  const handleAgree = () => {
    onAgree && onAgree();
    onClose();
  };

  return (
    <div className="policy-overlay" onClick={onClose}>
      <div className="policy-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="policy-title">{t("privacy_policy")}</h2>

        <div className="policy-scroll" ref={scrollRef} onScroll={handleScroll}>
          {/* ── PASTE YOUR FULL PRIVACY POLICY TEXT BELOW ── */}
          
          <PolicyContent />

          {/* ── END OF PRIVACY POLICY ── */}
          <p className="policy-end-marker">— {t("privacy_policy_end")} —</p>
        </div>

        {requireAgree && !scrolledToBottom && (
          <p className="policy-scroll-hint">{t("scroll_to_accept")}</p>
        )}

        <div className="policy-actions">
          {requireAgree ? (
            <>
              <button className="policy-btn-cancel" onClick={onClose}>
                {t("close")}
              </button>
              <button
                className="policy-btn-agree"
                disabled={!scrolledToBottom}
                onClick={handleAgree}
              >
                {t("agree_policy")}
              </button>
            </>
          ) : (
            <button
              className="policy-btn-agree policy-btn-only"
              onClick={onClose}
            >
              {t("close")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
