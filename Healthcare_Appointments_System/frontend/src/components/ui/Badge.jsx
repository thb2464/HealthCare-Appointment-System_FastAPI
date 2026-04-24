import React from "react";

const STATUS_MAP = {
  pending: "badge-pending",
  confirmed: "badge-confirmed",
  completed: "badge-completed",
  cancelled: "badge-cancelled",
  rescheduled: "badge-rescheduled",
};

const STATUS_DOTS = {
  pending: "bg-amber-400",
  confirmed: "bg-teal-400",
  completed: "bg-green-400",
  cancelled: "bg-red-400",
  rescheduled: "bg-blue-400",
};

export default function Badge({ status, children, className = "" }) {
  const key = (status || "").toLowerCase();
  const cls = STATUS_MAP[key] || "badge bg-slate-700 text-slate-300";
  const dot = STATUS_DOTS[key] || "bg-slate-400";

  return (
    <span className={`${cls} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {children || status}
    </span>
  );
}
