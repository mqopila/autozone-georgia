const AUTH_KEY = "autozone_user";
const VISITOR_KEY = "autozone_visitor";

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const setStoredUser = (user) => {
  if (!user) {
    localStorage.removeItem(AUTH_KEY);
    return;
  }

  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
};

const ensureVisitorId = () => {
  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}`;
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  return visitorId;
};

const parseJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { error: text || "Response was not valid JSON." };
  }
};

const showAuthMessage = (message, isError = false) => {
  const node = document.getElementById("authMessage");
  if (!node) return;

  node.textContent = message;
  node.style.color = isError ? "#f5a3a3" : "#c9fa54";
};

const setLockedState = (locked) => {
  document.body.classList.toggle("app-locked", locked);
  const modal = document.getElementById("authModal");
  if (modal) {
    modal.hidden = !locked;
  }
};

const initializeAccessGate = () => {
  const user = readStoredUser();
  if (!user) {
    setLockedState(true);
    return;
  }

  setLockedState(false);
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.title = `გამოსვლა: ${user.name}`;
  }
};

const registerUser = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    name: formData.get("name").toString().trim(),
    email: formData.get("email").toString().trim(),
    password: formData.get("password").toString().trim()
  };

  showAuthMessage("", false);

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data.error || "რეგისტრაცია ვერ დასრულდა.");
    }

    setStoredUser(data.user);
    form.reset();
    showAuthMessage("რეგისტრაცია წარმატებულია.", false);
    setLockedState(false);
    ensureVisitorId();
    window.location.reload();
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : "სერვერი არ არის ხელმისაწვდომი. გთხოვთ, გაუშვით npm start.";

    showAuthMessage(message, true);
  }
};

const logoutUser = () => {
  setStoredUser(null);
  initializeAccessGate();
  showAuthMessage("თქვენ გამოხვედით სისტემიდან.", false);
};

document.addEventListener("DOMContentLoaded", () => {
  initializeAccessGate();

  const form = document.getElementById("registerForm");
  if (form) {
    form.addEventListener("submit", registerUser);
  }

  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", logoutUser);
  }

  const user = readStoredUser();
  if (user) {
    const visitorId = ensureVisitorId();
    fetch("/api/me", {
      headers: {
        "x-user-id": String(user.id),
        "x-visitor-id": visitorId
      }
    }).catch(() => {});
  }
});
