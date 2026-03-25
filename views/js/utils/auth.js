export function persistAuthSession(payload) {
  localStorage.setItem("craftify_user", JSON.stringify(payload.user));
}

export function clearAuthSession() {
  localStorage.removeItem("craftify_user");
}

export function hasAuthSession() {
  return !!localStorage.getItem("craftify_user");
}

export function getResetEmail() {
  return sessionStorage.getItem("craftify_reset_email") || "";
}

export function setResetEmail(email) {
  sessionStorage.setItem("craftify_reset_email", email);
}
