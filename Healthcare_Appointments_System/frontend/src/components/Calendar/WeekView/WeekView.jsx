import React, { useState } from "react";
import "./WeekView.css";
import { formatTime, toDateParam } from "../../../utils/dateHelpers";

const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getWeekDays(anchor) {
  const d = new Date(anchor);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    return dd;
  });
}

/**
 * WeekView — readonly calendar that shows a doctor's appointments for a week
 * appointments: AppointmentListResponse[]
 */
export default function WeekView({ appointments = [] }) {
  const today = new Date();
  const [anchor, setAnchor] = useState(today);
  const week = getWeekDays(anchor);

  const byDay = {};
  appointments.forEach((a) => {
    const key = toDateParam(new Date(a.scheduled_at));
    (byDay[key] ||= []).push(a);
  });

  return (
    <div className="week-view">
      <div className="week-view__nav">
        <button
          onClick={() => {
            const d = new Date(anchor);
            d.setDate(d.getDate() - 7);
            setAnchor(d);
          }}
          className="week-view__nav-btn btn-ghost"
        >
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="week-view__week-label">
          {week[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
          {week[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>

        <button
          onClick={() => {
            const d = new Date(anchor);
            d.setDate(d.getDate() + 7);
            setAnchor(d);
          }}
          className="week-view__nav-btn btn-ghost"
        >
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="week-view__grid">
        {week.map((day, i) => {
          const key = toDateParam(day);
          const dayAppts = byDay[key] || [];
          const isToday = key === toDateParam(today);

          return (
            <div
              key={i}
              className={
                isToday
                  ? "week-view__col week-view__col--today"
                  : "week-view__col glass"
              }
            >
              <p
                className={
                  isToday
                    ? "week-view__col-header week-view__col-header--today"
                    : "week-view__col-header"
                }
              >
                {DAY_FULL[i].slice(0, 3)} {day.getDate()}
              </p>

              <div className="week-view__events">
                {dayAppts.map((a) => (
                  <div
                    key={a.id}
                    className="week-view__event"
                    title={`${a.patient?.full_name} — ${formatTime(a.scheduled_at)}`}
                  >
                    {formatTime(a.scheduled_at)} {a.patient?.full_name?.split(" ")[0]}
                  </div>
                ))}
                {dayAppts.length === 0 && (
                  <p className="week-view__empty">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
