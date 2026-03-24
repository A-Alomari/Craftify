export function showMessage(message, type = "success") {
  const id = "craftify-flash-message";
  let banner = document.getElementById(id);

  if (!banner) {
    banner = document.createElement("div");
    banner.id = id;
    banner.style.position = "fixed";
    banner.style.top = "16px";
    banner.style.right = "16px";
    banner.style.zIndex = "9999";
    banner.style.padding = "12px 14px";
    banner.style.borderRadius = "10px";
    banner.style.maxWidth = "340px";
    banner.style.fontFamily = "Inter, sans-serif";
    banner.style.fontSize = "14px";
    banner.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
    document.body.appendChild(banner);
  }

  banner.textContent = message;
  if (type === "error") {
    banner.style.backgroundColor = "#7f1d1d";
    banner.style.color = "#fee2e2";
  } else {
    banner.style.backgroundColor = "#14532d";
    banner.style.color = "#dcfce7";
  }

  window.clearTimeout(showMessage._timer);
  showMessage._timer = window.setTimeout(function () {
    if (banner) {
      banner.remove();
    }
  }, 3500);
}
