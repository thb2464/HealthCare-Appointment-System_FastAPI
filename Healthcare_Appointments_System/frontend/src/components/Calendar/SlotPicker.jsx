import React, { useState, useEffect } from "react";
import { getDoctorSlots } from "../../api/doctorApi";
import { formatTime, toDateParam } from "../../utils/dateHelpers";

const DAY_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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

export default function SlotPicker({ doctorId, onSelect }) {
  const today = new Date();
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeDate, setActiveDate] = useState(toDateParam(today));

  const week = getWeekDays(anchor);

  useEffect(() => {
    if (!doctorId || !activeDate) return;
    setLoading(true);
    setSlots([]);
    getDoctorSlots(doctorId, activeDate)
      .then(({ data }) => setSlots(data))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [doctorId, activeDate]);

  const prevWeek = () => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - 7);
    if (d >= today) setAnchor(d);
  };

  const nextWeek = () => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + 7);
    setAnchor(d);
  };

  const handleSlot = (slot) => {
    setSelected(slot);
    onSelect?.(slot);
  };

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevWeek}
          className="btn-ghost p-2 rounded-lg"
          title="Previous week"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-slate-300">
          {week[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
          {week[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <button onClick={nextWeek} className="btn-ghost p-2 rounded-lg" title="Next week">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((day, i) => {
          const param = toDateParam(day);
          const isToday = param === toDateParam(today);
          const isPast = day < today && !isToday;
          const isActive = param === activeDate;
          return (
            <button
              key={i}
              onClick={() => !isPast && setActiveDate(param)}
              disabled={isPast}
              className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-xs transition-all
                ${isPast ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                ${isActive
                  ? "bg-teal-500 text-navy-950 font-bold shadow-glow-sm"
                  : isToday
                  ? "border border-teal-500/50 text-teal-400"
                  : "glass glass-hover text-slate-400"
                }`}
            >
              <span className="font-medium">{DAY_SHORT[i]}</span>
              <span className="font-bold mt-0.5">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Slots */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-xl" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No available slots on this day
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
          {slots.map((slot) => (
            <button
              key={slot}
              onClick={() => handleSlot(slot)}
              className={`py-2.5 px-2 rounded-xl text-sm font-medium transition-all
                ${selected === slot
                  ? "bg-teal-500 text-navy-950 shadow-glow-sm"
                  : "glass glass-hover text-slate-300 hover:text-teal-400"
                }`}
            >
              {formatTime(slot)}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <p className="text-sm text-center text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-xl py-2.5 px-4">
          Selected: <strong>{formatTime(selected)}</strong> on{" "}
          <strong>
            {new Date(activeDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </strong>
        </p>
      )}
    </div>
  );
}
