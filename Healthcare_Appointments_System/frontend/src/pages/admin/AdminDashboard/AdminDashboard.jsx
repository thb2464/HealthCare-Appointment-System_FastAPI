import "./AdminDashboard.css";
import React, { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../components/ui/Toast/Toast";
import {
  adminGetStats, adminGetUsers, adminCreateUser, adminToggleUser,
  adminGetAppointments, adminUpdateAppointment,
  adminGetDoctors, adminUpdateDoctor,
  createSpecialty, deleteSpecialty,
} from "../../../api/adminApi";
import { getSpecialties } from "../../../api/doctorApi";
import Modal from "../../../components/ui/Modal/Modal";
import Button from "../../../components/ui/Button/Button";
import Badge from "../../../components/ui/Badge/Badge";
import { formatDateTime, relativeTime } from "../../../utils/dateHelpers";

// ── helpers ────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "overview",     icon: "📊", label: "Tổng quan" },
  { key: "users",        icon: "👥", label: "Người dùng" },
  { key: "appointments", icon: "📅", label: "Lịch hẹn" },
  { key: "doctors",      icon: "🩺", label: "Bác sĩ" },
  { key: "specialties",  icon: "🏥", label: "Chuyên khoa" },
];

const APPT_STATUSES = ["PENDING","CONFIRMED","ARRIVED","COMPLETED","CANCELLED","RESCHEDULED","NOSHOW"];

// Map role → BEM modifier
const ROLE_CLASS = {
  DOCTOR:       "admin-dash__role-badge--doctor",
  PATIENT:      "admin-dash__role-badge--patient",
  ADMIN:        "admin-dash__role-badge--admin",
  RECEPTIONIST: "admin-dash__role-badge--receptionist",
};

// Map status-key → BEM modifier for count text
const STATUS_COUNT_CLASS = {
  pending:     "admin-dash__status-count--amber",
  confirmed:   "admin-dash__status-count--teal",
  arrived:     "admin-dash__status-count--violet",
  completed:   "admin-dash__status-count--green",
  cancelled:   "admin-dash__status-count--red",
  rescheduled: "admin-dash__status-count--blue",
  noshow:      "admin-dash__status-count--orange",
};

// Map status-key → BEM modifier for progress bar fill
const STATUS_BAR_CLASS = {
  pending:     "admin-dash__status-bar--amber",
  confirmed:   "admin-dash__status-bar--teal",
  arrived:     "admin-dash__status-bar--violet",
  completed:   "admin-dash__status-bar--green",
  cancelled:   "admin-dash__status-bar--red",
  rescheduled: "admin-dash__status-bar--blue",
  noshow:      "admin-dash__status-bar--orange",
};

// Map color token → BEM value modifier
const VALUE_COLOR_CLASS = {
  "text-teal-400":   "admin-dash__stat-value--teal",
  "text-slate-100":  "admin-dash__stat-value--slate",
  "text-green-400":  "admin-dash__stat-value--green",
  "text-amber-400":  "admin-dash__stat-value--amber",
  "text-violet-400": "admin-dash__stat-value--violet",
  "text-red-400":    "admin-dash__stat-value--red",
  "text-orange-400": "admin-dash__stat-value--orange",
};

const STAFF_ROLES = ["DOCTOR", "RECEPTIONIST", "ADMIN"];

function StatCard({ label, value, sub, icon, color = "text-teal-400" }) {
  const valClass = `admin-dash__stat-value ${VALUE_COLOR_CLASS[color] ?? "admin-dash__stat-value--teal"}`;
  return (
    <div className="stat-card">
      <div className="admin-dash__stat-header">
        <p className={valClass}>{value ?? "—"}</p>
        <span className="admin-dash__stat-icon">{icon}</span>
      </div>
      <div>
        <p className="admin-dash__stat-label">{label}</p>
        {sub && <p className="admin-dash__stat-sub">{sub}</p>}
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="admin-dash__search">
      <svg
        className="admin-dash__search-icon"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        className="input admin-dash__search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="admin-dash__empty">
      <div className="admin-dash__empty-icon">{icon}</div>
      <p className="admin-dash__empty-title">{title}</p>
      {sub && <p className="admin-dash__empty-sub">{sub}</p>}
    </div>
  );
}

