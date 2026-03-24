import { apiRequest } from "../utils/http.js";

export const authApi = {
  register: (payload) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  forgotPassword: (payload) =>
    apiRequest("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyCode: (payload) =>
    apiRequest("/auth/verify-code", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resetPassword: (payload) =>
    apiRequest("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
