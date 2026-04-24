import React, { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useAppointments } from "../../hooks/useAppointments";
import { useToast } from "../../components/ui/Toast";
import AppointmentCard from "../../components/AppointmentCard";
import WeekView from "../../components/Calendar/WeekView";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { updateAppointment } from "../../api/appointmentApi";
import { getMyDoctorProfile, updateMyDoctorProfile } from "../../api/doctorApi";
import { getSpecialties } from "../../api/doctorApi";
import { useEffect } from "react";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
];

export default function DoctorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState("list"); // list | calendar
  const params = statusFilter ? { status: statusFilter } : {};
  const { appointments, loading, refetch } = useAppointments(params);

  // Profile edit
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({});
  const [specialties, setSpecialties] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);

  // Action modal
  const [noteTarget, setNoteTarget] = useState(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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

  const handleStatus = async (appt, newStatus) => {
    try {
      await updateAppointment(appt.id, { status: newStatus, notes: notes || undefined });
      toast(`Appointment ${newStatus}`, "success");
      setNoteTarget(null);
      refetch();
    } catch (e) {
      toast(e.response?.data?.detail || "Action failed", "error");
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
    if (appt.status === "pending") {
      btns.push(
        <button key="confirm" onClick={() => handleStatus(appt, "confirmed")} className="btn-primary text-xs py-1.5 px-3">
          Confirm
        </button>
      );
    }
    if (appt.status === "confirmed") {
      btns.push(
        <button key="complete" onClick={() => { setNoteTarget({ appt, action: "completed" }); setNotes(""); }} className="btn-primary text-xs py-1.5 px-3">
          Mark Complete
        </button>
      );
    }
    if (["pending", "confirmed"].includes(appt.status)) {
      btns.push(
        <button key="cancel" onClick={() => handleStatus(appt, "cancelled")} className="btn-danger text-xs py-1.5 px-3">
          Cancel
        </button>
      );
    }
    return btns;
  };

  const pending = appointments.filter((a) => a.status === "pending").length;
  const confirmed = appointments.filter((a) => a.status === "confirmed").length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="font-display font-bold text-3xl text-slate-100">Doctor Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Dr. <span className="text-teal-400">{user.full_name}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setProfileOpen(true)} className="btn-secondary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Profile
          </button>
          <Link to="/doctor/availability" className="btn-primary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Availability
          </Link>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-slide-up">
          {[
            { label: "Total", value: appointments.length, color: "text-slate-100" },
            { label: "Pending", value: pending, color: "text-amber-400" },
            { label: "Confirmed", value: confirmed, color: "text-teal-400" },
            { label: "Completed", value: appointments.filter((a) => a.status === "completed").length, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <p className={`font-display font-bold text-3xl ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex flex-wrap gap-1.5">
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
        <div className="flex glass rounded-xl overflow-hidden">
          {["list", "calendar"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                view === v ? "bg-teal-500/20 text-teal-400" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : view === "calendar" ? (
        <div className="card p-6">
          <WeekView appointments={appointments} />
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-20 card">
          <div className="text-4xl mb-4">🩺</div>
          <p className="text-slate-400 font-medium">No appointments yet</p>
          <p className="text-slate-500 text-sm mt-1">Set your availability to start receiving bookings</p>
          <Link to="/doctor/availability" className="btn-primary inline-flex mt-6">Set availability</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((a) => (
            <AppointmentCard key={a.id} appointment={a} role="doctor" actions={actions} />
          ))}
        </div>
      )}

      {/* Notes / complete modal */}
      <Modal open={!!noteTarget} onClose={() => setNoteTarget(null)} title="Add Notes">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Mark appointment as <strong className="text-green-400">completed</strong> and optionally add clinical notes.
          </p>
          <div>
            <label className="label">Clinical notes <span className="text-slate-600">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Diagnosis, treatment notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setNoteTarget(null)}>Cancel</Button>
            <Button
              loading={actionLoading}
              className="flex-1"
              onClick={async () => {
                setActionLoading(true);
                await handleStatus(noteTarget.appt, noteTarget.action);
                setActionLoading(false);
              }}
            >
              Mark Complete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Profile edit modal */}
      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="Edit Profile" size="lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Bio</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={profileForm.bio}
                onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Specialty</label>
                <select
                  className="input bg-navy-900/50"
                  value={profileForm.specialty_id}
                  onChange={(e) => setProfileForm((f) => ({ ...f, specialty_id: e.target.value }))}
                >
                  <option value="">Not specified</option>
                  {specialties.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
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
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Clinic address</label>
              <input
                className="input"
                value={profileForm.clinic_address}
                onChange={(e) => setProfileForm((f) => ({ ...f, clinic_address: e.target.value }))}
              />
            </div>
            <div>
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
            <div>
              <label className="label">License number</label>
              <input
                className="input"
                value={profileForm.license_number}
                onChange={(e) => setProfileForm((f) => ({ ...f, license_number: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setProfileOpen(false)}>Cancel</Button>
            <Button loading={profileLoading} className="flex-1" onClick={handleProfileSave}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
