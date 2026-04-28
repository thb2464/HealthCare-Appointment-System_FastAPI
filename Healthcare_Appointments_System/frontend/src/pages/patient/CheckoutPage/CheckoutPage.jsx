import "./CheckoutPage.css";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createVNPayPayment } from "../../../api/appointmentApi";
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

  const handlePayWithVNPay = async () => {
    if (!user) { navigate("/login"); return; }
    setLoading(true);
    try {
      const res = await createVNPayPayment({
        doctor_id: doctor.id,
        scheduled_at: scheduledAt,
        reason: reason || undefined,
      });
      // Redirect the browser to the VNPay payment page
      window.location.href = res.data.payment_url;
    } catch (err) {
      toast(err.response?.data?.detail || "Không thể khởi tạo thanh toán", "error");
      setLoading(false);
    }
    // Note: don't setLoading(false) on success — page is redirecting away
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
        Quay lại
      </button>

      <div className="checkout-page__header">
        <h1 className="checkout-page__title">Xác nhận &amp; Thanh toán</h1>
        <p className="checkout-page__subtitle">Kiểm tra thông tin lịch hẹn, sau đó thanh toán an toàn qua VNPay</p>
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
            <span className="checkout-page__detail-label">Ngày &amp; Giờ</span>
            <span className="checkout-page__detail-value checkout-page__detail-value--accent">
              {formatDateTime(scheduledAt)}
            </span>
          </div>

          {doctor?.consultation_fee && (
            <div className="checkout-page__detail-row">
              <span className="checkout-page__detail-label">Phí khám</span>
              <span className="checkout-page__detail-value">
                {Number(doctor.consultation_fee).toLocaleString("vi-VN")} ₫
              </span>
            </div>
          )}

          {reason && (
            <div className="checkout-page__detail-row checkout-page__detail-row--col">
              <span className="checkout-page__detail-label">Lý do khám</span>
              <span className="checkout-page__detail-value checkout-page__detail-reason">{reason}</span>
            </div>
          )}
        </div>

        <div className="checkout-page__divider" />

        {/* Notice */}
        <p className="checkout-page__notice">
          Lịch hẹn phải được đặt trước ít nhất <strong>2 ngày</strong>.
          Lịch hẹn sẽ được <strong>Xác nhận</strong> tự động sau khi thanh toán thành công.
        </p>

        {/* VNPay badge */}
        <div className="checkout-page__vnpay-badge">
          <svg viewBox="0 0 24 24" fill="none" className="checkout-page__lock-icon">
            <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm-3 5a3 3 0 1 1 6 0v3H9V6zm3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="currentColor"/>
          </svg>
          Bảo mật bởi <strong>VNPay</strong>
        </div>

        {/* Actions */}
        <div className="checkout-page__actions">
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={loading}>
            Quay lại
          </Button>
          <Button loading={loading} onClick={handlePayWithVNPay}>
            Thanh toán qua VNPay
          </Button>
        </div>
      </div>
    </div>
  );
}
