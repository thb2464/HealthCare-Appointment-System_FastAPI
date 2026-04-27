import React from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

const features = [
  {
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: "Find Specialists",
    desc: "Browse verified doctors by specialty, location, and availability. Detailed profiles with ratings.",
  },
  {
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: "Instant Booking",
    desc: "See real-time availability and book a slot in seconds. No phone calls, no waiting on hold.",
  },
  {
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
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
  { value: "4.9",   label: "Average rating" },
  { value: "50+",   label: "Specialties" },
];

/* Reusable check-circle icon for trust badges */
function CheckIcon() {
  return (
    <svg className="landing__trust-icon" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="landing">

      {/* ── Hero ── */}
      <section className="landing__hero">
        {/* Decorative glow orbs */}
        <div className="landing__hero-glow-1" />
        <div className="landing__hero-glow-2" />

        <div className="landing__hero-content">
          <div className="landing__hero-body animate-slide-up">

            {/* Eyebrow */}
            <div className="landing__hero-eyebrow glass">
              <span className="landing__hero-dot" />
              <span className="landing__eyebrow-text">Healthcare made simple</span>
            </div>

            <h1 className="landing__hero-title">
              Your health,{" "}
              <span className="text-gradient">expertly managed</span>
            </h1>

            <p className="landing__hero-desc">
              Connect with top healthcare providers, book appointments instantly,
              and manage your entire health journey — all in one place.
            </p>

            <div className="landing__hero-actions">
              <Link to="/register" className="btn-primary">
                Get started free
              </Link>
              <Link to="/search" className="btn-secondary">
                Find a doctor
              </Link>
            </div>

            {/* Trust badges */}
            <div className="landing__trust-badges">
              <span className="landing__trust-item">
                <CheckIcon />
                Board-certified doctors
              </span>
              <span className="landing__trust-item">
                <CheckIcon />
                No subscription required
              </span>
              <span className="landing__trust-item">
                <CheckIcon />
                HIPAA-compliant
              </span>
            </div>
          </div>
        </div>

        {/* Floating stat cards — large desktop only */}
        <div className="landing__stat-cards">
          {stats.map((s, i) => (
            <div
              key={i}
              className="landing__stat-card card animate-slide-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <p className="landing__stat-value">{s.value}</p>
              <p className="landing__stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats row (mobile / tablet) ── */}
      <section className="landing__stats-mobile">
        <div className="landing__stats-grid">
          {stats.map((s, i) => (
            <div key={i}>
              <p className="landing__stat-value">{s.value}</p>
              <p className="landing__stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing__features">
        <div className="landing__features-header">
          <div className="landing__features-title-wrap">
            <h2 className="landing__features-title">
              Everything you need,{" "}
              <span className="text-gradient">nothing you don't</span>
            </h2>
            <p className="landing__features-desc">
              A complete healthcare booking platform designed for both patients and providers.
            </p>
          </div>
        </div>

        <div className="landing__features-grid">
          {features.map((f, i) => (
            <div
              key={i}
              className="landing__feature-card card card-hover animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="landing__feature-icon">
                {f.icon}
              </div>
              <h3 className="landing__feature-title">{f.title}</h3>
              <p className="landing__feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Specialties ── */}
      <section className="landing__specialties">
        <div className="landing__specialties-inner">
          <div className="landing__specialties-header">
            <h2 className="landing__specialties-title">Browse by specialty</h2>
            <Link to="/search" className="landing__specialties-link">
              View all
              <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="landing__specialties-grid">
            {specialties.map((sp, i) => (
              <Link
                key={i}
                to="/search"
                className="landing__specialty-card card card-hover"
              >
                <span className="landing__specialty-icon">{sp.icon}</span>
                <span className="landing__specialty-name">{sp.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing__cta">
        <div className="landing__cta-inner">
          <div className="landing__cta-card card">
            <div className="landing__cta-overlay" />
            <div className="landing__cta-bar" />

            <h2 className="landing__cta-title">
              Ready to take control of your health?
            </h2>
            <p className="landing__cta-desc">
              Join thousands of patients already using MediCare to connect with the right doctors.
            </p>

            <div className="landing__cta-actions">
              <Link to="/register" className="btn-primary">
                Create free account
              </Link>
              <Link to="/search" className="btn-secondary">
                Browse doctors
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <div className="landing__footer-logo">
            <svg viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" fillOpacity="0.15" />
              <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>MediCare</span>
          </div>

          <p className="landing__footer-copy">
            © {new Date().getFullYear()} MediCare. All rights reserved.
          </p>

          <nav className="landing__footer-links">
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
            <Link to="/search">Find doctors</Link>
          </nav>
        </div>
      </footer>

    </div>
  );
}
