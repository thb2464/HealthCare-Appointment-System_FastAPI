import React from "react";
import { Link } from "react-router-dom";
import "./DoctorCard.css";

const StarIcon = ({ filled }) => (
  <svg
    className={`doctor-card__star ${filled ? "doctor-card__star--filled" : "doctor-card__star--empty"}`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

function Stars({ rating }) {
  return (
    <div className="doctor-card__stars-icons">
      {[1, 2, 3, 4, 5].map((s) => (
        <StarIcon key={s} filled={s <= Math.round(rating || 0)} />
      ))}
    </div>
  );
}

export default function DoctorCard({ doctor }) {
  const { id, user, specialty, clinic_address, consultation_fee, avg_rating, years_experience } = doctor;

  const initials = user?.full_name
    ?.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <Link
      to={`/doctors/${id}`}
      className="card card-hover animate-fade-in doctor-card"
    >
      {/* Header */}
      <div className="doctor-card__header">
        <div className="doctor-card__avatar">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name} />
          ) : (
            initials || "?"
          )}
        </div>
        <div className="doctor-card__info">
          <h3 className="doctor-card__name">
            {user?.full_name || "Unknown"}
          </h3>
          {specialty && (
            <span className="doctor-card__specialty">
              {specialty.name}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="doctor-card__stats">
        {avg_rating != null && (
          <div className="doctor-card__stars">
            <Stars rating={avg_rating} />
            <span className="doctor-card__rating-value">
              {Number(avg_rating).toFixed(1)}
            </span>
          </div>
        )}
        {years_experience != null && (
          <p className="doctor-card__experience">
            <span className="doctor-card__experience-value">{years_experience}</span> năm kinh nghiệm
          </p>
        )}
        {clinic_address && (
          <p className="doctor-card__address">
            <svg
              className="doctor-card__address-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {clinic_address}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="doctor-card__footer">
        {consultation_fee != null ? (
          <div className="doctor-card__fee">
            <span className="doctor-card__fee-amount">{Number(consultation_fee).toLocaleString("vi-VN")} ₫</span>
            <span className="doctor-card__fee-label">/ lượt khám</span>
          </div>
        ) : (
          <span className="doctor-card__fee--unlisted">Chưa niêm yết phí</span>
        )}
        <span className="doctor-card__cta">
          Đặt lịch
          <svg
            className="doctor-card__cta-icon"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
