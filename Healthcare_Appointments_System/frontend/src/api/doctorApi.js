import axiosClient from "./axiosClient";

/** GET /api/specialties */
export const getSpecialties = () => axiosClient.get("/api/specialties");

/** GET /api/doctors */
export const getDoctors = (params = {}) =>
  axiosClient.get("/api/doctors", { params });

/** GET /api/doctors/me */
export const getMyDoctorProfile = () => axiosClient.get("/api/doctors/me");

/** PATCH /api/doctors/me */
export const updateMyDoctorProfile = (data) =>
  axiosClient.patch("/api/doctors/me", data);

/** GET /api/doctors/:id */
export const getDoctor = (id) => axiosClient.get(`/api/doctors/${id}`);

/** GET /api/doctors/:id/slots?date=YYYY-MM-DD */
export const getDoctorSlots = (doctorId, date) =>
  axiosClient.get(`/api/doctors/${doctorId}/slots`, { params: { date } });

/** GET /api/doctors/:id/availability */
export const getDoctorAvailability = (doctorId) =>
  axiosClient.get(`/api/doctors/${doctorId}/availability`);

/** PUT /api/doctors/me/availability */
export const setMyAvailability = (slots) =>
  axiosClient.put("/api/doctors/me/availability", { slots });
