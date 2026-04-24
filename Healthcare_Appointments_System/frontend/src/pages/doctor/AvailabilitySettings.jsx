import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/ui/Toast";
import { getDoctorAvailability, setMyAvailability, getMyDoctorProfile } from "../../api/doctorApi";
import Button from "../../components/ui/Button";

const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function emptySlot(day_of_week) {
  return { day_of_week, start_time: "09:00:00", end_time: "17:00:00", slot_duration_minutes: 30, is_active: true };
}

export default function AvailabilitySettings() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && user?.role === "doctor") {
      getMyDoctorProfile()
        .then(({ data: doc }) =>
          getDoctorAvailability(doc.id).then(({ data }) => {
            setSlots(data.length > 0 ? data : []);
          })
        )
        .catch(() => setSlots([]))
        .finally(() => setLoading(false));
    }
  }, [user, authLoading]);

  if (authLoading) return null;
  if (!user || user.role !== "doctor") return <Navigate to="/login" replace />;

  const daysWithSlots = new Set(slots.map((s) => s.day_of_week));

  const addSlot = (day) => {
    setSlots((prev) => [...prev, emptySlot(day)]);
  };

  const removeSlot = (idx) => {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx, field, value) => {
    setSlots((prev) =>
      prev.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate: start < end for each slot
      for (const s of slots) {
        if (s.start_time >= s.end_time) {
          toast(`Day ${DAY_FULL[s.day_of_week]}: end time must be after start time`, "error");
          setSaving(false);
          return;
        }
      }
      const payload = slots.map(({ day_of_week, start_time, end_time, slot_duration_minutes, is_active }) => ({
        day_of_week,
        start_time,
        end_time,
        slot_duration_minutes: Number(slot_duration_minutes),
        is_active,
      }));
      await setMyAvailability(payload);
      toast("Availability saved!", "success");
    } catch (e) {
      toast(e.response?.data?.detail || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl text-slate-100">Availability Settings</h1>
          <p className="text-slate-400 text-sm mt-1">
            Set your weekly schedule. Patients can only book within these windows.
          </p>
        </div>
        <Button loading={saving} onClick={handleSave} className="shrink-0">
          Save changes
        </Button>
      </div>

      <div className="space-y-3">
        {DAY_FULL.map((dayName, dayIdx) => {
          const daySlots = slots.map((s, i) => ({ ...s, _idx: i })).filter((s) => s.day_of_week === dayIdx);
          const isActive = daySlots.length > 0;

          return (
            <div key={dayIdx} className={`card transition-all ${isActive ? "border-teal-500/20" : "opacity-70"}`}>
              {/* Day header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold font-display ${
                    isActive ? "bg-teal-500/15 text-teal-400 border border-teal-500/20" : "bg-navy-800 text-slate-600"
                  }`}>
                    {DAY_SHORT[dayIdx]}
                  </div>
                  <span className={`font-medium ${isActive ? "text-slate-200" : "text-slate-500"}`}>{dayName}</span>
                  {isActive && (
                    <span className="text-xs text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                      {daySlots.length} window{daySlots.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => addSlot(dayIdx)}
                  className="btn-ghost text-xs flex items-center gap-1.5 text-teal-400 hover:bg-teal-500/10"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add window
                </button>
              </div>

              {/* Time windows */}
              {daySlots.length > 0 && (
                <div className="p-4 space-y-3">
                  {daySlots.map((slot) => (
                    <div key={slot._idx} className="flex flex-wrap items-center gap-3 p-3 glass rounded-xl">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 w-8">From</label>
                        <input
                          type="time"
                          className="input w-32 py-1.5 text-sm"
                          value={slot.start_time.slice(0, 5)}
                          onChange={(e) => updateSlot(slot._idx, "start_time", e.target.value + ":00")}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 w-6">To</label>
                        <input
                          type="time"
                          className="input w-32 py-1.5 text-sm"
                          value={slot.end_time.slice(0, 5)}
                          onChange={(e) => updateSlot(slot._idx, "end_time", e.target.value + ":00")}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Slot</label>
                        <select
                          className="input w-28 py-1.5 text-sm bg-navy-900/50"
                          value={slot.slot_duration_minutes}
                          onChange={(e) => updateSlot(slot._idx, "slot_duration_minutes", e.target.value)}
                        >
                          {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                            <option key={m} value={m}>{m} min</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={slot.is_active}
                            onChange={(e) => updateSlot(slot._idx, "is_active", e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-700 peer-checked:bg-teal-500 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                        </label>
                        <button
                          onClick={() => removeSlot(slot._idx)}
                          className="text-slate-600 hover:text-red-400 transition-colors p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {daySlots.length === 0 && (
                <div className="px-6 py-3 text-xs text-slate-600">Not available on {dayName}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-5 mt-6 flex justify-end">
        <Button loading={saving} onClick={handleSave} size="lg" className="shadow-glow">
          Save availability
        </Button>
      </div>
    </div>
  );
}
