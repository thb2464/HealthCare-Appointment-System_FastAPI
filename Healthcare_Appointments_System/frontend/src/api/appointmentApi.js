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

/** PATCH /api/appointments/:id/arrive */
export const markArrived = (id) =>
  axiosClient.patch(`/api/appointments/${id}/arrive`);

/** DELETE /api/appointments/:id  (cancel) */
export const cancelAppointment = (id, cancellationReason) =>
  axiosClient.delete(`/api/appointments/${id}`, {
    data: { cancellation_reason: cancellationReason || undefined },
  });

/** PATCH /api/appointments/:id/noshow */
export const markNoShow = (id, cancellationReason) =>
  axiosClient.patch(`/api/appointments/${id}/noshow`, {
    cancellation_reason: cancellationReason || undefined,
  });

/** PATCH /api/appointments/:id/reschedule/accept */
export const acceptReschedule = (id) =>
  axiosClient.patch(`/api/appointments/${id}/reschedule/accept`);

/** PATCH /api/appointments/:id/reschedule/decline */
export const declineReschedule = (id) =>
  axiosClient.patch(`/api/appointments/${id}/reschedule/decline`);

/** GET /api/appointments/:id/checkin-token */
export const getCheckinToken = (id) =>
  axiosClient.get(`/api/appointments/${id}/checkin-token`);

/** POST /api/payment/vnpay/create — book + get VNPay redirect URL */
export const createVNPayPayment = (data) =>
  axiosClient.post("/api/payment/vnpay/create", data);

/** POST /api/payment/vnpay/retry/:id — retry payment for an existing unpaid PENDING appointment */
export const retryVNPayPayment = (appointmentId) =>
  axiosClient.post(`/api/payment/vnpay/retry/${appointmentId}`);
