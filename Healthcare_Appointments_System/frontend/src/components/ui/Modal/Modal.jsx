import React, { useEffect } from "react";
import "./Modal.css";

export default function Modal({ open, onClose, title, children, size = "md" }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="modal__overlay animate-fade-in" />

      {/* Panel */}
      <div className={`modal__panel modal__panel--${size} card animate-scale-in`}>
        {/* Header */}
        <div className="modal__header">
          <h2 className="modal__title section-title">{title}</h2>
          <button
            onClick={onClose}
            className="modal__close-btn"
            aria-label="Close modal"
          >
            <svg className="modal__close-icon" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
