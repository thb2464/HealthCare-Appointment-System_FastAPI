import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoctor } from "../../../api/doctorApi";
import BookingForm from "../../../components/forms/BookingForm/BookingForm";
import { useAuth } from "../../../hooks/useAuth";
import "./BookingPage.css";

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (!authLoading && user?.role !== "patient") {
      navigate("/");
      return;
    }
    getDoctor(id)
      .then(({ data }) => setDoctor(data))
      .catch(() => navigate("/search"))
      .finally(() => setLoading(false));
  }, [id, navigate, user, authLoading]);

  if (loading || authLoading) {
    return (
      <div className="booking-page__loading">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-body" />
      </div>
    );
  }

  if (!doctor) return null;

  return (
    <div className="booking-page animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="booking-page__back-btn btn-ghost"
      >
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Quay lại
      </button>

      <div className="booking-page__header">
        <h1 className="booking-page__title">Đặt lịch khám</h1>
        <p className="booking-page__subtitle">Chọn thời gian phù hợp với bạn</p>
      </div>

      <div className="booking-page__card card">
        <BookingForm doctor={doctor} />
      </div>
    </div>
  );
}
