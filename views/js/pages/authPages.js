import { authApi } from "../api/authApi.js";
import { persistAuthSession, getResetEmail, setResetEmail } from "../utils/auth.js";
import { showMessage } from "../utils/toast.js";

function setupSignIn() {
  const form = document.querySelector("form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const emailInput = form.querySelector("input[name='email']");
    const passwordInput = form.querySelector("input[name='password']");

    try {
      const result = await authApi.login({
        email: emailInput ? emailInput.value.trim() : "",
        password: passwordInput ? passwordInput.value : "",
      });

      persistAuthSession(result);
      showMessage("Signed in successfully", "success");
      window.setTimeout(function () {
        window.location.href = "../home/index.html";
      }, 600);
    } catch (error) {
      showMessage(error.message, "error");
    }
  });
}

function setupCreateAccount() {
  const form = document.querySelector("form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const fields = form.querySelectorAll("input");
    const fullName = fields[0] ? fields[0].value.trim() : "";
    const email = fields[1] ? fields[1].value.trim() : "";
    const password = fields[2] ? fields[2].value : "";
    const confirmPassword = fields[3] ? fields[3].value : "";
    const terms = document.getElementById("terms");

    if (!terms || !terms.checked) {
      showMessage("Please accept the terms before continuing", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match", "error");
      return;
    }

    try {
      await authApi.register({ fullName, email, password, role: "BUYER" });
      showMessage("Account created. Please sign in.", "success");
      window.setTimeout(function () {
        window.location.href = "../auth/sign-in.html";
      }, 700);
    } catch (error) {
      showMessage(error.message, "error");
    }
  });
}

function setupForgotPassword() {
  const form = document.querySelector("form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const emailInput = form.querySelector("input[type='email']");
    const email = emailInput ? emailInput.value.trim() : "";

    try {
      await authApi.forgotPassword({ email });
      setResetEmail(email);
      showMessage("Verification code request sent", "success");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });
}

function setupVerifyCode() {
  const form = document.querySelector("form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const digits = Array.from(form.querySelectorAll(".otp-input"))
      .map(function (el) {
        return el.value.trim();
      })
      .join("");

    try {
      await authApi.verifyCode({ code: digits, email: getResetEmail() });
      showMessage("Code verified successfully", "success");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });
}

function setupResetPassword() {
  const form = document.querySelector("form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const password = document.getElementById("new-password");
    const confirmPassword = document.getElementById("confirm-password");

    if (!password || !confirmPassword) {
      showMessage("Password fields are missing", "error");
      return;
    }

    if (password.value !== confirmPassword.value) {
      showMessage("Passwords do not match", "error");
      return;
    }

    try {
      await authApi.resetPassword({ email: getResetEmail(), password: password.value });
      showMessage("Password has been reset", "success");
      window.setTimeout(function () {
        window.location.href = "../auth/sign-in.html";
      }, 700);
    } catch (error) {
      showMessage(error.message, "error");
    }
  });
}

export function bootstrapAuthPages() {
  const page = window.location.pathname;
  if (page.includes("/auth/sign-in.html")) {
    setupSignIn();
  } else if (page.includes("/auth/create-account.html")) {
    setupCreateAccount();
  } else if (page.includes("/auth/forgot-password.html")) {
    setupForgotPassword();
  } else if (page.includes("/auth/verify-code.html")) {
    setupVerifyCode();
  } else if (page.includes("/auth/reset-password.html")) {
    setupResetPassword();
  }
}
