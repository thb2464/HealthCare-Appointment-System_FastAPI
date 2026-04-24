import React from "react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: "Find Specialists",
    desc: "Browse verified doctors by specialty, location, and availability. Detailed profiles with ratings.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: "Instant Booking",
    desc: "See real-time availability and book a slot in seconds. No phone calls, no waiting on hold.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: "Manage Everything",
    desc: "Reschedule, cancel, leave reviews, and track your full appointment history from one dashboard.",
  },
];

const specialties = [
  { icon: "🫀", name: "Cardiology" },
  { icon: "🧠", name: "Neurology" },
  { icon: "🦷", name: "Dentistry" },
  { icon: "👁️", name: "Ophthalmology" },
  { icon: "🦴", name: "Orthopedics" },
  { icon: "🧬", name: "Dermatology" },
  { icon: "👶", name: "Pediatrics" },
  { icon: "🩺", name: "General Practice" },
];

const stats = [
  { value: "2,400+", label: "Verified doctors" },
  { value: "180k+", label: "Appointments booked" },
  { value: "4.9", label: "Average rating" },
  { value: "50+", label: "Specialties" },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-teal-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-24">
          <div className="max-w-3xl animate-slide-up">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-8 text-sm">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-teal-400 font-medium">Healthcare made simple</span>
            </div>

            <h1 className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.05] text-slate-100 mb-6">
              Your health,{" "}
              <span className="text-gradient">expertly managed</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-xl mb-10 leading-relaxed">
              Connect with top healthcare providers, book appointments instantly,
              and manage your entire health journey — all in one place.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/register" className="btn-primary text-base px-7 py-3.5">
                Get started free
              </Link>
              <Link to="/search" className="btn-secondary text-base px-7 py-3.5">
                Find a doctor
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-6 mt-12 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Board-certified doctors
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                No subscription required
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                HIPAA-compliant
              </span>
            </div>
          </div>
        </div>

        {/* Floating stat cards — desktop only */}
        <div className="hidden xl:flex absolute right-16 top-1/2 -translate-y-1/2 flex-col gap-4">
          {stats.map((s, i) => (
            <div
              key={i}
              className="card px-5 py-4 text-right animate-slide-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <p className="font-display font-bold text-2xl text-teal-400">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats row (mobile) ── */}
      <section className="xl:hidden border-y border-white/[0.06] bg-navy-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {stats.map((s, i) => (
              <div key={i}>
                <p className="font-display font-bold text-3xl text-teal-400">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display font-bold text-4xl text-slate-100 mb-4">
              Everything you need,{" "}
              <span className="text-gradient">nothing you don't</span>
            </h2>
            <p className="text-slate-400 text-lg">
              A complete healthcare booking platform designed for both patients and providers.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="card card-hover p-7 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-5">
                  {f.icon}
                </div>
                <h3 className="font-display font-semibold text-lg text-slate-100 mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Specialties ── */}
      <section className="py-20 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <h2 className="font-display font-bold text-3xl text-slate-100">Browse by specialty</h2>
            <Link to="/search" className="text-teal-400 hover:text-teal-300 text-sm font-medium flex items-center gap-1">
              View all
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {specialties.map((sp, i) => (
              <Link
                key={i}
                to={`/search`}
                className="card card-hover flex flex-col items-center gap-2 py-5 text-center group"
              >
                <span className="text-2xl">{sp.icon}</span>
                <span className="text-xs font-medium text-slate-400 group-hover:text-teal-400 transition-colors leading-tight">
                  {sp.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="relative card p-12 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
            <h2 className="font-display font-bold text-4xl text-slate-100 mb-4 relative">
              Ready to take control of your health?
            </h2>
            <p className="text-slate-400 text-lg mb-8 relative">
              Join thousands of patients already using MediCare to connect with the right doctors.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center relative">
              <Link to="/register" className="btn-primary text-base px-8 py-3.5">
                Create free account
              </Link>
              <Link to="/search" className="btn-secondary text-base px-8 py-3.5">
                Browse doctors
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <svg className="w-6 h-6 text-teal-400" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" fillOpacity="0.15" />
              <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="font-display font-bold text-slate-300">MediCare</span>
          </div>
          <p className="text-sm text-slate-600">© {new Date().getFullYear()} MediCare. All rights reserved.</p>
          <div className="flex items-center gap-5 text-sm text-slate-500">
            <Link to="/login" className="hover:text-teal-400 transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-teal-400 transition-colors">Register</Link>
            <Link to="/search" className="hover:text-teal-400 transition-colors">Find doctors</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
