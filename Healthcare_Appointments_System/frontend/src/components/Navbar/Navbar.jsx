import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./Navbar.css";

const MedIcon = () => (
  <svg className="navbar__logo-icon" viewBox="0 0 32 32" fill="none">
    <rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" fillOpacity="0.15" />
    <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

function NavLink({ to, label, active }) {
  return (
    <Link to={to} className={`nav-link ${active ? "nav-link-active" : ""}`}>
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { user, logoutUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutUser();
    navigate("/");
    setMenuOpen(false);
  };

  const patientLinks = [
    { to: "/search", label: "Find Doctors" },
    { to: "/dashboard", label: "My Appointments" },
  ];

  const doctorLinks = [
    { to: "/doctor/dashboard", label: "Dashboard" },
    { to: "/doctor/availability", label: "Availability" },
  ];

  const adminLinks = [
    { to: "/admin", label: "Admin Panel" },
  ];

  const role = user?.role?.toLowerCase();
  const links =
    role === "patient"
      ? patientLinks
      : role === "doctor"
      ? doctorLinks
      : role === "admin"
      ? adminLinks
      : [];

  const initials = user?.full_name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <nav className="navbar">
      <div className="navbar__container">
        <div className="navbar__row">

          {/* Logo */}
          <Link to="/" className="navbar__logo">
            <MedIcon />
            <span className="navbar__logo-text">MediCare</span>
          </Link>

          {/* Desktop nav links */}
          <div className="navbar__desktop-links">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                label={l.label}
                active={location.pathname.startsWith(l.to)}
              />
            ))}
          </div>

          {/* Right side */}
          <div className="navbar__right">
            {user ? (
              <div className="navbar__user-menu">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="navbar__user-btn glass glass-hover"
                >
                  <div className="navbar__avatar">
                    {initials || "?"}
                  </div>
                  <span className="navbar__username">
                    {user.full_name}
                  </span>
                  <svg
                    className={`navbar__chevron${menuOpen ? " navbar__chevron--open" : ""}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="navbar__dropdown card">
                    <div className="navbar__dropdown-header">
                      <p className="navbar__dropdown-role">{user.role}</p>
                      <p className="navbar__dropdown-email">{user.email}</p>
                    </div>

                    {/* Mobile links (hidden on md+) */}
                    <div className="navbar__mobile-links">
                      {links.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to}
                          onClick={() => setMenuOpen(false)}
                          className="navbar__dropdown-link"
                        >
                          {l.label}
                        </Link>
                      ))}
                      <div className="divider" />
                    </div>

                    <div className="navbar__dropdown-actions">
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="navbar__dropdown-link"
                      >
                        My Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="navbar__dropdown-btn"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="navbar__guest-actions">
                <Link to="/login" className="btn-ghost">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary">
                  Get started
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
