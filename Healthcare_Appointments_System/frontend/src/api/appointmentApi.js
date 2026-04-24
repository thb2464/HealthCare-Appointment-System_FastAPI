import axiosClient from "./axiosClient";

/** POST /api/appointments */
export const bookAppointment = (data) =>
  axiosClient.post("/api/appointments", data);

/** GET /api/appointments */
export const getAppointments = (params = {}) =>
  axiosClient.get("/api/appointments", { params });

/** GET /api/appointments/:id */
export const getAppointment = (id) =>
  axiosClient.get(`/api/appointments/${id}`);

/** PATCH /api/appointments/:id  (status update) */
export const updateAppointment = (id, data) =>
  axiosClient.patch(`/api/appointments/${id}`, data);

/** PATCH /api/appointments/:id/reschedule */
export const rescheduleAppointment = (id, scheduledAt) =>
  axiosClient.patch(`/api/appointments/${id}/reschedule`, {
    scheduled_at: scheduledAt,
  });

/** DELETE /api/appointments/:id  (cancel) */
export const cancelAppointment = (id) =>
  axiosClient.delete(`/api/appointments/${id}`);

/** GET /api/reviews/doctor/:doctorId */
export const getDoctorReviews = (doctorId, params = {}) =>
  axiosClient.get(`/api/reviews/doctor/${doctorId}`, { params });

/** POST /api/reviews */
export const createReview = (data) => axiosClient.post("/api/reviews", data);

/** GET /api/admin/users */
export const adminGetUsers = (params = {}) =>
  axiosClient.get("/api/admin/users", { params });

/** PATCH /api/admin/users/:id */
export const adminToggleUser = (userId, is_active) =>
  axiosClient.patch(`/api/admin/users/${userId}`, null, {
    params: { is_active },
  });

/** GET /api/admin/stats */
export const adminGetStats = () => axiosClient.get("/api/admin/stats");
