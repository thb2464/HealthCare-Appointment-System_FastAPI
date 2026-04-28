import React from "react";
import "./AppointmentCard.css";
import Badge from "../ui/Badge/Badge";
import { formatDateTime, formatTime } from "../../utils/dateHelpers";

export default function AppointmentCard({ appointment, actions, role }) {
  const {
    id,
    scheduled_at,
    end_at,
    status,
    reason,
    cancellation_reason,
    deposit_paid,
    reschedule_count,
    reschedule_fee_applied,
    doctor,
    patient,
  } = appointment;

  const isPast = new Date(scheduled_at) < new Date();

  return (
    <div className="card card-hover appt-card animate-fade-in">
      {/* Header row */}
      <div className="appt-card__header">
        <div className="appt-card__identity">
          {/* Avatar */}
          <div className="appt-card__avatar">
            {role === "patient"
              ? (doctor?.user?.full_name?.[0]?.toUpperCase() || "D")
              : (patient?.full_name?.[0]?.toUpperCase() || "P")}
          </div>

          <div className="appt-card__info">
            <p className="appt-card__title">
              {role === "patient"
                ? `Dr. ${doctor?.user?.full_name || "Unknown"}`
                : (patient?.full_name || "Patient")}
            </p>
            {doctor?.specialty && (
              <p className="appt-card__specialty">{doctor.specialty.name}</p>
            )}
          </div>
        </div>

        <Badge status={status} />
      </div>

      {/* Time */}
      <div className="appt-card__time">
        <div className="appt-card__time-start">
          <svg
            className="appt-card__time-icon"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>{formatDateTime(scheduled_at)}</span>
        </div>
        {end_at && (
          <span className="appt-card__time-end">→ {formatTime(end_at)}</span>
        )}
      </div>

      {/* Reason */}
      {reason && (
        <p className="appt-card__reason">
          <span className="appt-card__reason-label">Lý do khám</span>
          {reason}
        </p>
      )}

      {/* Cancellation / no-show reason */}
      {cancellation_reason && ["CANCELLED", "NOSHOW"].includes(status) && (
        <p className="appt-card__cancellation">
          <span className="appt-card__cancellation-label">Lý do hủy</span>
          {cancellation_reason}
        </p>
      )}

      {/* Badges row */}
      {(deposit_paid || reschedule_fee_applied || reschedule_count > 0) && (
        <div className="appt-card__badges">
          {deposit_paid && (
            <span className="appt-card__meta-badge appt-card__meta-badge--deposit">
              Đã đặt cọc
            </span>
          )}
          {reschedule_count > 0 && (
            <span className="appt-card__meta-badge appt-card__meta-badge--rescheduled">
              Đã đổi lịch ×{reschedule_count}
            </span>
          )}
          {reschedule_fee_applied && (
            <span className="appt-card__meta-badge appt-card__meta-badge--fee">
              Đã tính phí đổi lịch
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {actions && (
        <div className="appt-card__actions">{actions(appointment)}</div>
      )}
    </div>
  );
}
