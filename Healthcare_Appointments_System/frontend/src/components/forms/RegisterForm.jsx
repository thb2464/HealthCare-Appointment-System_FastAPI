import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register, login } from "../../api/authApi";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../ui/Toast";
import Button from "../ui/Button";

export default function RegisterForm() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "patient",
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
      const { getMe } = await import("../../api/authApi");
      const { data: user } = await getMe();
      loginUser(tokens, user);
      toast("Account created! Welcome, " + user.full_name, "success");
      const destinations = { patient: "/dashboard", doctor: "/doctor/dashboard" };
      navigate(destinations[user.role] || "/");
    } catch (err) {
      toast(err.response?.data?.detail || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
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
      <div>
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
      <div>
        <label className="label">Phone <span className="text-slate-600">(optional)</span></label>
        <input
          name="phone"
          type="tel"
          className="input"
          placeholder="+1 555 000 0000"
          value={form.phone}
          onChange={handle}
        />
      </div>
      <div>
        <label className="label">Password</label>
        <div className="relative">
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="new-password"
            className="input pr-10"
            placeholder="Min 8 chars, 1 uppercase, 1 digit"
            value={form.password}
            onChange={handle}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1.5">At least 8 characters, one uppercase letter, one digit</p>
      </div>

      {/* Role selector */}
      <div>
        <label className="label">I am a</label>
        <div className="grid grid-cols-2 gap-3">
          {["patient", "doctor"].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, role: r }))}
              className={`py-3 px-4 rounded-xl border text-sm font-medium capitalize transition-all ${
                form.role === r
                  ? "bg-teal-500/15 border-teal-500/50 text-teal-400"
                  : "glass glass-hover text-slate-400 border-white/[0.06]"
              }`}
            >
              {r === "patient" ? "👤 Patient" : "🩺 Doctor"}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" loading={loading} className="w-full mt-2">
        Create account
      </Button>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="text-teal-400 hover:text-teal-300 font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
}
