import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/ui/Toast";
import { adminGetStats, adminGetUsers, adminToggleUser } from "../../api/appointmentApi";
import { getSpecialties } from "../../api/doctorApi";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { formatDateTime } from "../../utils/dateHelpers";

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "text-teal-400" }) {
  return (
    <div className="stat-card">
      <p className={`font-display font-bold text-4xl ${color}`}>{value ?? "—"}</p>
      <p className="text-slate-400 text-sm font-medium">{label}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

const ROLE_FILTER = [
  { value: "", label: "All users" },
  { value: "patient", label: "Patients" },
  { value: "doctor", label: "Doctors" },
];

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("stats"); // stats | users | specialties
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [specialtyForm, setSpecialtyForm] = useState({ name: "", description: "" });
  const [specialtyOpen, setSpecialtyOpen] = useState(false);
  const [specLoading, setSpecLoading] = useState(false);

  useEffect(() => {
    if (user?.role?.toLowerCase() === "admin") {
      adminGetStats().then(({ data }) => setStats(data)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (tab === "users" && user?.role?.toLowerCase() === "admin") {
      setUsersLoading(true);
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (activeFilter !== "") params.is_active = activeFilter === "true";
      adminGetUsers(params)
        .then(({ data }) => setUsers(data))
        .catch(() => setUsers([]))
        .finally(() => setUsersLoading(false));
    }
  }, [tab, roleFilter, activeFilter, user]);

  useEffect(() => {
    if (tab === "specialties" && user?.role?.toLowerCase() === "admin") {
      getSpecialties().then(({ data }) => setSpecialties(data)).catch(() => {});
    }
  }, [tab, user]);

  if (authLoading) return null;
  if (!user || user.role?.toLowerCase() !== "admin") return <Navigate to="/login" replace />;

  const handleToggleUser = async (u) => {
    try {
      await adminToggleUser(u.id, !u.is_active);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
      toast(`User ${!u.is_active ? "activated" : "deactivated"}`, "success");
    } catch (e) {
      toast(e.response?.data?.detail || "Action failed", "error");
    }
  };

  const handleCreateSpecialty = async () => {
    if (!specialtyForm.name.trim()) { toast("Name is required", "error"); return; }
    setSpecLoading(true);
    try {
      // POST /api/specialties via axiosClient directly
      const { default: axiosClient } = await import("../../api/axiosClient");
      const { data } = await axiosClient.post("/api/specialties", specialtyForm);
      setSpecialties((prev) => [...prev, data]);
      toast("Specialty created!", "success");
      setSpecialtyOpen(false);
      setSpecialtyForm({ name: "", description: "" });
    } catch (e) {
      toast(e.response?.data?.detail || "Failed to create specialty", "error");
    } finally {
      setSpecLoading(false);
    }
  };

  const handleDeleteSpecialty = async (id) => {
    if (!window.confirm("Delete this specialty?")) return;
    try {
      const { default: axiosClient } = await import("../../api/axiosClient");
      await axiosClient.delete(`/api/specialties/${id}`);
      setSpecialties((prev) => prev.filter((s) => s.id !== id));
      toast("Specialty deleted", "info");
    } catch (e) {
      toast(e.response?.data?.detail || "Failed to delete", "error");
    }
  };

  const APPT_STATUS_COLORS = {
    pending: "text-amber-400",
    confirmed: "text-teal-400",
    completed: "text-green-400",
    cancelled: "text-red-400",
    rescheduled: "text-blue-400",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-slate-100">Admin Panel</h1>
        <p className="text-slate-400 text-sm mt-1">Platform management & analytics</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass rounded-xl p-1 w-fit mb-8">
        {[
          { key: "stats", label: "📊 Statistics" },
          { key: "users", label: "👤 Users" },
          { key: "specialties", label: "🏥 Specialties" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? "bg-teal-500/20 text-teal-400" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── STATS ── */}
      {tab === "stats" && (
        <div className="space-y-6 animate-slide-up">
          {!stats ? (
            <div className="grid sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-3 gap-4">
                <StatCard label="Total users" value={stats.users?.total} sub={`${stats.users?.patients} patients · ${stats.users?.doctors} doctors`} />
                <StatCard label="Total appointments" value={stats.appointments?.total} color="text-slate-100" />
                <StatCard label="Completed appointments" value={stats.appointments?.completed} color="text-green-400" />
              </div>
              <div className="card p-6">
                <h2 className="font-display font-semibold text-lg text-slate-100 mb-5">Appointment Breakdown</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {["pending", "confirmed", "completed", "cancelled", "rescheduled"].map((s) => (
                    <div key={s} className="text-center glass rounded-xl py-4 px-3">
                      <p className={`font-display font-bold text-2xl ${APPT_STATUS_COLORS[s]}`}>
                        {stats.appointments?.[s] ?? 0}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 capitalize">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── USERS ── */}
      {tab === "users" && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex flex-wrap gap-3">
            <div className="flex glass rounded-xl overflow-hidden">
              {ROLE_FILTER.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setRoleFilter(f.value)}
                  className={`px-4 py-2 text-sm font-medium transition-all ${roleFilter === f.value ? "bg-teal-500/20 text-teal-400" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              className="input w-40 py-2 text-sm bg-navy-900/50"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="">All status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {usersLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-slate-500">No users found</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Joined</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500/20 to-navy-700 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                            {u.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-200">{u.full_name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                          u.role === "doctor" ? "bg-teal-500/10 text-teal-400" :
                          u.role === "admin" ? "bg-purple-500/10 text-purple-400" :
                          "bg-blue-500/10 text-blue-400"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell text-slate-500 text-xs">
                        {formatDateTime(u.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-semibold ${u.is_active ? "text-green-400" : "text-slate-600"}`}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleToggleUser(u)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                            u.is_active
                              ? "text-red-400 hover:bg-red-500/10"
                              : "text-green-400 hover:bg-green-500/10"
                          }`}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SPECIALTIES ── */}
      {tab === "specialties" && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex justify-end">
            <Button onClick={() => setSpecialtyOpen(true)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add specialty
            </Button>
          </div>

          {specialties.length === 0 ? (
            <div className="text-center py-16 text-slate-500">No specialties yet</div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {specialties.map((sp) => (
                <div key={sp.id} className="card p-5 flex items-start justify-between group">
                  <div>
                    <p className="font-medium text-slate-200">{sp.name}</p>
                    {sp.description && <p className="text-xs text-slate-500 mt-1">{sp.description}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteSpecialty(sp.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-3 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Specialty modal */}
      <Modal open={specialtyOpen} onClose={() => setSpecialtyOpen(false)} title="Add Specialty">
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="e.g. Cardiology"
              value={specialtyForm.name}
              onChange={(e) => setSpecialtyForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Description <span className="text-slate-600">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Brief description…"
              value={specialtyForm.description}
              onChange={(e) => setSpecialtyForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setSpecialtyOpen(false)}>Cancel</Button>
            <Button loading={specLoading} className="flex-1" onClick={handleCreateSpecialty}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
