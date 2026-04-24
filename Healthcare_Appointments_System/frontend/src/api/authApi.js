import axiosClient from "./axiosClient";

/** POST /api/auth/register */
export const register = (data) => axiosClient.post("/api/auth/register", data);

/** POST /api/auth/login  (form-urlencoded for OAuth2PasswordRequestForm) */
export const login = (email, password) => {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  return axiosClient.post("/api/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};

/** GET /api/auth/me */
export const getMe = () => axiosClient.get("/api/auth/me");

/** POST /api/auth/refresh */
export const refreshToken = (refresh_token) =>
  axiosClient.post("/api/auth/refresh", { refresh_token });
