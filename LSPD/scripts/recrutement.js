// Client-side multi-step form handling for recrutement.html
(function () {
  // Salon cible et bannière sont désormais gérés côté serveur (config .env).
  const LIMITS = { CHUNK_SAFETY: 3800, CONTENT_MAX: 2000 };

  function clamp(str, max) {
    if (!str) return '';
    str = String(str);
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  async function getCurrentUser() {
    try {
      const res = await fetch('/api/user');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  function serializeForm() {
    const f = document.getElementById('recruitmentForm');
    const data = {};
    const fd = new FormData(f);
    for (const [k, v] of fd.entries()) data[k] = v;
    return data;
  }

  async function postSubmission(payload) {
    const res = await fetch('/forms/recruitment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  }

  // Multi-step logic
  let currentStep = 0;
  let steps = [];

  function showStep(index) {
    steps.forEach((el, i) => {
      if (i === index) el.classList.add('active'); else el.classList.remove('active');
    });
    currentStep = index;
    updateNav();
  }

  function updateNav() {
    const btnBack = document.getElementById('btnBack');
    const btnNext = document.getElementById('btnNext');
    const btnSubmit = document.getElementById('btnSubmit');
    if (!btnBack || !btnNext || !btnSubmit) return;
    btnBack.style.display = currentStep === 0 ? 'none' : '';
    if (currentStep >= steps.length - 1) {
      btnNext.style.display = 'none';
      btnSubmit.style.display = '';
    } else {
      btnNext.style.display = '';
      btnSubmit.style.display = 'none';
    }
  }

  function nextStep() {
      if (!validateStep(currentStep)) return;
      if (currentStep < steps.length - 1) {
        showStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }

  function prevStep() {
    if (currentStep > 0) {
      showStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // validateStep: ensure required fields in the current step are filled
  function validateStep(index) {
    const step = steps[index];
    if (!step) return true;
    // inputs, textareas, selects
    const requiredEls = step.querySelectorAll('input[required], textarea[required], select[required]');
    for (const el of requiredEls) {
      if (el.type === 'radio') {
        // ensure at least one radio with this name in the step is checked
        const name = el.name;
        const radios = step.querySelectorAll(`input[type="radio"][name="${name}"]`);
        let ok = false;
        radios.forEach(r => { if (r.checked) ok = true; });
        if (!ok) {
          showNotification('Veuillez répondre à la question requise.', 'warning');
          radios[0].focus();
          return false;
        }
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        const v = (el.value || '').toString().trim();
        if (!v) {
          showNotification('Veuillez remplir tous les champs obligatoires avant de continuer.', 'warning');
          el.focus();
          return false;
        }
      }
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // footer year
    try {
      const yEl = document.getElementById('copyrightYear');
      if (yEl) yEl.textContent = new Date().getFullYear();
    } catch (_) {}

    const user = await getCurrentUser();
    if (user) {
      const usernameEl = document.getElementById('username');
      const discordEl = document.getElementById('discordId');
      if (usernameEl && user.username) usernameEl.value = user.username;
      if (discordEl && user.id) discordEl.value = user.id;
    }

    steps = Array.from(document.querySelectorAll('.form-step'));
    if (!steps.length) return;
    showStep(0);

    document.getElementById('btnNext').addEventListener('click', nextStep);
    document.getElementById('btnBack').addEventListener('click', prevStep);

    const form = document.getElementById('recruitmentForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById('btnSubmit');
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Envoi en cours...';

      const payload = serializeForm();

      try {
        const res = await postSubmission(payload);
        if (!res.ok) {
          const txt = await res.text();
          showNotification('Erreur envoi: ' + res.status + '\n' + txt, 'error');
          return;
        }
        showNotification('Candidature envoyée avec succès!', 'success');
        form.reset();
        showStep(0);
      } catch (err) {
        console.error(err);
        showNotification('Erreur réseau lors de l\'envoi', 'error');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Envoyer la candidature';
      }
    });
  });
})();
