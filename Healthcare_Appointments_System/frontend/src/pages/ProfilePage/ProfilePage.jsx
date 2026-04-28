import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/ui/Toast/Toast";
import { updateProfile } from "../../api/authApi";
import Button from "../../components/ui/Button/Button";
import "./ProfilePage.css";

export default function ProfilePage() {
  const { user, loading, reload } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const initial = form ?? { full_name: user.full_name, phone: user.phone || "", avatar_url: user.avatar_url || "" };

  const handle = (e) => setForm((f) => ({ ...(f ?? initial), [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        full_name: initial.full_name,
        phone: initial.phone || undefined,
        avatar_url: initial.avatar_url || undefined,
      });
      await reload();
      setForm(null);
      toast("Cập nhật hồ sơ thành công!", "success");
    } catch (err) {
      toast(err.response?.data?.detail || "Cập nhật hồ sơ thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = { patient: "Bệnh nhân", doctor: "Bác sĩ", admin: "Quản trị viên", receptionist: "Lễ tân" };

  return (
    <div className="profile-page animate-fade-in">
      <h1 className="profile-page__title">Hồ sơ của tôi</h1>

      <div className="card profile-page__card">
        {/* Avatar + identity */}
        <div className="profile-page__identity">
          <div className="profile-page__avatar">
            {user.full_name?.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
          </div>
          <div className="profile-page__identity-info">
            <p className="profile-page__name">{user.full_name}</p>
            <p className="profile-page__email">{user.email}</p>
            <span className="profile-page__role-badge">
              {roleLabel[user.role] ?? user.role}
            </span>
          </div>
        </div>

        <div className="divider" />

        {/* Edit form */}
        <form onSubmit={submit} className="profile-page__form">
          <div>
            <label className="label">Họ và tên</label>
            <input
              name="full_name"
              required
              className="input"
              value={initial.full_name}
              onChange={handle}
            />
          </div>
          <div>
            <label className="label">
              Số điện thoại <span className="profile-page__optional">(không bắt buộc)</span>
            </label>
            <input
              name="phone"
              type="tel"
              className="input"
              placeholder="+1 555 000 0000"
              value={initial.phone}
              onChange={handle}
            />
          </div>
          <div>
            <label className="label">
              Ảnh đại diện URL <span className="profile-page__optional">(không bắt buộc)</span>
            </label>
            <input
              name="avatar_url"
              type="url"
              className="input"
              placeholder="https://…"
              value={initial.avatar_url}
              onChange={handle}
            />
          </div>

          <div className="profile-page__actions">
            {form && (
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                Hủy thay đổi
              </Button>
            )}
            <Button type="submit" loading={saving} disabled={!form}>
              Lưu thay đổi
            </Button>
          </div>
        </form>

        <div className="divider" />

        {/* Read-only info */}
        <div className="profile-page__meta-grid">
          <div className="profile-page__meta-item">
            <p className="profile-page__meta-label">Email</p>
            <p className="profile-page__meta-value">{user.email}</p>
          </div>
          <div className="profile-page__meta-item">
            <p className="profile-page__meta-label">Trạng thái tài khoản</p>
            <p className={user.is_active ? "profile-page__status--active" : "profile-page__status--inactive"}>
              {user.is_active ? "Hoạt động" : "Ngừng hoạt động"}
            </p>
          </div>
          <div className="profile-page__meta-item">
            <p className="profile-page__meta-label">Thành viên từ</p>
            <p className="profile-page__meta-value">
              {new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
