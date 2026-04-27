import axiosClient from "./axiosClient";

// ── Users ──────────────────────────────────────────────────────────────────────
export const adminGetUsers = (params = {}) =>
  axiosClient.get("/api/admin/users", { params });

export const adminCreateUser = (data) =>
  axiosClient.post("/api/admin/users", data);

export const adminToggleUser = (userId, is_active) =>
  axiosClient.patch(`/api/admin/users/${userId}`, { is_active });

// ── Appointments ───────────────────────────────────────────────────────────────
export const adminGetAppointments = (params = {}) =>
  axiosClient.get("/api/admin/appointments", { params });

export const adminUpdateAppointment = (id, data) =>
  axiosClient.patch(`/api/admin/appointments/${id}`, data);

// ── Doctors ────────────────────────────────────────────────────────────────────
export const adminGetDoctors = (params = {}) =>
  axiosClient.get("/api/admin/doctors", { params });

export const adminUpdateDoctor = (doctorId, data) =>
  axiosClient.patch(`/api/admin/doctors/${doctorId}`, data);

// ── Stats ──────────────────────────────────────────────────────────────────────
export const adminGetStats = () => axiosClient.get("/api/admin/stats");

// ── Specialties ────────────────────────────────────────────────────────────────
export const createSpecialty = (data) =>
  axiosClient.post("/api/specialties", data);

export const deleteSpecialty = (id) =>
  axiosClient.delete(`/api/specialties/${id}`);
