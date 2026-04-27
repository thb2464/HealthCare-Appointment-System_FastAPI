import "./DoctorDashboard.css";
import React, { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useAppointments } from "../../../hooks/useAppointments";
import { useToast } from "../../../components/ui/Toast/Toast";
import AppointmentCard from "../../../components/AppointmentCard/AppointmentCard";
import WeekView from "../../../components/Calendar/WeekView/WeekView";
import SlotPicker from "../../../components/Calendar/SlotPicker/SlotPicker";
import Modal from "../../../components/ui/Modal/Modal";
import Button from "../../../components/ui/Button/Button";
import { updateAppointment, rescheduleAppointment, markNoShow } from "../../../api/appointmentApi";
import { getMyDoctorProfile, updateMyDoctorProfile, getSpecialties } from "../../../api/doctorApi";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "COMPLETED", label: "Completed" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

const STAT_MODIFIER = {
  Total: "total",
  Pending: "pending",
  Confirmed: "confirmed",
  Arrived: "arrived",
  Completed: "completed",
};

export default function DoctorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [view, setView] = useState("list"); // list | calendar
  const params = statusFilter ? { status: statusFilter } : {};
  const { appointments: rawAppointments, loading, refetch } = useAppointments(params);

  const appointments = React.useMemo(() => {
    const sorted = [...rawAppointments].sort((a, b) => {
      const diff = new Date(b.scheduled_at) - new Date(a.scheduled_at);
      return sortOrder === "newest" ? diff : -diff;
    });
    return sorted;
  }, [rawAppointments, sortOrder]);

  // Profile edit
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({});
  const [specialties, setSpecialties] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);

  // Complete with notes modal
  const [noteTarget, setNoteTarget] = useState(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Reschedule modal (doctors can reschedule CONFIRMED)
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [newSlot, setNewSlot] = useState(null);
  const [rLoading, setRLoading] = useState(false);

  // No-show modal
  const [noshowTarget, setNoshowTarget] = useState(null);
  const [noshowReason, setNoshowReason] = useState("");
  const [noshowLoading, setNoshowLoading] = useState(false);

  useEffect(() => {
    if (user?.role === "doctor") {
      getMyDoctorProfile().then(({ data }) => {
        setProfile(data);
        setProfileForm({
          bio: data.bio || "",
          license_number: data.license_number || "",
          years_experience: data.years_experience ?? "",
          clinic_address: data.clinic_address || "",
          consultation_fee: data.consultation_fee ?? "",
          specialty_id: data.specialty?.id ?? "",
        });
      }).catch(() => {});
      getSpecialties().then(({ data }) => setSpecialties(data)).catch(() => {});
    }
  }, [user]);

  if (authLoading) return null;
  if (!user || user.role !== "doctor") return <Navigate to="/login" replace />;

  const handleStatus = async (appt, newStatus, apptNotes) => {
    try {
      await updateAppointment(appt.id, { status: newStatus, notes: apptNotes || undefined });
      toast(`Appointment ${newStatus}`, "success");
      setNoteTarget(null);
      refetch();
    } catch (e) {
      toast(e.response?.data?.detail || "Action failed", "error");
    }
  };

  const handleNoShow = async () => {
    setNoshowLoading(true);
    try {
      await markNoShow(noshowTarget.id, noshowReason || undefined);
      toast("Appointment marked as no-show", "info");
      setNoshowTarget(null);
      refetch();
    } catch (e) {
      toast(e.response?.data?.detail || "Action failed", "error");
    } finally {
      setNoshowLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!newSlot) { toast("Please select a new slot", "error"); return; }
    setRLoading(true);
    try {
      await rescheduleAppointment(rescheduleTarget.id, newSlot);
      toast("Appointment rescheduled!", "success");
      setRescheduleTarget(null);
      refetch();
    } catch (e) {
      toast(e.response?.data?.detail || "Failed to reschedule", "error");
    } finally {
      setRLoading(false);
    }
  };

  const handleProfileSave = async () => {
    setProfileLoading(true);
    try {
      const payload = { ...profileForm };
      if (!payload.specialty_id) delete payload.specialty_id;
      if (payload.years_experience === "") delete payload.years_experience;
      if (payload.consultation_fee === "") delete payload.consultation_fee;
      await updateMyDoctorProfile(payload);
      toast("Profile updated!", "success");
      setProfileOpen(false);
    } catch (e) {
      toast(e.response?.data?.detail || "Update failed", "error");
    } finally {
      setProfileLoading(false);
    }
  };

  const actions = (appt) => {
    const btns = [];
    if (appt.status === "PENDING") {
      btns.push(
        <button
          key="confirm"
          onClick={() => handleStatus(appt, "confirmed")}
          className="btn-primary doctor-dash__appt-btn"
        >
          Confirm
        </button>
      );
    }
    if (appt.status === "CONFIRMED") {
      btns.push(
        <button
          key="complete"
          onClick={() => { setNoteTarget({ appt, action: "completed" }); setNotes(""); }}
          className="btn-primary doctor-dash__appt-btn"
        >
          Mark Complete
        </button>
      );
      btns.push(
        <button
          key="reschedule"
          onClick={() => { setRescheduleTarget(appt); setNewSlot(null); }}
          className="btn-secondary doctor-dash__appt-btn"
        >
          Reschedule
        </button>
      );
      btns.push(
        <button
          key="noshow"
          onClick={() => { setNoshowTarget(appt); setNoshowReason(""); }}
          className="btn-ghost doctor-dash__appt-btn doctor-dash__appt-btn--noshow"
        >
          No-Show
        </button>
      );
    }
    if (appt.status === "ARRIVED") {
      btns.push(
        <button
          key="complete-arrived"
          onClick={() => { setNoteTarget({ appt, action: "completed" }); setNotes(""); }}
          className="btn-primary doctor-dash__appt-btn"
        >
          Mark Complete
        </button>
      );
      btns.push(
        <button
          key="noshow-arrived"
          onClick={() => { setNoshowTarget(appt); setNoshowReason(""); }}
          className="btn-ghost doctor-dash__appt-btn doctor-dash__appt-btn--noshow"
        >
          No-Show
        </button>
      );
    }
    if (["PENDING", "CONFIRMED"].includes(appt.status)) {
      btns.push(
        <button
          key="cancel"
          onClick={() => handleStatus(appt, "cancelled")}
          className="btn-danger doctor-dash__appt-btn"
        >
          Cancel
        </button>
      );
    }
    return btns;
  };

  const pending = appointments.filter((a) => a.status === "PENDING").length;
  const confirmed = appointments.filter((a) => a.status === "CONFIRMED").length;
  const arrived = appointments.filter((a) => a.status === "ARRIVED").length;

  const statItems = [
    { label: "Total",     value: appointments.length },
    { label: "Pending",   value: pending },
    { label: "Confirmed", value: confirmed },
    { label: "Arrived",   value: arrived },
    { label: "Completed", value: appointments.filter((a) => a.status === "COMPLETED").length },
  ];

  return (
    <div className="doctor-dash">
      {/* Header */}
      <div className="doctor-dash__header animate-fade-in">
        <div>
          <h1 className="doctor-dash__title">Doctor Dashboard</h1>
          <p className="doctor-dash__subtitle">
            Dr. <span className="doctor-dash__subtitle-name">{user.full_name}</span>
          </p>
        </div>
        <div className="doctor-dash__actions">
          <button
            onClick={() => setProfileOpen(true)}
            className="btn-secondary doctor-dash__action-btn"
          >
            <svg
              className="doctor-dash__action-btn-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit Profile
          </button>
          <Link to="/doctor/availability" className="btn-primary doctor-dash__action-btn">
            <svg
              className="doctor-dash__action-btn-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Availability
          </Link>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="doctor-dash__stats">
          {statItems.map((s) => (
            <div key={s.label} className="stat-card">
              <p className={`doctor-dash__stat-value doctor-dash__stat-value--${STAT_MODIFIER[s.label]}`}>
                {s.value}
              </p>
              <p className="doctor-dash__stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs: status filter + sort + view toggle */}
      <div className="doctor-dash__tabs">
        <div className="doctor-dash__tab-group">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={
                statusFilter === t.value
                  ? "doctor-dash__tab doctor-dash__tab--active"
                  : "doctor-dash__tab glass glass-hover"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="doctor-dash__tab-actions">
          <select
            className="input doctor-dash__sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="doctor-dash__view-toggle glass">
            {["list", "calendar"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={
                  view === v
                    ? "doctor-dash__view-btn doctor-dash__view-btn--active"
                    : "doctor-dash__view-btn"
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="doctor-dash__loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton doctor-dash__skeleton-item" />
          ))}
        </div>
      ) : view === "calendar" ? (
        <div className="card doctor-dash__week-view">
          <WeekView appointments={appointments} />
        </div>
      ) : appointments.length === 0 ? (
        <div className="card doctor-dash__empty">
          <div className="doctor-dash__empty-icon">🩺</div>
          <p className="doctor-dash__empty-title">No appointments yet</p>
          <p className="doctor-dash__empty-hint">Set your availability to start receiving bookings</p>
          <Link to="/doctor/availability" className="btn-primary doctor-dash__empty-link">
            Set availability
          </Link>
        </div>
      ) : (
        <div className="doctor-dash__list">
          {appointments.map((a) => (
            <AppointmentCard key={a.id} appointment={a} role="doctor" actions={actions} />
          ))}
        </div>
      )}

      {/* Notes / complete modal */}
      <Modal open={!!noteTarget} onClose={() => setNoteTarget(null)} title="Add Notes">
        <div className="doctor-dash__modal-body">
          <p className="doctor-dash__modal-warn">
            Mark appointment as <strong>completed</strong> and optionally add clinical notes.
          </p>
          <div className="doctor-dash__profile-field">
            <label className="label">
              Clinical notes <span className="doctor-dash__modal-reason">(optional)</span>
            </label>
            <textarea
              className="input"
              style={{ resize: "none" }}
              rows={4}
              placeholder="Diagnosis, treatment notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="doctor-dash__modal-actions">
            <Button variant="secondary" onClick={() => setNoteTarget(null)}>Cancel</Button>
            <Button
              loading={actionLoading}
              onClick={async () => {
                setActionLoading(true);
                await handleStatus(noteTarget.appt, noteTarget.action, notes);
                setActionLoading(false);
              }}
            >
              Mark Complete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reschedule modal */}
      <Modal
        open={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        title="Reschedule Appointment"
        size="lg"
      >
        <SlotPicker doctorId={rescheduleTarget?.doctor?.id} onSelect={setNewSlot} />
        <div className="doctor-dash__modal-reschedule-actions">
          <Button variant="secondary" onClick={() => setRescheduleTarget(null)}>
            Cancel
          </Button>
          <Button loading={rLoading} disabled={!newSlot} onClick={handleReschedule}>
            Confirm Reschedule
          </Button>
        </div>
      </Modal>

      {/* No-show modal */}
      <Modal open={!!noshowTarget} onClose={() => setNoshowTarget(null)} title="Mark as No-Show">
        <div className="doctor-dash__modal-body">
          <p className="doctor-dash__modal-warn">
            Record that the patient did not attend this appointment. A notification will be sent.
          </p>
          <div className="doctor-dash__profile-field">
            <label className="label">
              Reason <span className="doctor-dash__modal-reason">(optional)</span>
            </label>
            <textarea
              className="input"
              style={{ resize: "none" }}
              rows={3}
              placeholder="Add notes about the no-show…"
              value={noshowReason}
              onChange={(e) => setNoshowReason(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="doctor-dash__modal-actions">
            <Button variant="secondary" onClick={() => setNoshowTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={noshowLoading} onClick={handleNoShow}>
              Confirm No-Show
            </Button>
          </div>
        </div>
      </Modal>

      {/* Profile edit modal */}
      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="Edit Profile" size="lg">
        <div className="doctor-dash__profile-form">
          <div className="doctor-dash__profile-grid">
            <div className="doctor-dash__profile-field">
              <label className="label">Bio</label>
              <textarea
                className="input"
                style={{ resize: "none" }}
                rows={3}
                value={profileForm.bio}
                onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>
            <div className="doctor-dash__profile-form">
              <div className="doctor-dash__profile-field">
                <label className="label">Specialty</label>
                <select
                  className="input"
                  value={profileForm.specialty_id}
                  onChange={(e) => setProfileForm((f) => ({ ...f, specialty_id: e.target.value }))}
                >
                  <option value="">Not specified</option>
                  {specialties.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="doctor-dash__profile-field">
                <label className="label">Years experience</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  className="input"
                  value={profileForm.years_experience}
                  onChange={(e) => setProfileForm((f) => ({ ...f, years_experience: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className="doctor-dash__profile-grid">
            <div className="doctor-dash__profile-field">
              <label className="label">Clinic address</label>
              <input
                className="input"
                value={profileForm.clinic_address}
                onChange={(e) => setProfileForm((f) => ({ ...f, clinic_address: e.target.value }))}
              />
            </div>
            <div className="doctor-dash__profile-field">
              <label className="label">Consultation fee ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={profileForm.consultation_fee}
                onChange={(e) => setProfileForm((f) => ({ ...f, consultation_fee: e.target.value }))}
              />
            </div>
            <div className="doctor-dash__profile-field">
              <label className="label">License number</label>
              <input
                className="input"
                value={profileForm.license_number}
                onChange={(e) => setProfileForm((f) => ({ ...f, license_number: e.target.value }))}
              />
            </div>
          </div>
          <div className="doctor-dash__profile-actions">
            <Button variant="secondary" onClick={() => setProfileOpen(false)}>Cancel</Button>
            <Button loading={profileLoading} onClick={handleProfileSave}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
