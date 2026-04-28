import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoctor, getDoctorSlots } from "../../../api/doctorApi";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../components/ui/Toast/Toast";
import Button from "../../../components/ui/Button/Button";
import { formatTime, toDateParam } from "../../../utils/dateHelpers";
import "./BookingPage.css";

const MONTH_NAMES = [
  "Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
  "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12",
];
const DAY_ABBR = ["T2","T3","T4","T5","T6","T7","CN"];

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const dow = firstDay.getDay();
  const startDow = dow === 0 ? 6 : dow - 1;
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");

  // Calendar state
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 2);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [activeDate, setActiveDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const calDays = buildCalendarDays(viewYear, viewMonth);
  const canGoPrev = viewYear > today.getFullYear() || viewMonth > today.getMonth();

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!authLoading && user?.role !== "patient") { navigate("/"); return; }
    getDoctor(id)
      .then(({ data }) => setDoctor(data))
      .catch(() => navigate("/search"))
      .finally(() => setLoading(false));
  }, [id, navigate, user, authLoading]);

  useEffect(() => {
    if (!doctor?.id || !activeDate) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    getDoctorSlots(doctor.id, activeDate)
      .then(({ data }) => setSlots(data))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [doctor?.id, activeDate]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const handleDayClick = (day) => {
    if (!day) return;
    day.setHours(0, 0, 0, 0);
    if (day < minDate) return;
    setActiveDate(toDateParam(day));
  };

  const handleCheckout = () => {
    if (!selectedSlot) { toast("Vui lòng chọn ngày và giờ khám", "error"); return; }
    navigate("/checkout", {
      state: { doctor, scheduledAt: selectedSlot, reason: reason || null },
    });
  };

  if (loading || authLoading) {
    return (
      <div className="bp__loading">
        <div className="skeleton bp__skeleton-lg" />
        <div className="skeleton bp__skeleton-sm" />
      </div>
    );
  }
  if (!doctor) return null;

  const activeDateObj = activeDate ? new Date(activeDate + "T00:00:00") : null;
  const activeDateStr = activeDateObj?.toLocaleDateString("vi-VN", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="bp animate-fade-in">
      {/* Back + title */}
      <div className="bp__top">
        <button onClick={() => navigate(-1)} className="bp__back btn-ghost">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Quay lại
        </button>
        <h1 className="bp__title">Đặt lịch khám</h1>
        <p className="bp__subtitle">Chọn ngày, giờ và xác nhận lịch hẹn</p>
      </div>

      {/* Main 2-col layout */}
      <div className="bp__grid">

        {/* ─── LEFT: Calendar ─── */}
        <div className="bp__calendar card">
          <div className="bp__cal-nav">
            <button type="button" onClick={prevMonth} disabled={!canGoPrev} className="btn-ghost bp__cal-nav-btn">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="bp__cal-month">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="btn-ghost bp__cal-nav-btn">
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="bp__cal-header">
            {DAY_ABBR.map(d => <span key={d} className="bp__cal-dow">{d}</span>)}
          </div>

          <div className="bp__cal-grid">
            {calDays.map((day, i) => {
              if (!day) return <span key={`p${i}`} />;
              const param = toDateParam(day);
              const isPast = day < minDate;
              const isToday = param === toDateParam(today);
              const isActive = param === activeDate;
              const cls = [
                "bp__cal-day",
                isPast && "bp__cal-day--past",
                isActive && "bp__cal-day--active",
                !isPast && isToday && !isActive && "bp__cal-day--today",
              ].filter(Boolean).join(" ");
              return (
                <button key={param} type="button" disabled={isPast} onClick={() => handleDayClick(day)} className={cls}>
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Slots inside calendar card */}
          <div className="bp__slots-area">
            {!activeDate ? (
              <p className="bp__slots-hint">Chọn một ngày để xem giờ khám</p>
            ) : slotsLoading ? (
              <div className="bp__slots-grid">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton bp__slot-skeleton" />)}
              </div>
            ) : slots.length === 0 ? (
              <p className="bp__slots-empty">Không có khung giờ trống cho {activeDateStr}</p>
            ) : (
              <>
                <p className="bp__slots-label">{activeDateStr}</p>
                <div className="bp__slots-grid">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={selectedSlot === slot ? "bp__slot bp__slot--selected" : "bp__slot glass glass-hover"}
                    >
                      {formatTime(slot)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Doctor + Reason + Summary ─── */}
        <div className="bp__sidebar">

          {/* Doctor card */}
          <div className="bp__doctor card">
            <div className="bp__doctor-avatar">
              {doctor?.user?.full_name?.[0]?.toUpperCase() || "D"}
            </div>
            <div className="bp__doctor-info">
              <p className="bp__doctor-name">Dr. {doctor?.user?.full_name}</p>
              {doctor?.specialty && <p className="bp__doctor-specialty">{doctor.specialty.name}</p>}
              {doctor?.consultation_fee && (
                <p className="bp__doctor-fee">
                  {Number(doctor.consultation_fee).toLocaleString("vi-VN")} ₫
                </p>
              )}
            </div>
          </div>

          {/* Reason */}
          <div className="bp__reason card">
            <label className="bp__reason-label">
              Lý do khám <span className="bp__reason-opt">(không bắt buộc)</span>
            </label>
            <textarea
              className="input"
              rows={3}
              style={{ resize: "none" }}
              placeholder="Mô tả triệu chứng hoặc lý do…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
            <span className="bp__reason-count">{reason.length}/500</span>
          </div>

          {/* Summary + action */}
          <div className="bp__action card">
            {selectedSlot ? (
              <div className="bp__summary">
                <p className="bp__summary-label">Lịch hẹn của bạn</p>
                <p className="bp__summary-time">{formatTime(selectedSlot)}</p>
                <p className="bp__summary-date">{activeDateStr}</p>
                <p className="bp__summary-doctor">BS. {doctor?.user?.full_name}</p>
              </div>
            ) : (
              <p className="bp__action-hint">Chọn ngày và giờ để tiếp tục</p>
            )}
            <Button onClick={handleCheckout} disabled={!selectedSlot} className="bp__submit-btn">
              Thanh toán
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
