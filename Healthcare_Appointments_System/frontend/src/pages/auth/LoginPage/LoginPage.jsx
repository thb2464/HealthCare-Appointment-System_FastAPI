import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import LoginForm from "../../../components/forms/LoginForm/LoginForm";
import "./LoginPage.css";

export default function LoginPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const dest = { patient: "/dashboard", doctor: "/doctor/dashboard", admin: "/admin" };
    return <Navigate to={dest[user.role?.toLowerCase()] || "/"} replace />;
  }

  return (
    <div className="login-page">
      <div className="login-page__inner">
        {/* Logo / header */}
        <div className="login-page__header animate-fade-in">
          <div className="login-page__icon-wrap">
            <svg className="login-page__icon" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" fillOpacity="0.15" />
              <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="login-page__title">Chào mừng trở lại</h1>
          <p className="login-page__subtitle">Đăng nhập vào tài khoản MediCare của bạn</p>
        </div>

        <div className="card login-page__card animate-slide-up">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
