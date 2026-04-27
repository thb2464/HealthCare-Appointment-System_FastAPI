import React from "react";
import "./Badge.css";

const STATUS_MAP = {
  pending:     "badge-pending",
  confirmed:   "badge-confirmed",
  arrived:     "badge-arrived",
  completed:   "badge-completed",
  cancelled:   "badge-cancelled",
  rescheduled: "badge-rescheduled",
  noshow:      "badge-noshow",
};

const STATUS_DOT_MAP = {
  pending:     "badge-dot--pending",
  confirmed:   "badge-dot--confirmed",
  arrived:     "badge-dot--arrived",
  completed:   "badge-dot--completed",
  cancelled:   "badge-dot--cancelled",
  rescheduled: "badge-dot--rescheduled",
  noshow:      "badge-dot--noshow",
};

export default function Badge({ status, children, className = "" }) {
  const key = (status || "").toLowerCase();
  const cls = STATUS_MAP[key]     || "badge--unknown";
  const dot = STATUS_DOT_MAP[key] || "badge-dot--unknown";

  return (
    <span className={`${cls} ${className}`}>
      <span className={`badge-dot ${dot}`} />
      {children || status}
    </span>
  );
}
