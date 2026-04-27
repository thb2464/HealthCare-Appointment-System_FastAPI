import "./CheckoutPage.css";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { bookAppointment } from "../../../api/appointmentApi";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../components/ui/Toast/Toast";
import Button from "../../../components/ui/Button/Button";
import { formatDateTime } from "../../../utils/dateHelpers";

export default function CheckoutPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Guard: if no booking state, redirect back to search
  if (!state?.doctor || !state?.scheduledAt) {
    navigate("/search", { replace: true });
    return null;
  }

  const { doctor, scheduledAt, reason } = state;

  const handleConfirm = async () => {
    if (!user) { navigate("/login"); return; }
    setLoading(true);
    try {
      await bookAppointment({
        doctor_id: doctor.id,
        scheduled_at: scheduledAt,
        reason: reason || undefined,
      });
      toast("Appointment booked successfully!", "success");
      navigate("/dashboard");
    } catch (err) {
      toast(err.response?.data?.detail || "Booking failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-page animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="checkout-page__back btn-ghost"
      >
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="checkout-page__back-icon">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="checkout-page__header">
        <h1 className="checkout-page__title">Review &amp; Confirm</h1>
        <p className="checkout-page__subtitle">Check your appointment details before confirming</p>
      </div>

      <div className="card checkout-page__card">
        {/* Doctor */}
        <div className="checkout-page__doctor">
          <div className="checkout-page__doctor-avatar">
            {doctor?.user?.full_name?.[0]?.toUpperCase() || "D"}
          </div>
          <div>
            <p className="checkout-page__doctor-name">Dr. {doctor?.user?.full_name}</p>
            {doctor?.specialty && (
              <p className="checkout-page__doctor-specialty">{doctor.specialty.name}</p>
            )}
          </div>
        </div>

        <div className="checkout-page__divider" />

        {/* Details */}
        <div className="checkout-page__details">
          <div className="checkout-page__detail-row">
            <span className="checkout-page__detail-label">Date &amp; Time</span>
            <span className="checkout-page__detail-value checkout-page__detail-value--accent">
              {formatDateTime(scheduledAt)}
            </span>
          </div>

          {doctor?.consultation_fee && (
            <div className="checkout-page__detail-row">
              <span className="checkout-page__detail-label">Consultation fee</span>
              <span className="checkout-page__detail-value">
                ${Number(doctor.consultation_fee).toFixed(0)}
              </span>
            </div>
          )}

          {reason && (
            <div className="checkout-page__detail-row checkout-page__detail-row--col">
              <span className="checkout-page__detail-label">Reason for visit</span>
              <span className="checkout-page__detail-value checkout-page__detail-reason">{reason}</span>
            </div>
          )}
        </div>

        <div className="checkout-page__divider" />

        {/* Notice */}
        <p className="checkout-page__notice">
          Appointments must be booked at least <strong>2 days in advance</strong>. Status will be <strong>Pending</strong> until confirmed by the doctor.
        </p>

        {/* Actions */}
        <div className="checkout-page__actions">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button loading={loading} onClick={handleConfirm}>
            Confirm Booking
          </Button>
        </div>
      </div>
    </div>
  );
}
