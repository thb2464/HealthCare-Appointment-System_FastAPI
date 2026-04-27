import "./SlotPicker.css";
import React, { useState, useEffect } from "react";
import { getDoctorSlots } from "../../../api/doctorApi";
import { formatTime, toDateParam } from "../../../utils/dateHelpers";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_ABBR = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function buildCalendarDays(year, month) {
  // Returns array of Date or null (for padding)
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

export default function SlotPicker({ doctorId, onSelect }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 2); // 2-day advance minimum

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [activeDate, setActiveDate] = useState(null);
  const [selected,   setSelected]  = useState(null);
  const [slots,      setSlots]     = useState([]);
  const [loading,    setLoading]   = useState(false);

  const days = buildCalendarDays(viewYear, viewMonth);

  useEffect(() => {
    if (!doctorId || !activeDate) return;
    setLoading(true);
    setSlots([]);
    setSelected(null);
    onSelect?.(null);
    getDoctorSlots(doctorId, activeDate)
      .then(({ data }) => setSlots(data))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, activeDate]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Disable prev if current month is already the current month
  const canGoPrev = viewYear > today.getFullYear() || viewMonth > today.getMonth();

  const handleDayClick = (day) => {
    if (!day) return;
    day.setHours(0, 0, 0, 0);
    if (day < minDate) return;
    setActiveDate(toDateParam(day));
  };

  const handleSlot = (slot) => {
    setSelected(slot);
    onSelect?.(slot);
  };

  return (
    <div className="slot-picker">
      {/* Month navigation */}
      <div className="slot-picker__nav">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="btn-ghost slot-picker__nav-btn"
          title="Previous month"
        >
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="slot-picker__week-label">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="btn-ghost slot-picker__nav-btn"
          title="Next month"
        >
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="slot-picker__cal-header">
        {DAY_ABBR.map(d => (
          <span key={d} className="slot-picker__cal-dow">{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="slot-picker__cal-grid">
        {days.map((day, i) => {
          if (!day) return <span key={`pad-${i}`} />;
          const param   = toDateParam(day);
          const isPast  = day < minDate;
          const isToday = toDateParam(day) === toDateParam(today);
          const isActive = param === activeDate;

          const cls = [
            "slot-picker__cal-day",
            isPast   ? "slot-picker__cal-day--past"   : "",
            isActive ? "slot-picker__cal-day--active"  : "",
            !isPast && isToday && !isActive ? "slot-picker__cal-day--today" : "",
          ].filter(Boolean).join(" ");

          return (
            <button
              key={param}
              type="button"
              disabled={isPast}
              onClick={() => handleDayClick(day)}
              className={cls}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time slots */}
      {activeDate && (
        <>
          <p className="slot-picker__slots-label">
            Available times for{" "}
            <strong>
              {new Date(activeDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </strong>
          </p>
          {loading ? (
            <div className="slot-picker__loading">
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton" />)}
            </div>
          ) : slots.length === 0 ? (
            <div className="slot-picker__empty">No available slots on this day</div>
          ) : (
            <div className="slot-picker__slots scrollbar-thin">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleSlot(slot)}
                  className={
                    selected === slot
                      ? "slot-picker__slot slot-picker__slot--selected"
                      : "slot-picker__slot glass glass-hover"
                  }
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <p className="slot-picker__summary">
          Selected: <strong>{formatTime(selected)}</strong> on{" "}
          <strong>
            {new Date(activeDate + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric",
            })}
          </strong>
        </p>
      )}
    </div>
  );
}
