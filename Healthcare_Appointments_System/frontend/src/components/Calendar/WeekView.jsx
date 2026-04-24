import React, { useState } from "react";
import { formatTime, toDateParam } from "../../utils/dateHelpers";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d); }}
          className="btn-ghost p-2 rounded-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-display font-semibold text-slate-200">
          {week[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
          {week[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <button
          onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d); }}
          className="btn-ghost p-2 rounded-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {week.map((day, i) => {
          const key = toDateParam(day);
          const dayAppts = byDay[key] || [];
          const isToday = key === toDateParam(today);
          return (
            <div key={i} className={`min-h-[100px] rounded-xl p-2 ${isToday ? "border border-teal-500/40 bg-teal-500/5" : "glass"}`}>
              <p className={`text-xs font-semibold mb-2 ${isToday ? "text-teal-400" : "text-slate-500"}`}>
                {DAY_FULL[i].slice(0, 3)} {day.getDate()}
              </p>
              <div className="space-y-1">
                {dayAppts.map((a) => (
                  <div
                    key={a.id}
                    className="text-[10px] rounded-md px-1.5 py-1 bg-teal-500/15 border border-teal-500/20 text-teal-300 truncate"
                    title={`${a.patient?.full_name} — ${formatTime(a.scheduled_at)}`}
                  >
                    {formatTime(a.scheduled_at)} {a.patient?.full_name?.split(" ")[0]}
                  </div>
                ))}
                {dayAppts.length === 0 && (
                  <p className="text-[10px] text-slate-700">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
