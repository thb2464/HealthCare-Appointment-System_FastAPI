import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import RegisterForm from "../../../components/forms/RegisterForm/RegisterForm";
import "./RegisterPage.css";

export default function RegisterPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const dest = { patient: "/dashboard", doctor: "/doctor/dashboard", admin: "/admin" };
    return <Navigate to={dest[user.role?.toLowerCase()] || "/"} replace />;
  }

  return (
    <div className="register-page">
      <div className="register-page__inner">
        <div className="register-page__header animate-fade-in">
          <div className="register-page__icon-wrap">
            <svg className="register-page__icon" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" fillOpacity="0.15" />
              <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="register-page__title">Tạo tài khoản</h1>
          <p className="register-page__subtitle">Tham gia MediCare — hoàn toàn miễn phí</p>
        </div>

        <div className="card register-page__card animate-slide-up">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
