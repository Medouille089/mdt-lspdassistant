
(function () {
  const form = document.getElementById('logsConfigForm');
  const loader = document.getElementById('loaderOverlay');
  const feedback = document.getElementById('feedbackAnimation');

  async function fetchConfig() {
    loader.style.display = 'block';
    try {
      const res = await fetch('/api/logs-config');
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const data = await res.json();
      for (const key in data) {
        if (form.elements[key]) {
          form.elements[key].value = data[key] || '';
        }
      }
    } catch (err) {
      showAnimation('error', 'Erreur: ' + err.message);
    } finally {
      loader.style.display = 'none';
    }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    loader.style.display = 'block';
    let success = false;
    try {
      const payload = {};
      for (const el of form.elements) {
        if (el.name) payload[el.name] = el.value;
      }
      const res = await fetch('/api/logs-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      success = res.ok;
    } catch (err) {
      showAnimation('error', 'Erreur: ' + err.message);
    } finally {
      loader.style.display = 'none';
      await showAnimation(success ? 'success' : 'error');
      if (success) {
        feedback.classList.add('fade-out');
        feedback.addEventListener('transitionend', () => {
          location.reload();
        }, { once: true });
      }
    }
  });

  function showAnimation(type = 'success', msg) {
    return new Promise((resolve) => {
      feedback.innerHTML = '';
      const content = document.createElement('div');
      content.className = 'feedback-inner';
      if (type === 'success') {
        content.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
            <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
            <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" points="100.2,40.2 51.5,88.8 29.8,67.5"/>
          </svg>
          <p class="success">Config logs mise à jour avec succès!</p>
        `;
      } else {
        content.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
            <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
            <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
            <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
          </svg>
          <p class="error">${msg || 'Erreur lors de la mise à jour des logs'}</p>
        `;
      }
      feedback.appendChild(content);
      feedback.style.display = 'flex';
      setTimeout(() => resolve(), 1800);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchConfig);
  } else {
    fetchConfig();
  }
})();
