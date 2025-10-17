// Password viewer for login
const passwordInputField = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePassword");
const eyePassword = document.getElementById("eyePassword");
if (togglePasswordBtn && passwordInputField && eyePassword) {
  togglePasswordBtn.addEventListener("click", function () {
    if (passwordInputField.type === "password") {
      passwordInputField.type = "text";
      eyePassword.textContent = "visibility_off";
    } else {
      passwordInputField.type = "password";
      eyePassword.textContent = "visibility";
    }
  });
}
function switchTab(tab) {
  // Mettre à jour les boutons
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Trouver le bouton cliqué via l'event ou par le tab
  if (window.event && window.event.target) {
    window.event.target.classList.add("active");
  } else {
    // Fallback si event n'est pas disponible
    const buttons = document.querySelectorAll(".tab-button");
    if (tab === "discord") {
      buttons[0].classList.add("active");
    } else {
      buttons[1].classList.add("active");
    }
  }

  // Mettre à jour le contenu
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  document.getElementById(tab + "-tab").classList.add("active");
}

// Gestion de la soumission du formulaire local
document
  .getElementById("localLoginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const loginBtn = document.getElementById("loginBtn");
    loginBtn.disabled = true;
    loginBtn.textContent = "Connexion...";

    try {
      const response = await fetch("/login-local", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        window.location.href = data.redirect || "/protected";
      } else {
        showError(data.error || "Nom d'utilisateur ou mot de passe incorrect");
        loginBtn.disabled = false;
        loginBtn.textContent = "Se connecter";
      }
    } catch (error) {
      console.error("Erreur:", error);
      showError("Erreur de connexion au serveur");
      loginBtn.disabled = false;
      loginBtn.textContent = "Se connecter";
    }
  });

function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
  setTimeout(() => {
    errorDiv.style.display = "none";
  }, 5000);
}
