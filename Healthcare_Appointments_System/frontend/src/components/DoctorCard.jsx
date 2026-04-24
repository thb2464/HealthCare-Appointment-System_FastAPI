import React from "react";
import { Link } from "react-router-dom";

const StarIcon = ({ filled }) => (
  <svg className={`w-3.5 h-3.5 ${filled ? "text-amber-400" : "text-slate-600"}`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
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
      className="card card-hover p-5 flex flex-col gap-4 animate-fade-in block group"
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/20 to-navy-700 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold font-display text-lg shrink-0 group-hover:border-teal-500/40 transition-colors">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover rounded-2xl" />
          ) : (
            initials || "?"
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-slate-100 group-hover:text-teal-400 transition-colors truncate">
            {user?.full_name || "Unknown"}
          </h3>
          {specialty && (
            <span className="text-xs font-medium text-teal-400/80 bg-teal-500/10 px-2 py-0.5 rounded-full mt-1 inline-block">
              {specialty.name}
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        {avg_rating != null && (
          <div className="flex items-center gap-2">
            <Stars rating={avg_rating} />
            <span className="text-xs text-slate-400">{Number(avg_rating).toFixed(1)}</span>
          </div>
        )}
        {years_experience != null && (
          <p className="text-xs text-slate-400">
            <span className="text-slate-300 font-medium">{years_experience}</span> yrs experience
          </p>
        )}
        {clinic_address && (
          <p className="text-xs text-slate-500 truncate flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {clinic_address}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
        {consultation_fee != null ? (
          <div>
            <span className="text-lg font-display font-bold text-slate-100">${Number(consultation_fee).toFixed(0)}</span>
            <span className="text-xs text-slate-500 ml-1">/ visit</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Fee not listed</span>
        )}
        <span className="text-xs font-medium text-teal-400 group-hover:text-teal-300 transition-colors flex items-center gap-1">
          Book now
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
