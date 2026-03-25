export const API_BASE = window.CRAFTIFY_API_BASE || "/api";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("craftify_access_token") || "";

  const response = await fetch(API_BASE + path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...options,
  });

  const data = await response.json().catch(function () {
    return { success: false, message: "Invalid server response" };
  });

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}
