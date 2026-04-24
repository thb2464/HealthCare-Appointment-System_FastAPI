import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoctor } from "../../api/doctorApi";
import { getDoctorReviews } from "../../api/appointmentApi";
import { useAuth } from "../../hooks/useAuth";

const StarIcon = ({ filled }) => (
  <svg className={`w-4 h-4 ${filled ? "text-amber-400" : "text-slate-700"}`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

function Stars({ rating, size = "md" }) {
  const s = size === "lg" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={`${s} ${n <= Math.round(rating || 0) ? "text-amber-400" : "text-slate-700"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function DoctorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDoctor(id),
      getDoctorReviews(id),
    ])
      .then(([{ data: d }, { data: r }]) => {
        setDoctor(d);
        setReviews(r);
      })
      .catch(() => navigate("/search"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    );
  }

  if (!doctor) return null;
  const { user: docUser, specialty, bio, clinic_address, consultation_fee, avg_rating, years_experience } = doctor;
  const initials = docUser?.full_name?.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-fade-in">
      {/* Hero card */}
      <div className="card p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-navy-700 border border-teal-500/25 flex items-center justify-center text-teal-400 font-bold font-display text-2xl shrink-0">
            {docUser?.avatar_url ? (
              <img src={docUser.avatar_url} alt={docUser.full_name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1">
            <h1 className="font-display font-bold text-3xl text-slate-100">Dr. {docUser?.full_name}</h1>
            {specialty && (
              <span className="inline-block mt-2 text-sm font-medium text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                {specialty.name}
              </span>
            )}
            <div className="flex flex-wrap gap-5 mt-4 text-sm text-slate-400">
              {avg_rating != null && (
                <div className="flex items-center gap-2">
                  <Stars rating={avg_rating} />
                  <span className="text-slate-300 font-medium">{Number(avg_rating).toFixed(1)}</span>
                  <span className="text-slate-500">({reviews.length} reviews)</span>
                </div>
              )}
              {years_experience != null && (
                <span><strong className="text-slate-300">{years_experience}</strong> yrs experience</span>
              )}
            </div>
          </div>
          {consultation_fee != null && (
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Consultation fee</p>
              <p className="font-display font-bold text-3xl text-teal-400">${Number(consultation_fee).toFixed(0)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: info */}
        <div className="md:col-span-2 space-y-5">
          {bio && (
            <div className="card p-6">
              <h2 className="font-display font-semibold text-lg text-slate-100 mb-3">About</h2>
              <p className="text-slate-400 leading-relaxed text-sm">{bio}</p>
            </div>
          )}
          {clinic_address && (
            <div className="card p-5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Clinic address</p>
                <p className="text-sm text-slate-300">{clinic_address}</p>
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="card p-6">
            <h2 className="font-display font-semibold text-lg text-slate-100 mb-4">
              Patient Reviews
              {reviews.length > 0 && <span className="text-slate-500 font-normal text-sm ml-2">({reviews.length})</span>}
            </h2>
            {reviews.length === 0 ? (
              <p className="text-slate-500 text-sm">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="border-b border-white/[0.05] pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-slate-300">{r.patient?.full_name}</span>
                      <Stars rating={r.rating} />
                    </div>
                    {r.comment && <p className="text-sm text-slate-400">{r.comment}</p>}
                    <p className="text-xs text-slate-600 mt-1">
                      {new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: book CTA */}
        <div className="space-y-4">
          <div className="card p-5 sticky top-20">
            <h2 className="font-display font-semibold text-lg text-slate-100 mb-4">Book an appointment</h2>
            {user?.role === "patient" ? (
              <button
                onClick={() => navigate(`/doctors/${id}/book`)}
                className="btn-primary w-full"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book now
              </button>
            ) : !user ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">Sign in to book an appointment</p>
                <button
                  onClick={() => navigate("/login")}
                  className="btn-primary w-full"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Only patients can book appointments.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
