import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const MedIcon = () => (
  <svg className="w-7 h-7 text-teal-400" viewBox="0 0 32 32" fill="none">
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

  const links =
    user?.role === "patient"
      ? patientLinks
      : user?.role === "doctor"
      ? doctorLinks
      : user?.role === "admin"
      ? adminLinks
      : [];

  const initials = user?.full_name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <nav className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-md bg-navy-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <MedIcon />
            <span className="font-display font-bold text-xl text-slate-100 group-hover:text-teal-400 transition-colors">
              MediCare
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
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
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2.5 glass glass-hover px-3 py-1.5 rounded-xl transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-navy-950 text-xs font-bold">
                    {initials || "?"}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-slate-200 max-w-[140px] truncate">
                    {user.full_name}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-52 card animate-slide-down overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{user.role}</p>
                      <p className="text-sm font-medium text-slate-200 truncate mt-0.5">{user.email}</p>
                    </div>

                    {/* Mobile links */}
                    <div className="md:hidden py-1">
                      {links.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to}
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2.5 text-sm text-slate-300 hover:text-teal-400 hover:bg-white/[0.04] transition-colors"
                        >
                          {l.label}
                        </Link>
                      ))}
                      <div className="divider my-1" />
                    </div>

                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost text-sm py-2 px-3">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary text-sm py-2 px-4">
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
