export function persistAuthSession(payload) {
  localStorage.setItem("craftify_access_token", payload.tokens.accessToken);
  localStorage.setItem("craftify_refresh_token", payload.tokens.refreshToken);
  localStorage.setItem("craftify_user", JSON.stringify(payload.user));
}

export function getResetEmail() {
  return sessionStorage.getItem("craftify_reset_email") || "";
}

export function setResetEmail(email) {
  sessionStorage.setItem("craftify_reset_email", email);
}
