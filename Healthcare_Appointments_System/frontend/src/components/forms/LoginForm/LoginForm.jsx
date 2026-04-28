import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../../../api/authApi";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../ui/Toast/Toast";
import Button from "../../ui/Button/Button";
import "./LoginForm.css";

export default function LoginForm() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: tokens } = await login(form.email, form.password);
      loginUser(tokens, null);
      const { getMe } = await import("../../../api/authApi");
      const { data: user } = await getMe();
      loginUser(tokens, user);
      toast("Chào mừng trở lại, " + user.full_name + "!", "success");
      const destinations = { patient: "/dashboard", doctor: "/doctor/dashboard", admin: "/admin" };
      navigate(destinations[user.role?.toLowerCase()] || "/");
    } catch (err) {
      toast(err.response?.data?.detail || "Đăng nhập thất bại", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="login-form">
      <div className="login-form__field">
        <label className="label">Địa chỉ email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="you@example.com"
          value={form.email}
          onChange={handle}
        />
      </div>

      <div className="login-form__field">
        <label className="label">Mật khẩu</label>
        <div className="login-form__password-wrap">
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            className="input"
            placeholder="••••••••"
            value={form.password}
            onChange={handle}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="login-form__eye-btn"
          >
            {show ? (
              <svg className="login-form__eye-icon" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="login-form__eye-icon" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <Button type="submit" loading={loading} className="w-full">
        Đăng nhập
      </Button>

      <p className="login-form__footer">
        Chưa có tài khoản?{" "}
        <Link to="/register">Tạo tài khoản</Link>
      </p>
    </form>
  );
}
