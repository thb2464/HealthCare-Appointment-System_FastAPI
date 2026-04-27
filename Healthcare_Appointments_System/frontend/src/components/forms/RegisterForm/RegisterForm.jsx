import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register, login } from "../../../api/authApi";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../ui/Toast/Toast";
import Button from "../../ui/Button/Button";
import "./RegisterForm.css";

export default function RegisterForm() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "PATIENT",
  });
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const handle = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ ...form, phone: form.phone || undefined });
      const { data: tokens } = await login(form.email, form.password);
      loginUser(tokens, null);
      const { getMe } = await import("../../../api/authApi");
      const { data: user } = await getMe();
      loginUser(tokens, user);
      toast("Account created! Welcome, " + user.full_name, "success");
      const destinations = { patient: "/dashboard", doctor: "/doctor/dashboard" };
      navigate(destinations[user.role?.toLowerCase()] || "/");
    } catch (err) {
      toast(err.response?.data?.detail || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="register-form">
      <div className="register-form__field">
        <label className="label">Full name</label>
        <input
          name="full_name"
          required
          className="input"
          placeholder="Jane Smith"
          value={form.full_name}
          onChange={handle}
        />
      </div>

      <div className="register-form__field">
        <label className="label">Email address</label>
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

      <div className="register-form__field">
        <label className="label">
          Phone{" "}
          <span className="register-form__optional">(optional)</span>
        </label>
        <input
          name="phone"
          type="tel"
          className="input"
          placeholder="+1 555 000 0000"
          value={form.phone}
          onChange={handle}
        />
      </div>

      <div className="register-form__field">
        <label className="label">Password</label>
        <div className="register-form__password-wrap">
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="new-password"
            className="input"
            placeholder="Min 8 chars, 1 uppercase, 1 digit"
            value={form.password}
            onChange={handle}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="register-form__eye-btn"
          >
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
        <p className="register-form__hint">
          At least 8 characters, one uppercase letter, one digit
        </p>
      </div>

      {/* Role selector */}
      <div className="register-form__field">
        <label className="label">I am a</label>
        <div className="register-form__role-grid">
          {["patient", "doctor"].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, role: r.toUpperCase() }))}
              className={
                form.role === r.toUpperCase()
                  ? "register-form__role-btn register-form__role-btn--active"
                  : "register-form__role-btn"
              }
            >
              {r === "patient" ? "👤 Patient" : "🩺 Doctor"}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" loading={loading} className="w-full mt-2">
        Create account
      </Button>

      <p className="register-form__footer">
        Already have an account?{" "}
        <Link to="/login">Sign in</Link>
      </p>
    </form>
  );
}
