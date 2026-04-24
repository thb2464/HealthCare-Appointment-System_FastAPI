import React, { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useAppointments } from "../../hooks/useAppointments";
import { useToast } from "../../components/ui/Toast";
import AppointmentCard from "../../components/AppointmentCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import SlotPicker from "../../components/Calendar/SlotPicker";
import { createReview } from "../../api/appointmentApi";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function PatientDashboard() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const params = statusFilter ? { status: statusFilter } : {};
  const { appointments, loading, cancel, reschedule, refetch } = useAppointments(params);

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [newSlot, setNewSlot] = useState(null);
  const [rLoading, setRLoading] = useState(false);

  // Review modal
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [revLoading, setRevLoading] = useState(false);

  if (authLoading) return null;
  if (!user || user.role !== "patient") return <Navigate to="/login" replace />;

  const handleCancel = async (appt) => {
    if (!window.confirm("Cancel this appointment?")) return;
    try {
      await cancel(appt.id);
      toast("Appointment cancelled", "info");
    } catch (e) {
      toast(e.response?.data?.detail || "Failed to cancel", "error");
    }
  };

  const handleReschedule = async () => {
    if (!newSlot) { toast("Please select a new slot", "error"); return; }
    setRLoading(true);
    try {
      await reschedule(rescheduleTarget.id, newSlot);
      toast("Appointment rescheduled!", "success");
      setRescheduleTarget(null);
    } catch (e) {
      toast(e.response?.data?.detail || "Failed to reschedule", "error");
    } finally {
      setRLoading(false);
    }
  };

  const handleReview = async () => {
    setRevLoading(true);
    try {
      await createReview({ appointment_id: reviewTarget.id, ...reviewForm });
      toast("Review submitted!", "success");
      setReviewTarget(null);
      refetch();
    } catch (e) {
      toast(e.response?.data?.detail || "Failed to submit review", "error");
    } finally {
      setRevLoading(false);
    }
  };

  const actions = (appt) => {
    const btns = [];
    if (["pending", "confirmed"].includes(appt.status)) {
      btns.push(
        <button key="reschedule" onClick={() => { setRescheduleTarget(appt); setNewSlot(null); }} className="btn-secondary text-xs py-1.5 px-3">
          Reschedule
        </button>
      );
      btns.push(
        <button key="cancel" onClick={() => handleCancel(appt)} className="btn-danger text-xs py-1.5 px-3">
          Cancel
        </button>
      );
    }
    if (appt.status === "completed") {
      btns.push(
        <button key="review" onClick={() => { setReviewTarget(appt); setReviewForm({ rating: 5, comment: "" }); }} className="btn-ghost text-xs py-1.5 px-3 text-amber-400 hover:bg-amber-400/10">
          ★ Leave review
        </button>
      );
    }
    return btns;
  };

  const upcoming = appointments.filter((a) => ["pending", "confirmed"].includes(a.status));
  const filtered = statusFilter ? appointments : appointments;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="font-display font-bold text-3xl text-slate-100">My Appointments</h1>
          <p className="text-slate-400 text-sm mt-1">
            Welcome back, <span className="text-teal-400">{user.full_name}</span>
          </p>
        </div>
        <Link to="/search" className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Book new
        </Link>
      </div>

      {/* Quick stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-slide-up">
          {[
            { label: "Total", value: appointments.length, color: "text-slate-100" },
            { label: "Upcoming", value: upcoming.length, color: "text-teal-400" },
            { label: "Completed", value: appointments.filter((a) => a.status === "completed").length, color: "text-green-400" },
            { label: "Cancelled", value: appointments.filter((a) => a.status === "cancelled").length, color: "text-slate-500" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <p className={`font-display font-bold text-3xl ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === t.value
                ? "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                : "glass glass-hover text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 card">
          <div className="text-4xl mb-4">📅</div>
          <p className="text-slate-400 font-medium">No appointments found</p>
          <p className="text-slate-500 text-sm mt-1 mb-6">Book your first appointment with a doctor</p>
          <Link to="/search" className="btn-primary inline-flex">Find a doctor</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <AppointmentCard key={a.id} appointment={a} role="patient" actions={actions} />
          ))}
        </div>
      )}

      {/* Reschedule modal */}
      <Modal
        open={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        title="Reschedule Appointment"
        size="lg"
      >
        <SlotPicker doctorId={rescheduleTarget?.doctor?.id} onSelect={setNewSlot} />
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" className="flex-1" onClick={() => setRescheduleTarget(null)}>
            Cancel
          </Button>
          <Button loading={rLoading} disabled={!newSlot} className="flex-1" onClick={handleReschedule}>
            Confirm Reschedule
          </Button>
        </div>
      </Modal>

      {/* Review modal */}
      <Modal open={!!reviewTarget} onClose={() => setReviewTarget(null)} title="Leave a Review">
        <div className="space-y-4">
          <div>
            <label className="label">Rating</label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                  className={`text-2xl transition-transform hover:scale-110 ${n <= reviewForm.rating ? "text-amber-400" : "text-slate-700"}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Comment <span className="text-slate-600">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Share your experience…"
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
              maxLength={1000}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setReviewTarget(null)}>
              Cancel
            </Button>
            <Button loading={revLoading} className="flex-1" onClick={handleReview}>
              Submit Review
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
