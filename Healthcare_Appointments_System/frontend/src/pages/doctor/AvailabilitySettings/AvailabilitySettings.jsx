import "./AvailabilitySettings.css";
import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../components/ui/Toast/Toast";
import { getDoctorAvailability, setMyAvailability, getMyDoctorProfile } from "../../../api/doctorApi";
import Button from "../../../components/ui/Button/Button";

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
      <div className="avail-page__skeleton-wrap">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton avail-page__skeleton-item" />
        ))}
      </div>
    );
  }

  return (
    <div className="avail-page animate-fade-in">
      {/* Header */}
      <div className="avail-page__header">
        <div className="avail-page__titles">
          <h1 className="avail-page__title">Availability Settings</h1>
          <p className="avail-page__subtitle">
            Set your weekly schedule. Patients can only book within these windows.
          </p>
        </div>
        <div className="avail-page__top-save">
          <Button loading={saving} onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </div>

      {/* Days */}
      <div className="avail-page__days">
        {DAY_FULL.map((dayName, dayIdx) => {
          const daySlots = slots.map((s, i) => ({ ...s, _idx: i })).filter((s) => s.day_of_week === dayIdx);
          const isActive = daySlots.length > 0;

          return (
            <div
              key={dayIdx}
              className={`card avail-page__day${isActive ? " avail-page__day--active" : ""}`}
            >
              {/* Day header */}
              <div className="avail-page__day-header">
                <div className="avail-page__day-header-left">
                  <div className={`avail-page__day-badge${isActive ? " avail-page__day-badge--active" : ""}`}>
                    {DAY_SHORT[dayIdx]}
                  </div>
                  <span className={`avail-page__day-name${isActive ? " avail-page__day-name--active" : ""}`}>
                    {dayName}
                  </span>
                  {isActive && (
                    <span className="avail-page__day-count">
                      {daySlots.length} window{daySlots.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => addSlot(dayIdx)}
                  className="btn-ghost avail-page__add-btn"
                >
                  <svg
                    className="avail-page__add-btn-icon"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add window
                </button>
              </div>

              {/* Time windows */}
              {daySlots.length > 0 && (
                <div className="avail-page__windows">
                  {daySlots.map((slot) => (
                    <div key={slot._idx} className="glass avail-page__window">
                      {/* From */}
                      <div className="avail-page__field">
                        <label className="avail-page__field-label avail-page__field-label--from">From</label>
                        <input
                          type="time"
                          className="input avail-page__time-input"
                          value={slot.start_time.slice(0, 5)}
                          onChange={(e) => updateSlot(slot._idx, "start_time", e.target.value + ":00")}
                        />
                      </div>
                      {/* To */}
                      <div className="avail-page__field">
                        <label className="avail-page__field-label avail-page__field-label--to">To</label>
                        <input
                          type="time"
                          className="input avail-page__time-input"
                          value={slot.end_time.slice(0, 5)}
                          onChange={(e) => updateSlot(slot._idx, "end_time", e.target.value + ":00")}
                        />
                      </div>
                      {/* Slot duration */}
                      <div className="avail-page__field">
                        <label className="avail-page__field-label">Slot</label>
                        <select
                          className="input avail-page__duration-select"
                          value={slot.slot_duration_minutes}
                          onChange={(e) => updateSlot(slot._idx, "slot_duration_minutes", e.target.value)}
                        >
                          {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                            <option key={m} value={m}>{m} min</option>
                          ))}
                        </select>
                      </div>
                      {/* Toggle + Delete */}
                      <div className="avail-page__window-controls">
                        <label className="avail-page__toggle">
                          <input
                            type="checkbox"
                            className="avail-page__toggle-input"
                            checked={slot.is_active}
                            onChange={(e) => updateSlot(slot._idx, "is_active", e.target.checked)}
                          />
                          <div className="avail-page__toggle-track" />
                        </label>
                        <button
                          className="avail-page__delete-btn"
                          onClick={() => removeSlot(slot._idx)}
                        >
                          <svg
                            className="avail-page__delete-btn-icon"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {daySlots.length === 0 && (
                <div className="avail-page__empty-day">Not available on {dayName}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky footer */}
      <div className="avail-page__sticky-footer">
        <Button loading={saving} onClick={handleSave} size="lg" className="shadow-glow">
          Save availability
        </Button>
      </div>
    </div>
  );
}
