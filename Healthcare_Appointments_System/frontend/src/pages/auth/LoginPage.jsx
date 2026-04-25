import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import LoginForm from "../../components/forms/LoginForm";

export default function LoginPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const dest = { patient: "/dashboard", doctor: "/doctor/dashboard", admin: "/admin" };
    return <Navigate to={dest[user.role?.toLowerCase()] || "/"} replace />;
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 mb-5">
            <svg className="w-7 h-7 text-teal-400" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" fillOpacity="0.15" />
              <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-2xl text-slate-100">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your MediCare account</p>
        </div>

        <div className="card p-8 animate-slide-up">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
