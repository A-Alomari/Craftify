export const API_BASE = window.CRAFTIFY_API_BASE || "/api";

let isRefreshing = false;
let refreshPromise = null;

async function tryRefreshSession() {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = fetch(API_BASE + "/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("Session refresh failed");
      }
      return res.json();
    })
    .then(function (payload) {
      if (payload && payload.user) {
        localStorage.setItem("craftify_user", JSON.stringify(payload.user));
      }
      return payload;
    })
    .finally(function () {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function apiRequest(path, options = {}, retried = false) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const response = await fetch(API_BASE + path, {
    credentials: "include",
    headers,
    ...options,
  });

  const data = await response.json().catch(function () {
    return { success: false, message: "Invalid server response" };
  });

  if (response.status === 401 && !retried && !path.startsWith("/auth/")) {
    try {
      await tryRefreshSession();
      return apiRequest(path, options, true);
    } catch (_error) {
      localStorage.removeItem("craftify_user");
    }
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}
