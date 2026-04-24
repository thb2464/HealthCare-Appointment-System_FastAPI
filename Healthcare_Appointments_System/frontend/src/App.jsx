import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ToastProvider from "./components/ui/Toast";
import Navbar from "./components/Navbar";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import SearchPage from "./pages/patient/SearchPage";
import DoctorProfilePage from "./pages/patient/DoctorProfilePage";
import BookingPage from "./pages/patient/BookingPage";
import PatientDashboard from "./pages/patient/PatientDashboard";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import AvailabilitySettings from "./pages/doctor/AvailabilitySettings";
import AdminDashboard from "./pages/admin/AdminDashboard";

function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 px-4 text-center animate-fade-in">
      <div className="text-6xl font-display font-black text-slate-800 mb-4">404</div>
      <h1 className="font-display font-bold text-2xl text-slate-300 mb-2">Page not found</h1>
      <p className="text-slate-500 mb-8">This page doesn't exist or has been moved.</p>
      <a href="/" className="btn-primary">← Go home</a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 flex flex-col">
              <Routes>
                {/* Public */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/doctors/:id" element={<DoctorProfilePage />} />

                {/* Patient */}
                <Route path="/doctors/:id/book" element={<BookingPage />} />
                <Route path="/dashboard" element={<PatientDashboard />} />

                {/* Doctor */}
                <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
                <Route path="/doctor/availability" element={<AvailabilitySettings />} />

                {/* Admin */}
                <Route path="/admin" element={<AdminDashboard />} />

                {/* Fallback */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
