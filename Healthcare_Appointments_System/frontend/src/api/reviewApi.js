import axiosClient from "./axiosClient";

/** GET /api/reviews/doctor/:doctorId */
export const getDoctorReviews = (doctorId, params = {}) =>
  axiosClient.get(`/api/reviews/doctor/${doctorId}`, { params });

/** POST /api/reviews */
export const createReview = (data) => axiosClient.post("/api/reviews", data);
