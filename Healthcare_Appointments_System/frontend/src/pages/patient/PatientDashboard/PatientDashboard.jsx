import "./PatientDashboard.css";
import { useState, useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { createReview } from "../../../api/reviewApi";
import AppointmentCard from "../../../components/AppointmentCard/AppointmentCard";
import SlotPicker from "../../../components/Calendar/SlotPicker/SlotPicker";
import Badge from "../../../components/ui/Badge/Badge";
import Button from "../../../components/ui/Button/Button";
import Modal from "../../../components/ui/Modal/Modal";
import { useToast } from "../../../components/ui/Toast/Toast";
import { useAppointments } from "../../../hooks/useAppointments";
import { useAuth } from "../../../hooks/useAuth";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "RESCHEDULED", label: "Rescheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

export default function PatientDashboard() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const params = useMemo(() => statusFilter ? { status: statusFilter } : {}, [statusFilter]);
  const { appointments: rawAppointments, loading, cancel, reschedule, refetch } = useAppointments(params);

  const appointments = useMemo(() => {
    const sorted = [...rawAppointments].sort((a, b) => {
      const diff = new Date(b.scheduled_at) - new Date(a.scheduled_at);
      return sortOrder === "newest" ? diff : -diff;
    });
    return sorted;
  }, [rawAppointments, sortOrder]);

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [newSlot, setNewSlot] = useState(null);
  const [rLoading, setRLoading] = useState(false);

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Review modal
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [revLoading, setRevLoading] = useState(false);

  // Detail modal
  const [detailAppt, setDetailAppt] = useState(null);
  const [detailView, setDetailView] = useState("info"); // "info" | "reschedule"
  const [detailSlot, setDetailSlot] = useState(null);
  const [detailRLoading, setDetailRLoading] = useState(false);

  if (authLoading) return null;
  if (!user || user.role !== "patient") return <Navigate to="/login" replace />;

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      await cancel(cancelTarget.id, cancelReason || undefined);
      toast("Appointment cancelled", "info");
      setCancelTarget(null);
    } catch (e) {
      toast(e.response?.data?.detail || "Failed to cancel", "error");
    } finally {
      setCancelLoading(false);
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

  const handleDetailReschedule = async () => {
    if (!detailSlot) { toast("Please select a new slot", "error"); return; }
    setDetailRLoading(true);
    try {
      await reschedule(detailAppt.id, detailSlot);
      toast("Appointment rescheduled!", "success");
      setDetailAppt(null);
      setDetailView("info");
      setDetailSlot(null);
    } catch (e) {
      toast(e.response?.data?.detail || "Failed to reschedule", "error");
    } finally {
      setDetailRLoading(false);
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
    // Patients can only reschedule PENDING appointments (backend constraint)
    if (appt.status === "PENDING") {
      btns.push(
        <button
          key="reschedule"
          onClick={(e) => { e.stopPropagation(); setRescheduleTarget(appt); setNewSlot(null); }}
          className="patient-dash__action-btn patient-dash__action-btn--reschedule btn-secondary"
        >
          Reschedule
        </button>
      );
      btns.push(
        <button
          key="cancel"
          onClick={(e) => { e.stopPropagation(); setCancelTarget(appt); setCancelReason(""); }}
          className="patient-dash__action-btn patient-dash__action-btn--cancel btn-danger"
        >
          Cancel
        </button>
      );
    }
    if (appt.status === "COMPLETED") {
      btns.push(
        <button
          key="review"
          onClick={(e) => { e.stopPropagation(); setReviewTarget(appt); setReviewForm({ rating: 5, comment: "" }); }}
          className="patient-dash__action-btn patient-dash__action-btn--review btn-ghost"
        >
          ★ Leave review
        </button>
      );
    }
    return btns;
  };

  const upcoming = appointments.filter((a) => ["PENDING", "CONFIRMED", "RESCHEDULED"].includes(a.status));
  const filtered = appointments;

  const statRows = [
    { label: "Total",     value: appointments.length,                                          modifier: "total"     },
    { label: "Upcoming",  value: upcoming.length,                                               modifier: "upcoming"  },
    { label: "Completed", value: appointments.filter((a) => a.status === "COMPLETED").length,   modifier: "completed" },
    { label: "Cancelled", value: appointments.filter((a) => a.status === "CANCELLED").length,   modifier: "cancelled" },
  ];

  return (
    <div className="patient-dash">
      {/* Header */}
      <div className="patient-dash__header animate-fade-in">
        <div>
          <h1 className="patient-dash__title">My Appointments</h1>
          <p className="patient-dash__subtitle">
            Welcome back,{" "}
            <span className="patient-dash__subtitle-name">{user.full_name}</span>
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
        <div className="patient-dash__stats animate-slide-up">
          {statRows.map((s) => (
            <div key={s.label} className="stat-card">
              <p className={`patient-dash__stat-value patient-dash__stat-value--${s.modifier}`}>
                {s.value}
              </p>
              <p className="patient-dash__stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status filter tabs + sort */}
      <div className="patient-dash__controls">
        <div className="patient-dash__tabs">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={
                "patient-dash__tab" +
                (statusFilter === t.value ? " patient-dash__tab--active" : "")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          className="input patient-dash__sort-select"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="patient-dash__loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="patient-dash__loading-item skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="patient-dash__empty card">
          <span className="patient-dash__empty-icon">📅</span>
          <p className="patient-dash__empty-title">No appointments found</p>
          <p className="patient-dash__empty-hint">Book your first appointment with a doctor</p>
          <Link to="/search" className="btn-primary inline-flex">Find a doctor</Link>
        </div>
      ) : (
        <div className="patient-dash__list">
          {filtered.map((a) => (
            <div key={a.id} className="patient-dash__card-wrap" onClick={() => setDetailAppt(a)}>
              <AppointmentCard appointment={a} role="patient" actions={actions} />
            </div>
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
        <div className="patient-dash__reschedule-section">
          <Button variant="secondary" onClick={() => setRescheduleTarget(null)}>
            Cancel
          </Button>
          <Button loading={rLoading} disabled={!newSlot} onClick={handleReschedule}>
            Confirm Reschedule
          </Button>
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel Appointment">
        <div className="patient-dash__modal-body">
          <p className="patient-dash__modal-warn">
            Are you sure you want to cancel this appointment?
          </p>
          <div>
            <label className="label">
              Reason{" "}
              <span className="patient-dash__optional">
                (optional)
              </span>
            </label>
            <textarea
              className="patient-dash__modal-reason input"
              rows={3}
              placeholder="Let us know why you're cancelling…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="patient-dash__modal-actions">
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Keep appointment
            </Button>
            <Button variant="danger" loading={cancelLoading} onClick={handleCancel}>
              Confirm cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review modal */}
      <Modal open={!!reviewTarget} onClose={() => setReviewTarget(null)} title="Leave a Review">
        <div className="patient-dash__modal-body">
          <div>
            <label className="label">Rating</label>
            <div className="patient-dash__review-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                  className={
                    "patient-dash__review-star" +
                    (n <= reviewForm.rating ? " patient-dash__review-star--active" : "")
                  }
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">
              Comment{" "}
              <span className="patient-dash__optional">
                (optional)
              </span>
            </label>
            <textarea
              className="patient-dash__review-textarea input"
              rows={4}
              placeholder="Share your experience…"
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
              maxLength={1000}
            />
          </div>
          <div className="patient-dash__modal-actions">
            <Button variant="secondary" onClick={() => setReviewTarget(null)}>
              Cancel
            </Button>
            <Button loading={revLoading} onClick={handleReview}>
              Submit Review
            </Button>
          </div>
        </div>
      </Modal>

      {/* Appointment detail modal */}
      <Modal
        open={!!detailAppt}
        onClose={() => { setDetailAppt(null); setDetailView("info"); setDetailSlot(null); }}
        title={detailView === "reschedule" ? "Pick a new date & time" : "Appointment Details"}
        size="lg"
      >
        {detailAppt && detailView === "info" && (
          <div className="patient-dash__detail-body">
            <div className="patient-dash__detail-grid">
              <div>
                <p className="label">Doctor</p>
                <p className="patient-dash__detail-value">Dr. {detailAppt.doctor?.user?.full_name}</p>
                {detailAppt.doctor?.specialty && <p className="patient-dash__detail-sub">{detailAppt.doctor.specialty.name}</p>}
              </div>
              <div>
                <p className="label">Date &amp; Time</p>
                <p className="patient-dash__detail-value">{new Date(detailAppt.scheduled_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="label">Status</p>
                <Badge status={detailAppt.status} />
              </div>
              {detailAppt.reason && (
                <div>
                  <p className="label">Reason</p>
                  <p className="patient-dash__detail-sub">{detailAppt.reason}</p>
                </div>
              )}
              {detailAppt.cancellation_reason && (
                <div>
                  <p className="label">Cancellation reason</p>
                  <p className="patient-dash__detail-sub">{detailAppt.cancellation_reason}</p>
                </div>
              )}
              {detailAppt.reschedule_count > 0 && (
                <div>
                  <p className="label">Reschedules</p>
                  <p className="patient-dash__detail-value">×{detailAppt.reschedule_count}</p>
                </div>
              )}
            </div>
            <div className="patient-dash__modal-actions">
              {["PENDING", "CONFIRMED"].includes(detailAppt.status) && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => { setDetailView("reschedule"); setDetailSlot(null); }}
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setCancelTarget(detailAppt);
                      setCancelReason("");
                      setDetailAppt(null);
                      setDetailView("info");
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={() => { setDetailAppt(null); setDetailView("info"); }}>Close</Button>
            </div>
          </div>
        )}

        {detailAppt && detailView === "reschedule" && (
          <div className="patient-dash__detail-reschedule">
            <div className="patient-dash__detail-reschedule-info">
              <p className="patient-dash__detail-sub">
                Current: <strong>{new Date(detailAppt.scheduled_at).toLocaleString()}</strong> with Dr. {detailAppt.doctor?.user?.full_name}
              </p>
            </div>
            <SlotPicker doctorId={detailAppt.doctor?.id} onSelect={setDetailSlot} />
            <div className="patient-dash__reschedule-section">
              <Button variant="secondary" onClick={() => { setDetailView("info"); setDetailSlot(null); }}>
                Back
              </Button>
              <Button loading={detailRLoading} disabled={!detailSlot} onClick={handleDetailReschedule}>
                Confirm Reschedule
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
