import "./BookingForm.css";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../ui/Toast/Toast";
import Button from "../../ui/Button/Button";
import SlotPicker from "../../Calendar/SlotPicker/SlotPicker";
import { formatDateTime } from "../../../utils/dateHelpers";

export default function BookingForm({ doctor }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState("");

  const handleCheckout = () => {
    if (!selectedSlot) { toast("Vui lòng chọn ngày và giờ khám", "error"); return; }
    if (!user) { navigate("/login"); return; }

    navigate("/checkout", {
      state: {
        doctor,
        scheduledAt: selectedSlot,
        reason: reason || null,
      },
    });
  };

  return (
    <div className="booking-form">

      {/* Doctor info */}
      <div className="booking-form__doctor glass">
        <div className="booking-form__doctor-avatar">
          {doctor?.user?.full_name?.[0]?.toUpperCase() || "D"}
        </div>
        <div className="booking-form__doctor-info">
          <p className="booking-form__doctor-name">Dr. {doctor?.user?.full_name}</p>
          {doctor?.specialty && (
            <p className="booking-form__doctor-specialty">{doctor.specialty.name}</p>
          )}
          {doctor?.consultation_fee && (
            <p className="booking-form__doctor-fee">
              Phí khám:{" "}
              <span className="booking-form__doctor-fee-value">
                {Number(doctor.consultation_fee).toLocaleString("vi-VN")} ₫
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Slot picker */}
      <div className="booking-form__slot-section">
        <label className="label booking-form__slot-label">Chọn ngày &amp; giờ</label>
        <div className="card booking-form__slot-card">
          <SlotPicker doctorId={doctor?.id} onSelect={setSelectedSlot} />
        </div>
      </div>

      {/* Reason */}
      <div className="booking-form__reason-section">
        <label className="label booking-form__reason-label">
          Lý do khám <span className="booking-form__reason-optional">(không bắt buộc)</span>
        </label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="Mô tả ngắn gọn triệu chứng hoặc lý do khám…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
        <p className="booking-form__reason-char-count">{reason.length}/500</p>
      </div>

      {/* Summary */}
      {selectedSlot && (
        <div className="booking-form__summary">
          <p className="booking-form__summary-label">Tóm tắt lịch hẹn</p>
          <p className="booking-form__summary-text">
            <span className="booking-form__summary-text--accent">{formatDateTime(selectedSlot)}</span>
            {" "}với <span className="booking-form__summary-text--bold">BS. {doctor?.user?.full_name}</span>
          </p>
        </div>
      )}

      <Button onClick={handleCheckout} className="booking-form__submit">
        Thanh toán
      </Button>

    </div>
  );
}
