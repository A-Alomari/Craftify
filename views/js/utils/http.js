export const API_BASE = window.CRAFTIFY_API_BASE || "http://localhost:4000/api";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("craftify_access_token") || "";

  const { headers: callerHeaders, ...restOptions } = options;

  const response = await fetch(API_BASE + path, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(callerHeaders || {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
  });

  const data = await response.json().catch(function () {
    return { success: false, message: "Invalid server response" };
  });

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}
