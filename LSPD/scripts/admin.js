document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loaderOverlay").style.display = "flex";
  loadConfig();
});

async function loadConfig() {
  const loader = document.getElementById("loaderOverlay");
  loader.style.display = "flex";

  try {
    const res = await fetch("/api/config");
    const config = await res.json();

    for (const key in config) {
      const input = document.querySelector(`[name="${key}"]`);
      if (input) input.value = config[key];
    }
  } catch (err) {
    console.error("Erreur lors du chargement de la config :", err);
  } finally {
    loader.style.display = "none";
  }
}

document.getElementById("configForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const loader = document.getElementById("loaderOverlay");
  loader.style.display = "flex";

  const data = Object.fromEntries(new FormData(e.target).entries());

  let success = false;

  try {
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    success = res.ok;
  } catch (err) {
    console.error("Erreur lors de la soumission de la config :", err);
  } finally {
    loader.style.display = "none";
    await showAnimation(success ? "success" : "error");

    if (success) {
      const container = document.getElementById("feedbackAnimation");
      container.classList.add("fade-out");
      container.addEventListener(
        "transitionend",
        () => {
          location.reload();
        },
        { once: true }
      );
    }
  }
});

// Animation après submit
function showAnimation(type = "success") {
  return new Promise((resolve) => {
    const container = document.getElementById("feedbackAnimation");
    container.innerHTML = ""; // reset
    const content = document.createElement("div");
    content.className = "feedback-inner";

    if (type === "success") {
      content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
                    <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
                    <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" points="100.2,40.2 51.5,88.8 29.8,67.5"/>
                </svg>
                <p class="success">Config mise à jour avec succès!</p>
            `;
    } else {
      content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
                    <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
                </svg>
                <p class="error">Erreur lors de la mise à jour de la config</p>
            `;
    }

    container.appendChild(content);
    container.style.display = "flex";

    setTimeout(() => resolve(), 1800);
  });
}

(function () {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const btn = document.getElementById("backlinkBtn");
    if (!btn) return;

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "menu-admin-salons.html";
      }
    });
  }
})();
