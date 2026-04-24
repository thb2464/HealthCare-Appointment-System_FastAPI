import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoctor } from "../../api/doctorApi";
import BookingForm from "../../components/forms/BookingForm";
import { useAuth } from "../../hooks/useAuth";

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
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4">
        <div className="skeleton h-12 w-48 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!doctor) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="btn-ghost flex items-center gap-2 mb-6 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl text-slate-100">Book Appointment</h1>
        <p className="text-slate-400 text-sm mt-1">Select a time that works for you</p>
      </div>

      <div className="card p-7">
        <BookingForm doctor={doctor} />
      </div>
    </div>
  );
}