function Skeleton({ rows = 5 }) {
  return (
    <div className="admin-dash__loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton admin-dash__skeleton-item--sm" />
      ))}
    </div>
  );
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────
function MiniBarChart({ data }) {
  if (!data?.length) return <div className="admin-dash__no-data">Không có dữ liệu</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="admin-dash__mini-chart">
      {data.slice(-14).map((d, i) => (
        <div key={i} className="admin-dash__bar-col">
          <div
            className="admin-dash__bar"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? "4px" : "0" }}
            title={`${d.date}: ${d.count}`}
          />
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════════════════
function OverviewTab({ stats }) {
  if (!stats) {
    return (
      <div className="admin-dash__skeleton-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton admin-dash__skeleton-item" />
        ))}
      </div>
    );
  }

  const appt = stats.appointments ?? {};
  const statusRows = [
    { label: "Chờ xác nhận",  key: "pending",     colorKey: "pending" },
    { label: "Đã xác nhận",   key: "confirmed",   colorKey: "confirmed" },
    { label: "Đã đến",        key: "arrived",     colorKey: "arrived" },
    { label: "Hoàn thành",    key: "completed",   colorKey: "completed" },
    { label: "Đã hủy",        key: "cancelled",   colorKey: "cancelled" },
    { label: "Đã đổi lịch",   key: "rescheduled", colorKey: "rescheduled" },
    { label: "Vắng mặt",      key: "noshow",      colorKey: "noshow" },
  ];

  return (
    <div className="admin-dash__overview admin-dash__tab-content">
      {/* Top stats */}
      <div className="admin-dash__stats-grid">
        <StatCard icon="👥" label="Tổng người dùng"      value={stats.users?.total}    sub={`${stats.users?.patients ?? 0} bệnh nhân · ${stats.users?.doctors ?? 0} bác sĩ`} />
        <StatCard icon="📅" label="Tổng lịch hẹn"        value={appt.total}            color="text-slate-100" />
        <StatCard icon="✅" label="Hoàn thành"            value={appt.completed}        color="text-green-400" />
        <StatCard icon="💰" label="Doanh thu (hoàn thành)" value={`${Number(stats.revenue?.total_completed ?? 0).toLocaleString("vi-VN")} ₫`} sub={`Chờ khám: ${stats.waitlist?.total ?? 0}`} color="text-amber-400" />
      </div>

      {/* Appointment breakdown + chart */}
      <div className="admin-dash__charts-row">
        <div className="card admin-dash__chart-card">
          <h2 className="admin-dash__chart-title">Phân bổ trạng thái lịch hẹn</h2>
          <div className="admin-dash__status-rows">
            {statusRows.map(({ label, key, colorKey }) => {
              const val = appt[key] ?? 0;
              const pct = appt.total ? Math.round((val / appt.total) * 100) : 0;
              return (
                <div key={key} className="admin-dash__status-row">
                  <div className="admin-dash__status-meta">
                    <span className="admin-dash__status-label">{label}</span>
                    <span className={`admin-dash__status-count ${STATUS_COUNT_CLASS[colorKey]}`}>
                      {val}{" "}
                      <span className="admin-dash__status-pct">({pct}%)</span>
                    </span>
                  </div>
                  <div className="admin-dash__status-track">
                    <div
                      className={`admin-dash__status-bar ${STATUS_BAR_CLASS[colorKey]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card admin-dash__chart-card">
          <h2 className="admin-dash__chart-title">Lịch hẹn (14 ngày qua)</h2>
          <MiniBarChart data={stats.daily_appointments} />
          <div className="admin-dash__chart-dates">
            <span>{stats.daily_appointments?.at(-14)?.date ?? ""}</span>
            <span>{stats.daily_appointments?.at(-1)?.date ?? ""}</span>
          </div>
        </div>
      </div>

      {/* Quick summary */}
      <div className="admin-dash__stats-grid--4 admin-dash__stats-grid">
        <StatCard icon="🕐" label="Chờ duyệt"          value={appt.pending}            color="text-amber-400" />
        <StatCard icon="⏳" label="Bệnh nhân chờ"      value={stats.waitlist?.total}   color="text-violet-400" />
        <StatCard icon="❌" label="Đã hủy"              value={appt.cancelled}          color="text-red-400" />
        <StatCard icon="🚫" label="Vắng mặt"            value={appt.noshow ?? 0}        color="text-orange-400" />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// USERS TAB
// ══════════════════════════════════════════════════════════════════════════════
function UsersTab({ toast }) {
  const [userTab, setUserTab] = useState("patients"); // "patients" | "staff"
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffRoleFilter, setStaffRoleFilter] = useState(""); // for staff: DOCTOR|RECEPTIONIST|ADMIN
  const [activeFilter, setActiveFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: "", email: "", phone: "", password: "", role: "DOCTOR" });
  const [createLoading, setCreateLoading] = useState(false);
  const [detailUser, setDetailUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, page_size: PAGE_SIZE };
    if (userTab === "patients") {
      params.role = "PATIENT";
    } else {
      // Staff tab: if a specific role is selected, pass it; otherwise fetch all and filter client-side
      if (staffRoleFilter) params.role = staffRoleFilter;
    }
    if (activeFilter !== "") params.is_active = activeFilter === "true";
    if (search) params.search = search;
    try {
      const { data } = await adminGetUsers(params);
      const arr = Array.isArray(data) ? data : (data.items ?? data);
      // Client-side filter for "all staff" (no specific role selected)
      const filtered =
        userTab === "staff" && !staffRoleFilter
          ? arr.filter((u) => STAFF_ROLES.includes(u.role))
          : arr;
      setUsers(filtered);
      setHasMore(arr.length === PAGE_SIZE);
    } catch { setUsers([]); setHasMore(false); }
    finally { setLoading(false); }
  }, [userTab, staffRoleFilter, activeFilter, search, page]);

  // Reset to page 1 whenever filters / sub-tab change
  useEffect(() => { setPage(1); }, [userTab, staffRoleFilter, activeFilter, search]);
  useEffect(() => { load(); }, [load]);

  const handleToggle = async (u) => {
    try {
      await adminToggleUser(u.id, !u.is_active);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
      if (detailUser?.id === u.id) setDetailUser((d) => ({ ...d, is_active: !d.is_active }));
      toast(`Tài khoản đã ${!u.is_active ? "kích hoạt" : "vô hiệu hóa"}`, "success");
    } catch (e) { toast(e.response?.data?.detail || "Thao tác thất bại", "error"); }
  };

  const handleCreate = async () => {
    if (!createForm.full_name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      toast("Họ tên, email và mật khẩu là bắt buộc", "error"); return;
    }
    setCreateLoading(true);
    try {
      const { data } = await adminCreateUser({ ...createForm, phone: createForm.phone || undefined });
      setUsers((prev) => [data, ...prev]);
      toast("Tạo tài khoản thành công!", "success");
      setCreateOpen(false);
      setCreateForm({ full_name: "", email: "", phone: "", password: "", role: "DOCTOR" });
    } catch (e) { toast(e.response?.data?.detail || "Tạo thất bại", "error"); }
    finally { setCreateLoading(false); }
  };

  const STAFF_ROLE_TABS = [
    { value: "", label: "Tất cả nhân viên" },
    { value: "DOCTOR", label: "Bác sĩ" },
    { value: "RECEPTIONIST", label: "Lễ tân" },
    { value: "ADMIN", label: "Quản trị viên" },
  ];

  return (
    <div className="admin-dash__tab-content admin-dash__space-y-4">
      {/* Patient / Staff sub-tabs */}
      <div className="admin-dash__user-tabs">
        {["patients", "staff"].map((t) => (
          <button
            key={t}
            onClick={() => setUserTab(t)}
            className={`admin-dash__user-tab${userTab === t ? " admin-dash__user-tab--active" : ""}`}
          >
            {t === "patients" ? "👤 Bệnh nhân" : "🩺 Nhân viên"}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="admin-dash__filter-row">
        <div className="admin-dash__filter-left">
          {userTab === "staff" && (
            <div className="admin-dash__pill-bar glass">
              {STAFF_ROLE_TABS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStaffRoleFilter(f.value)}
                  className={`admin-dash__pill${staffRoleFilter === f.value ? " admin-dash__pill--active" : ""}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <select
            className="input admin-dash__select"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Hoạt động</option>
            <option value="false">Ngừng hoạt động</option>
          </select>
        </div>
        <div className="admin-dash__filter-right">
          <SearchBar value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc email…" />
          {userTab === "staff" && (
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Thêm nhân viên
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? <Skeleton /> : users.length === 0 ? (
        <EmptyState icon="👥" title="Không tìm thấy người dùng" sub="Hãy thử điều chỉnh bộ lọc" />
      ) : (
        <div className="card admin-dash__table-wrap">
          <div className="admin-dash__table-scroll">
            <table className="admin-dash__table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th className="admin-dash__th--narrow">Vai trò</th>
                  <th className="admin-dash__th--narrow admin-dash__th--hide-md">Điện thoại</th>
                  <th className="admin-dash__th--narrow admin-dash__th--hide-sm">Ngày tham gia</th>
                  <th className="admin-dash__th--narrow">Trạng thái</th>
                  <th className="admin-dash__th--narrow">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="admin-dash__td admin-dash__td--first">
                      <button className="admin-dash__user-btn" onClick={() => setDetailUser(u)}>
                        <div className="admin-dash__user-avatar">
                          {u.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="admin-dash__user-name">{u.full_name}</p>
                          <p className="admin-dash__user-email">{u.email}</p>
                        </div>
                      </button>
                    </td>
                    <td className="admin-dash__td">
                      <span className={`admin-dash__role-badge ${ROLE_CLASS[u.role] ?? "admin-dash__role-badge--default"}`}>
                        {u.role?.toLowerCase()}
                      </span>
                    </td>
                    <td className="admin-dash__td admin-dash__td--hide-md">
                      <span className="admin-dash__user-email">{u.phone || "—"}</span>
                    </td>
                    <td className="admin-dash__td admin-dash__td--hide-sm">
                      <span className="admin-dash__user-email">{formatDateTime(u.created_at)}</span>
                    </td>
                    <td className="admin-dash__td">
                      <span className={u.is_active ? "admin-dash__status-active" : "admin-dash__status-inactive"}>
                        {u.is_active ? "● Hoạt động" : "○ Ngừng hoạt động"}
                      </span>
                    </td>
                    <td className="admin-dash__td admin-dash__td--right">
                      <button
                        onClick={() => handleToggle(u)}
                        className={`admin-dash__toggle-btn ${u.is_active ? "admin-dash__toggle-btn--deactivate" : "admin-dash__toggle-btn--activate"}`}
                      >
                        {u.is_active ? "Vô hiệu hóa" : "Kích hoạt"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-dash__table-footer">
            Hiển thị {users.length} người dùng
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="admin-dash__pagination">
        <button
          className="btn-secondary admin-dash__page-btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          ← Trước
        </button>
        <span className="admin-dash__page-label">Trang {page}</span>
        <button
          className="btn-secondary admin-dash__page-btn"
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore}
        >
          Tiếp →
        </button>
      </div>

      {/* User detail modal */}
      <Modal open={!!detailUser} onClose={() => setDetailUser(null)} title="Chi tiết người dùng">
        {detailUser && (
          <div className="admin-dash__modal-detail">
            <div className="admin-dash__user-detail-header">
              <div className="admin-dash__user-avatar admin-dash__user-avatar--lg">
                {detailUser.full_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="admin-dash__user-detail-name">{detailUser.full_name}</p>
                <p className="admin-dash__user-detail-email">{detailUser.email}</p>
              </div>
            </div>
            <div className="divider" />
            <div className="admin-dash__detail-pairs">
              {[
                { label: "ID",           value: `#${detailUser.id}` },
                { label: "Vai trò",      value: detailUser.role?.toLowerCase() },
                { label: "Điện thoại",   value: detailUser.phone || "—" },
                { label: "Trạng thái",   value: detailUser.is_active ? "Hoạt động" : "Ngừng hoạt động",
                  valMod: detailUser.is_active ? "admin-dash__detail-pair-val--green" : "admin-dash__detail-pair-val--red" },
                { label: "Ngày tham gia", value: formatDateTime(detailUser.created_at) },
                { label: "Cập nhật",     value: formatDateTime(detailUser.updated_at) },
              ].map(({ label, value, valMod }) => (
                <div key={label}>
                  <p className="admin-dash__detail-pair-key">{label}</p>
                  <p className={`admin-dash__detail-pair-val${valMod ? ` ${valMod}` : ""}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="admin-dash__modal-actions">
              <Button variant="secondary" className="admin-dash__modal-btn" onClick={() => setDetailUser(null)}>Đóng</Button>
              <Button
                variant={detailUser.is_active ? "danger" : "primary"}
                className="admin-dash__modal-btn"
                onClick={() => { handleToggle(detailUser); setDetailUser(null); }}
              >
                {detailUser.is_active ? "Vô hiệu hóa tài khoản" : "Kích hoạt tài khoản"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create staff modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm bác sĩ / Lễ tân">
        <div className="admin-dash__space-y-4">
          <div>
            <label className="label">Vai trò</label>
            <div className="admin-dash__role-picker">
              {["DOCTOR", "RECEPTIONIST"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setCreateForm((f) => ({ ...f, role: r }))}
                  className={`admin-dash__role-btn ${createForm.role === r ? "admin-dash__role-btn--active" : "admin-dash__role-btn--inactive glass"}`}
                >
                  {r === "DOCTOR" ? "🩺 Bác sĩ" : "🏥 Lễ tân"}
                </button>
              ))}
            </div>
          </div>
          {[
            { name: "full_name", label: "Họ và tên",                placeholder: "BS. Nguyễn Văn A" },
            { name: "email",     label: "Email",                    placeholder: "doctor@clinic.com", type: "email" },
            { name: "phone",     label: "Điện thoại (không bắt buộc)", placeholder: "0901 234 567",   type: "tel" },
            { name: "password",  label: "Mật khẩu",                placeholder: "Tối thiểu 8 ký tự, 1 chữ hoa, 1 số", type: "password" },
          ].map(({ name, label, placeholder, type = "text" }) => (
            <div key={name}>
              <label className="label">{label}</label>
              <input
                className="input"
                type={type}
                placeholder={placeholder}
                value={createForm[name]}
                onChange={(e) => setCreateForm((f) => ({ ...f, [name]: e.target.value }))}
              />
            </div>
          ))}
          <div className="admin-dash__modal-actions">
            <Button variant="secondary" className="admin-dash__modal-btn" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button loading={createLoading} className="admin-dash__modal-btn" onClick={handleCreate}>Tạo tài khoản</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APPOINTMENTS TAB
// ══════════════════════════════════════════════════════════════════════════════
function AppointmentsTab({ toast }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;
  const [selected, setSelected] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, page_size: PAGE_SIZE };
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;
    try {
      const { data } = await adminGetAppointments(params);
      const arr = Array.isArray(data) ? data : (data.items ?? data);
      setAppointments(arr);
      setHasMore(arr.length === PAGE_SIZE);
    } catch { setAppointments([]); setHasMore(false); }
    finally { setLoading(false); }
  }, [statusFilter, search, page]);

  useEffect(() => { setPage(1); }, [statusFilter, search]);
  useEffect(() => { load(); }, [load]);

  const openDetail = (appt) => {
    setSelected(appt);
    setNewStatus(appt.status);
    setNotes(appt.notes || "");
  };

  const handleUpdate = async () => {
    setUpdateLoading(true);
    try {
      const { data } = await adminUpdateAppointment(selected.id, { status: newStatus, notes: notes || undefined });
      setAppointments((prev) => prev.map((a) => a.id === selected.id ? data : a));
      toast("Đã cập nhật lịch hẹn", "success");
      setSelected(null);
    } catch (e) { toast(e.response?.data?.detail || "Cập nhật thất bại", "error"); }
    finally { setUpdateLoading(false); }
  };

  return (
    <div className="admin-dash__tab-content admin-dash__space-y-4">
      {/* Controls */}
      <div className="admin-dash__filter-row">
        <div className="admin-dash__status-filter glass">
          {[{ value: "", label: "Tất cả" }, ...APPT_STATUSES.map((s) => ({ value: s, label: { PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", ARRIVED: "Đã đến", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RESCHEDULED: "Đã đổi lịch", NOSHOW: "Vắng mặt" }[s] || s }))].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`admin-dash__pill${statusFilter === f.value ? " admin-dash__pill--active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Tìm theo tên bệnh nhân…" />
      </div>

      {/* Table */}
      {loading ? <Skeleton /> : appointments.length === 0 ? (
        <EmptyState icon="📅" title="Không tìm thấy lịch hẹn" sub="Hãy thử thay đổi bộ lọc" />
      ) : (
        <div className="card admin-dash__table-wrap">
          <div className="admin-dash__table-scroll">
            <table className="admin-dash__table">
              <thead>
                <tr>
                  <th>Bệnh nhân</th>
                  <th className="admin-dash__th--narrow">Bác sĩ</th>
                  <th className="admin-dash__th--narrow admin-dash__th--hide-md">Lịch hẹn</th>
                  <th className="admin-dash__th--narrow">Trạng thái</th>
                  <th className="admin-dash__th--narrow admin-dash__th--hide-lg">Lý do</th>
                  <th className="admin-dash__th--narrow">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td className="admin-dash__td admin-dash__td--first">
                      <p className="admin-dash__user-name">{a.patient?.full_name}</p>
                    </td>
                    <td className="admin-dash__td">
                      <p className="admin-dash__stat-label">{a.doctor?.user?.full_name}</p>
                      {a.doctor?.specialty && (
                        <p className="admin-dash__appt-doctor-specialty">{a.doctor.specialty.name}</p>
                      )}
                    </td>
                    <td className="admin-dash__td admin-dash__td--hide-md">
                      <p className="admin-dash__appt-time">{formatDateTime(a.scheduled_at)}</p>
                      <p className="admin-dash__appt-relative">{relativeTime(a.scheduled_at)}</p>
                    </td>
                    <td className="admin-dash__td"><Badge status={a.status} /></td>
                    <td className="admin-dash__td admin-dash__td--hide-lg">
                      <span className="admin-dash__appt-reason">{a.reason || "—"}</span>
                    </td>
                    <td className="admin-dash__td admin-dash__td--right">
                      <button className="admin-dash__manage-btn" onClick={() => openDetail(a)}>Quản lý</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-dash__table-footer">
            Hiển thị {appointments.length} lịch hẹn · Trang {page}
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="admin-dash__pagination">
        <button
          className="btn-secondary admin-dash__page-btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          ← Trước
        </button>
        <span className="admin-dash__page-label">Trang {page}</span>
        <button
          className="btn-secondary admin-dash__page-btn"
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore}
        >
          Tiếp →
        </button>
      </div>

      {/* Appointment detail / edit modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Quản lý lịch hẹn" size="lg">
        {selected && (
          <div className="admin-dash__modal-detail">
            <div className="admin-dash__detail-grid">
              <div className="card admin-dash__detail-card">
                <p className="admin-dash__detail-label">Bệnh nhân</p>
                <p className="admin-dash__detail-value">{selected.patient?.full_name}</p>
              </div>
              <div className="card admin-dash__detail-card">
                <p className="admin-dash__detail-label">Bác sĩ</p>
                <p className="admin-dash__detail-value">{selected.doctor?.user?.full_name}</p>
                {selected.doctor?.specialty && (
                  <p className="admin-dash__detail-specialty">{selected.doctor.specialty.name}</p>
                )}
              </div>
              <div className="card admin-dash__detail-card">
                <p className="admin-dash__detail-label">Lịch hẹn</p>
                <p className="admin-dash__detail-value">{formatDateTime(selected.scheduled_at)}</p>
              </div>
              <div className="card admin-dash__detail-card">
                <p className="admin-dash__detail-label">Trạng thái hiện tại</p>
                <Badge status={selected.status} />
              </div>
            </div>

            {selected.reason && (
              <div>
                <p className="label">Lý do</p>
                <p className="admin-dash__reason-block">{selected.reason}</p>
              </div>
            )}

            {selected.cancellation_reason && (
              <div>
                <p className="label">Lý do hủy</p>
                <p className="admin-dash__cancel-reason-block">{selected.cancellation_reason}</p>
              </div>
            )}

            {(selected.reschedule_count > 0 || selected.deposit_paid || selected.reschedule_fee_applied) && (
              <div className="admin-dash__flags">
                {selected.deposit_paid && (
                  <span className="admin-dash__flag admin-dash__flag--green">Đã đặt cọc</span>
                )}
                {selected.reschedule_count > 0 && (
                  <span className="admin-dash__flag admin-dash__flag--blue">Đã đổi lịch ×{selected.reschedule_count}</span>
                )}
                {selected.reschedule_fee_applied && (
                  <span className="admin-dash__flag admin-dash__flag--amber">Đã tính phí đổi lịch</span>
                )}
              </div>
            )}

            <div className="divider" />

            <div>
              <label className="label">Cập nhật trạng thái</label>
              <div className="admin-dash__status-picker">
                {APPT_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewStatus(s)}
                    className={`admin-dash__status-btn ${newStatus === s ? "admin-dash__status-btn--active" : "admin-dash__status-btn--inactive glass"}`}
                  >
                    {{ PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", ARRIVED: "Đã đến", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RESCHEDULED: "Đã đổi lịch", NOSHOW: "Vắng mặt" }[s] || s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Ghi chú (không bắt buộc)</label>
              <textarea
                className="input"
                style={{ resize: "none" }}
                rows={3}
                placeholder="Thêm ghi chú lâm sàng…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="admin-dash__modal-actions">
              <Button variant="secondary" className="admin-dash__modal-btn" onClick={() => setSelected(null)}>Hủy</Button>
              <Button
                loading={updateLoading}
                className="admin-dash__modal-btn"
                onClick={handleUpdate}
                disabled={newStatus === selected.status && notes === (selected.notes || "")}
              >
                Lưu thay đổi
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCTORS TAB
// ══════════════════════════════════════════════════════════════════════════════
function DoctorsTab({ toast }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [specialties, setSpecialties] = useState([]);
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;
  const [editDoctor, setEditDoctor] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    getSpecialties().then(({ data }) => setSpecialties(data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, page_size: PAGE_SIZE };
    if (specialtyFilter) params.specialty_id = specialtyFilter;
    try {
      const { data } = await adminGetDoctors(params);
      const arr = Array.isArray(data) ? data : (data.items ?? data);
      setDoctors(arr);
      setHasMore(arr.length === PAGE_SIZE);
    } catch { setDoctors([]); setHasMore(false); }
    finally { setLoading(false); }
  }, [specialtyFilter, page]);

  useEffect(() => { setPage(1); }, [specialtyFilter]);
  useEffect(() => { load(); }, [load]);

  const openEdit = (doc) => {
    setEditDoctor(doc);
    setEditForm({
      bio: doc.bio || "",
      license_number: doc.license_number || "",
      years_experience: doc.years_experience ?? "",
      clinic_address: doc.clinic_address || "",
      consultation_fee: doc.consultation_fee ?? "",
      specialty_id: doc.specialty?.id ?? "",
    });
  };

  const handleEdit = async () => {
    setEditLoading(true);
    try {
      const payload = { ...editForm };
      if (payload.years_experience === "") payload.years_experience = null;
      if (payload.consultation_fee === "") payload.consultation_fee = null;
      if (payload.specialty_id === "") payload.specialty_id = null;
      const { data } = await adminUpdateDoctor(editDoctor.id, payload);
      setDoctors((prev) => prev.map((d) => d.id === editDoctor.id ? data : d));
      toast("Cập nhật hồ sơ bác sĩ!", "success");
      setEditDoctor(null);
    } catch (e) { toast(e.response?.data?.detail || "Cập nhật thất bại", "error"); }
    finally { setEditLoading(false); }
  };

  return (
    <div className="admin-dash__tab-content admin-dash__space-y-4">
      {/* Filter */}
      <div className="admin-dash__filter-row">
        <select
          className="input admin-dash__select--lg"
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
        >
          <option value="">Tất cả chuyên khoa</option>
          {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <p className="admin-dash__filter-count">{doctors.length} bác sĩ · Trang {page}</p>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="admin-dash__doctors-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton admin-dash__skeleton-item" />
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <EmptyState icon="🩺" title="Không tìm thấy bác sĩ" />
      ) : (
        <div className="admin-dash__doctors-grid">
          {doctors.map((doc) => (
            <div key={doc.id} className="card admin-dash__doctor-card card-hover">
              <div className="admin-dash__doctor-header">
                <div className="admin-dash__doctor-avatar">
                  {doc.user?.full_name?.[0]?.toUpperCase()}
                </div>
                <div className="admin-dash__doctor-info">
                  <p className="admin-dash__doctor-name">{doc.user?.full_name}</p>
                  {doc.specialty && <p className="admin-dash__doctor-specialty">{doc.specialty.name}</p>}
                </div>
                {doc.avg_rating && (
                  <span className="admin-dash__doctor-rating">★ {Number(doc.avg_rating).toFixed(1)}</span>
                )}
              </div>
              <div className="admin-dash__doctor-stats">
                <div className="admin-dash__doctor-stat">
                  <p className="admin-dash__doctor-stat-key">Kinh nghiệm</p>
                  <p className="admin-dash__doctor-stat-val">
                    {doc.years_experience != null ? `${doc.years_experience} năm` : "—"}
                  </p>
                </div>
                <div className="admin-dash__doctor-stat">
                  <p className="admin-dash__doctor-stat-key">Phí khám</p>
                  <p className="admin-dash__doctor-stat-val">
                    {doc.consultation_fee != null ? `${Number(doc.consultation_fee).toLocaleString("vi-VN")} ₫` : "—"}
                  </p>
                </div>
              </div>
              {doc.bio && <p className="admin-dash__doctor-bio">{doc.bio}</p>}
              <button className="btn-ghost admin-dash__doctor-edit-btn" onClick={() => openEdit(doc)}>
                Sửa hồ sơ
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="admin-dash__pagination">
        <button
          className="btn-secondary admin-dash__page-btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          ← Trước
        </button>
        <span className="admin-dash__page-label">Trang {page}</span>
        <button
          className="btn-secondary admin-dash__page-btn"
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore}
        >
          Tiếp →
        </button>
      </div>

      {/* Edit doctor modal */}
      <Modal open={!!editDoctor} onClose={() => setEditDoctor(null)} title={`Edit — ${editDoctor?.user?.full_name}`} size="lg">
        {editDoctor && (
          <div className="admin-dash__space-y-4">
            <div className="admin-dash__edit-grid">
              <div>
                <label className="label">Chuyên khoa</label>
                <select
                  className="input"
                  value={editForm.specialty_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, specialty_id: e.target.value }))}
                >
                  <option value="">— Không —</option>
                  {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Số giấy phép</label>
                <input
                  className="input"
                  placeholder="LIC-0001"
                  value={editForm.license_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, license_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Số năm kinh nghiệm</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={60}
                  placeholder="0"
                  value={editForm.years_experience}
                  onChange={(e) => setEditForm((f) => ({ ...f, years_experience: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Consultation fee (₫)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="1000"
                  placeholder="500000"
                  value={editForm.consultation_fee}
                  onChange={(e) => setEditForm((f) => ({ ...f, consultation_fee: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label">Địa chỉ phòng khám</label>
              <input
                className="input"
                placeholder="123 Medical Center Drive"
                value={editForm.clinic_address}
                onChange={(e) => setEditForm((f) => ({ ...f, clinic_address: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Tiểu sử</label>
              <textarea
                className="input"
                style={{ resize: "none" }}
                rows={4}
                placeholder="Tiểu sử bác sĩ…"
                value={editForm.bio}
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>
            <div className="admin-dash__modal-actions">
              <Button variant="secondary" className="admin-dash__modal-btn" onClick={() => setEditDoctor(null)}>Hủy</Button>
              <Button loading={editLoading} className="admin-dash__modal-btn" onClick={handleEdit}>Lưu thay đổi</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SPECIALTIES TAB
// ══════════════════════════════════════════════════════════════════════════════
function SpecialtiesTab({ toast }) {
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", icon: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSpecialties().then(({ data }) => setSpecialties(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(specialties.length / PAGE_SIZE));
  const pagedSpecialties = specialties.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast("Tên là bắt buộc", "error"); return; }
    setSaving(true);
    try {
      const { data } = await createSpecialty(form);
      setSpecialties((prev) => [...prev, data]);
      toast("Đã tạo chuyên khoa!", "success");
      setCreateOpen(false);
      setForm({ name: "", description: "", icon: "" });
    } catch (e) { toast(e.response?.data?.detail || "Failed", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xóa chuyên khoa này? Các bác sĩ thuộc chuyên khoa sẽ bị xóa liên kết.")) return;
    try {
      await deleteSpecialty(id);
      setSpecialties((prev) => prev.filter((s) => s.id !== id));
      toast("Đã xóa chuyên khoa", "info");
    } catch (e) { toast(e.response?.data?.detail || "Failed", "error"); }
  };

  return (
    <div className="admin-dash__tab-content admin-dash__space-y-4">
      <div className="admin-dash__actions-row">
        <Button onClick={() => setCreateOpen(true)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Thêm chuyên khoa
        </Button>
      </div>

      {loading ? (
        <div className="admin-dash__specialties-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton admin-dash__skeleton-item" />
          ))}
        </div>
      ) : specialties.length === 0 ? (
        <EmptyState icon="🏥" title="Chưa có chuyên khoa" sub="Thêm chuyên khoa y tế đầu tiên" />
      ) : (
        <div className="admin-dash__specialties-grid">
          {pagedSpecialties.map((sp) => (
            <div key={sp.id} className="card admin-dash__specialty-card card-hover">
              <div className="admin-dash__specialty-inner">
                {sp.icon && <span className="admin-dash__specialty-icon">{sp.icon}</span>}
                <div>
                  <p className="admin-dash__specialty-name">{sp.name}</p>
                  {sp.description && <p className="admin-dash__specialty-desc">{sp.description}</p>}
                </div>
              </div>
              <button className="admin-dash__specialty-delete" onClick={() => handleDelete(sp.id)}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {specialties.length > PAGE_SIZE && (
        <div className="admin-dash__pagination">
          <button
            className="btn-secondary admin-dash__page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Trước
          </button>
          <span className="admin-dash__page-label">Trang {page} / {totalPages}</span>
          <button
            className="btn-secondary admin-dash__page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Tiếp →
          </button>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm chuyên khoa">
        <div className="admin-dash__space-y-4">
          <div>
            <label className="label">Tên *</label>
            <input
              className="input"
              placeholder="VD: Tim mạch"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">
              Mô tả <span className="admin-dash__user-email">(không bắt buộc)</span>
            </label>
            <textarea
              className="input"
              style={{ resize: "none" }}
              rows={3}
              placeholder="Mô tả ngắn gọn…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">
              Biểu tượng emoji <span className="admin-dash__user-email">(không bắt buộc)</span>
            </label>
            <input
              className="input"
              placeholder="e.g. 🫀"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            />
          </div>
          <div className="admin-dash__modal-actions">
            <Button variant="secondary" className="admin-dash__modal-btn" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button loading={saving} className="admin-dash__modal-btn" onClick={handleCreate}>Tạo</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (user?.role === "admin") {
      adminGetStats().then(({ data }) => setStats(data)).catch(() => {});
    }
  }, [user]);

  if (authLoading) return null;
  if (!user || user.role !== "admin") return <Navigate to="/login" replace />;

  return (
    <div className="admin-dash animate-fade-in">
      {/* Sidebar */}
      <aside className="admin-dash__sidebar">
        <div className="admin-dash__sidebar-brand">
          <span className="admin-dash__sidebar-icon">⚕</span>
          <span className="admin-dash__sidebar-title">Quản trị</span>
        </div>
        <nav className="admin-dash__sidebar-nav">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`admin-dash__sidebar-item${tab === t.key ? " admin-dash__sidebar-item--active" : ""}`}
            >
              <span className="admin-dash__sidebar-item-icon">{t.icon}</span>
              <span className="admin-dash__sidebar-item-label">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-dash__sidebar-footer">
          <p className="admin-dash__sidebar-footer-text">Phân tích nền tảng</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-dash__main">
        <div className="admin-dash__main-header">
          <h1 className="admin-dash__title">{TABS.find((t) => t.key === tab)?.label ?? "Tổng quan"}</h1>
          <p className="admin-dash__subtitle">Quản lý &amp; phân tích nền tảng</p>
        </div>
        {tab === "overview"     && <OverviewTab stats={stats} />}
        {tab === "users"        && <UsersTab toast={toast} />}
        {tab === "appointments" && <AppointmentsTab toast={toast} />}
        {tab === "doctors"      && <DoctorsTab toast={toast} />}
        {tab === "specialties"  && <SpecialtiesTab toast={toast} />}
      </main>
    </div>
  );
}
