import React from "react";
import { useTranslation } from "react-i18next";
import "./ConfirmModal.css";

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="confirm-title">{title}</h3>}
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            {cancelLabel || t("cancel")}
          </button>
          <button
            type="button"
            className={`confirm-btn confirm-btn-primary${destructive ? " is-destructive" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel || t("ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
