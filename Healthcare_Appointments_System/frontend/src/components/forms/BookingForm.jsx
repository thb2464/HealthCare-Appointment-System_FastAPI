import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { bookAppointment } from "../../api/appointmentApi";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../ui/Toast";
import Button from "../ui/Button";
import SlotPicker from "../Calendar/SlotPicker";
import { formatDateTime } from "../../utils/dateHelpers";

export default function BookingForm({ doctor }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) { toast("Please select a time slot", "error"); return; }
    if (!user) { toast("You must be logged in to book", "error"); navigate("/login"); return; }
    setLoading(true);
    try {
      await bookAppointment({
        doctor_id: doctor.id,
        scheduled_at: selectedSlot,
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
    <form onSubmit={submit} className="space-y-6">
      {/* Doctor info */}
      <div className="flex items-center gap-4 p-4 glass rounded-xl border border-white/[0.06]">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-navy-700 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold font-display">
          {doctor?.user?.full_name?.[0]?.toUpperCase() || "D"}
        </div>
        <div>
          <p className="font-semibold text-slate-100">Dr. {doctor?.user?.full_name}</p>
          {doctor?.specialty && (
            <p className="text-sm text-teal-400/80">{doctor.specialty.name}</p>
          )}
          {doctor?.consultation_fee && (
            <p className="text-xs text-slate-400 mt-0.5">
              Fee: <span className="text-slate-300 font-medium">${Number(doctor.consultation_fee).toFixed(0)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Slot picker */}
      <div>
        <label className="label mb-3">Select date & time</label>
        <div className="card p-4">
          <SlotPicker doctorId={doctor?.id} onSelect={setSelectedSlot} />
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="label">
          Reason for visit <span className="text-slate-600">(optional)</span>
        </label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="Briefly describe your symptoms or reason…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
        <p className="text-xs text-slate-600 text-right mt-1">{reason.length}/500</p>
      </div>

      {/* Summary */}
      {selectedSlot && (
        <div className="p-4 bg-teal-500/5 border border-teal-500/20 rounded-xl text-sm">
          <p className="text-slate-400 mb-1 text-xs uppercase tracking-wider font-medium">Booking summary</p>
          <p className="text-slate-200">
            <span className="text-teal-400 font-medium">{formatDateTime(selectedSlot)}</span>
            {" "}with <span className="font-medium">Dr. {doctor?.user?.full_name}</span>
          </p>
        </div>
      )}

      <Button type="submit" loading={loading} disabled={!selectedSlot} className="w-full">
        Confirm Appointment
      </Button>
    </form>
  );
}
