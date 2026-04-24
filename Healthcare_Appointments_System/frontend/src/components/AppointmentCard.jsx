import React from "react";
import Badge from "./ui/Badge";
import { formatDateTime, formatTime } from "../utils/dateHelpers";

export default function AppointmentCard({ appointment, actions, role }) {
  const { id, scheduled_at, end_at, status, reason, doctor, patient } = appointment;
  const isPast = new Date(scheduled_at) < new Date();

  return (
    <div className="card card-hover p-5 flex flex-col gap-4 animate-fade-in">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-navy-700 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-sm shrink-0">
            {role === "patient"
              ? (doctor?.user?.full_name?.[0]?.toUpperCase() || "D")
              : (patient?.full_name?.[0]?.toUpperCase() || "P")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-100 truncate">
              {role === "patient"
                ? `Dr. ${doctor?.user?.full_name || "Unknown"}`
                : (patient?.full_name || "Patient")}
            </p>
            {doctor?.specialty && (
              <p className="text-xs text-teal-400/80">{doctor.specialty.name}</p>
            )}
          </div>
        </div>
        <Badge status={status} />
      </div>

      {/* Time */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 text-slate-300">
          <svg className="w-4 h-4 text-teal-500/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formatDateTime(scheduled_at)}</span>
        </div>
        {end_at && (
          <span className="text-slate-500 text-xs">→ {formatTime(end_at)}</span>
        )}
      </div>

      {/* Reason */}
      {reason && (
        <p className="text-sm text-slate-400 bg-navy-900/50 rounded-lg px-3 py-2 border border-white/[0.04]">
          <span className="text-slate-500 text-xs block mb-0.5">Reason</span>
          {reason}
        </p>
      )}

      {/* Actions */}
      {actions && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.05]">
          {actions(appointment)}
        </div>
      )}
    </div>
  );
}
