import React from "react";
import "./BottomSheetPopup.css";

export default function BottomSheetPopup({
  open,
  onClose,
  variant = "warning",
  icon,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  if (!open) return null;

  const handleSecondary = () => {
    if (onSecondary) onSecondary();
    else if (onClose) onClose();
  };

  return (
    <div className="bs-popup-backdrop" onClick={onClose}>
      <div className="bs-popup-card" onClick={(e) => e.stopPropagation()}>
        <div className="bs-popup-text" style={{ paddingTop: 10 }}>
            <div className="bs-popup-title">{title}</div>
            {description && <div className="bs-popup-desc">{description}</div>}
        </div>

        <div className="bs-popup-actions">
          {secondaryLabel && (
            <button className="bs-popup-secondary" onClick={handleSecondary}>
              {secondaryLabel}
            </button>
          )}
          {primaryLabel && (
            <button
              className="bs-popup-primary"
              onClick={onPrimary || onClose}
            >
              {primaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
