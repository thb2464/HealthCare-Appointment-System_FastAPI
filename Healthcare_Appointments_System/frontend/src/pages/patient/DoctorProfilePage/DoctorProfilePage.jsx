import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoctor } from "../../../api/doctorApi";
import { getDoctorReviews } from "../../../api/reviewApi";
import { useAuth } from "../../../hooks/useAuth";
import "./DoctorProfilePage.css";

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

const STAR_PATH =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

function Stars({ rating }) {
  return (
    <span className="doctor-profile__stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`doctor-profile__star ${
            n <= Math.round(rating || 0)
              ? "doctor-profile__star--filled"
              : "doctor-profile__star--empty"
          }`}
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page component                                                       */
/* ------------------------------------------------------------------ */

export default function DoctorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDoctor(id), getDoctorReviews(id)])
      .then(([{ data: d }, { data: r }]) => {
        setDoctor(d);
        setReviews(r);
      })
      .catch(() => navigate("/search"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="doctor-profile__loading">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  if (!doctor) return null;

  const {
    user: docUser,
    specialty,
    bio,
    clinic_address,
    consultation_fee,
    avg_rating,
    years_experience,
  } = doctor;

  const initials = docUser?.full_name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  /* ---- Main render ---- */
  return (
    <div className="doctor-profile animate-fade-in">

      {/* ── Hero card ── */}
      <div className="doctor-profile__header-card card">
        <div className="doctor-profile__header">

          {/* Avatar */}
          <div className="doctor-profile__avatar">
            {docUser?.avatar_url ? (
              <img src={docUser.avatar_url} alt={docUser.full_name} />
            ) : (
              initials
            )}
          </div>

          {/* Name / specialty / meta */}
          <div className="doctor-profile__info">
            <h1 className="doctor-profile__name">Dr. {docUser?.full_name}</h1>

            {specialty && (
              <span className="doctor-profile__specialty-badge">
                {specialty.name}
              </span>
            )}

            <div className="doctor-profile__meta">
              {avg_rating != null && (
                <span className="doctor-profile__meta-item">
                  <Stars rating={avg_rating} />
                  <span className="doctor-profile__rating-value">
                    {Number(avg_rating).toFixed(1)}
                  </span>
                  <span className="doctor-profile__rating-count">
                    ({reviews.length} đánh giá)
                  </span>
                </span>
              )}
              {years_experience != null && (
                <span className="doctor-profile__meta-item">
                  <strong className="doctor-profile__rating-value">
                    {years_experience}
                  </strong>{" "}
                  năm kinh nghiệm
                </span>
              )}
            </div>
          </div>

          {/* Consultation fee */}
          {consultation_fee != null && (
            <div className="doctor-profile__fee">
              <p className="doctor-profile__fee-label">Phí khám</p>
              <p className="doctor-profile__fee-amount">
                {Number(consultation_fee).toLocaleString("vi-VN")} ₫
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Body grid ── */}
      <div className="doctor-profile__body">

        {/* Left: info sections */}
        <div className="doctor-profile__sections">

          {/* Bio */}
          {bio && (
            <div className="doctor-profile__section card">
              <h2 className="doctor-profile__section-title">Giới thiệu</h2>
              <p className="doctor-profile__about">{bio}</p>
            </div>
          )}

          {/* Clinic address */}
          {clinic_address && (
            <div className="doctor-profile__section card doctor-profile__meta-item">
              <div className="doctor-profile__meta-icon">
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="doctor-profile__address-label">Địa chỉ phòng khám</p>
                <p className="doctor-profile__address-text">{clinic_address}</p>
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="doctor-profile__section card">
            <h2 className="doctor-profile__reviews-title">
              Đánh giá từ bệnh nhân
              {reviews.length > 0 && (
                <span className="doctor-profile__reviews-count">
                  ({reviews.length})
                </span>
              )}
            </h2>

            {reviews.length === 0 ? (
              <p className="doctor-profile__no-reviews">Chưa có đánh giá nào.</p>
            ) : (
              <div className="doctor-profile__reviews">
                {reviews.map((r) => (
                  <div key={r.id} className="doctor-profile__review-card">
                    <div className="doctor-profile__review-header">
                      <span className="doctor-profile__review-name">
                        {r.patient?.full_name}
                      </span>
                      <Stars rating={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="doctor-profile__review-text">{r.comment}</p>
                    )}
                    <p className="doctor-profile__review-date">
                      {new Date(r.created_at).toLocaleDateString("vi-VN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: booking sidebar */}
        <div className="doctor-profile__sidebar">
          <div className="doctor-profile__book-btn-card card">
            <h2 className="doctor-profile__book-card-title">
              Đặt lịch khám
            </h2>

            {user?.role === "patient" ? (
              <button
                className="doctor-profile__book-btn btn-primary"
                onClick={() => navigate(`/doctors/${id}/book`)}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Đặt lịch ngay
              </button>
            ) : !user ? (
              <div className="doctor-profile__signin-actions">
                <p className="doctor-profile__signin-hint">
                  Đăng nhập để đặt lịch khám
                </p>
                <button
                  className="doctor-profile__book-btn btn-primary"
                  onClick={() => navigate("/login")}
                >
                  Đăng nhập
                </button>
              </div>
            ) : (
              <p className="doctor-profile__role-hint">
                Chỉ bệnh nhân mới có thể đặt lịch khám.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
