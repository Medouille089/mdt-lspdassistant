// Client-side form handling for citoyen.html
(function () {
  async function getCurrentUser() {
    try {
      const res = await fetch('/api/user');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // Fonction de formatage du téléphone
  function formatPhoneNumber(value) {
    // Enlever tous les caractères non-numériques
    const numbers = value.replace(/\D/g, '');

    // Limiter à 10 chiffres
    const limited = numbers.substring(0, 10);

    // Formater selon le pattern (000) 000-0000
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    } else {
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  }

  function validateForm() {
    const nom = document.getElementById('nom').value.trim();
    const prenom = document.getElementById('prenom').value.trim();
    const dateNaissance = document.getElementById('date_naissance').value;
    const nationalite = document.getElementById('nationalite').value.trim();
    const genre = document.getElementById('genre').value;

    if (!nom) {
      showNotification('Le nom est requis', 'error');
      document.getElementById('nom').focus();
      return false;
    }

    if (!prenom) {
      showNotification('Le prénom est requis', 'error');
      document.getElementById('prenom').focus();
      return false;
    }

    if (!dateNaissance) {
      showNotification('La date de naissance est requise', 'error');
      document.getElementById('date_naissance').focus();
      return false;
    }

    if (!nationalite) {
      showNotification('La nationalité est requise', 'error');
      document.getElementById('nationalite').focus();
      return false;
    }

    if (!genre) {
      showNotification('Le genre est requis', 'error');
      document.getElementById('genre').focus();
      return false;
    }

    return true;
  }

  // --- Gestion des Tags ---
  let allAvailableTags = [];
  let selectedTags = [];

  async function loadAvailableTags() {
    try {
      const res = await fetch('/api/tags?type=citoyen');
      allAvailableTags = await res.json();
      renderTags();
    } catch (err) {
      console.error("Erreur chargement tags:", err);
    }
  }

  function renderTags() {
    const container = document.getElementById('tagsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    selectedTags.forEach(tag => {
      const tagEl = document.createElement('div');
      tagEl.className = 'tag-item';
      tagEl.style.backgroundColor = tag.color;
      tagEl.innerHTML = `
        <span>${tag.name}</span>
        <span class="material-symbols-rounded remove-tag" onclick="removeTag(${tag.id})">close</span>
      `;
      container.appendChild(tagEl);
    });
    
    const addBtn = document.createElement('div');
    addBtn.className = 'add-tag-btn';
    addBtn.innerHTML = '<span class="material-symbols-rounded">add</span> Ajouter';
    addBtn.onclick = showTagSelector;
    container.appendChild(addBtn);
  }

  window.removeTag = function(tagId) {
    selectedTags = selectedTags.filter(t => t.id !== tagId);
    renderTags();
  };

  function showTagSelector() {
    const modal = document.createElement('div');
    modal.className = 'tag-selector-modal';
    
    let tagsHtml = allAvailableTags
      .filter(t => !selectedTags.find(ct => ct.id === t.id))
      .map(t => `
        <div class="tag-option" onclick="addTag(${t.id})">
          <span class="tag-dot" style="background-color: ${t.color}"></span>
          <span>${t.name}</span>
        </div>
      `).join('');
        
    modal.innerHTML = `
      <div class="tag-selector-content">
        <h3>Ajouter un tag</h3>
        <div class="tag-options-list">
          ${tagsHtml || '<p>Aucun autre tag disponible</p>'}
        </div>
        <hr>
        <h4>Créer un nouveau tag</h4>
        <input type="text" id="newTagName" placeholder="Nom du tag" class="modern-input">
        <div class="color-picker" id="tagColorPicker">
          ${['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#34495e', '#1abc9c'].map(c => `
            <div class="color-option" style="background-color: ${c}" data-color="${c}"></div>
          `).join('')}
        </div>
        <div style="display:flex; gap:10px; margin-top:15px;">
          <button class="btn-confirm" onclick="createNewTag()">Créer</button>
          <button class="btn-cancel" onclick="this.closest('.tag-selector-modal').remove()">Annuler</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Color picker logic
    const colors = modal.querySelectorAll('.color-option');
    colors.forEach(c => c.onclick = () => {
      colors.forEach(opt => opt.classList.remove('selected'));
      c.classList.add('selected');
    });
    if (colors.length > 0) colors[0].click();
  }

  window.addTag = function(tagId) {
    const tag = allAvailableTags.find(t => t.id === tagId);
    if (tag) selectedTags.push(tag);
    renderTags();
    const modal = document.querySelector('.tag-selector-modal');
    if (modal) modal.remove();
  };

  window.createNewTag = async function() {
    const name = document.getElementById('newTagName').value;
    const color = document.querySelector('.color-option.selected').dataset.color;

    if (!name) return showNotification("Nom requis", 'error');

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, type: 'citoyen' })
      });
      const newTag = await res.json();
      allAvailableTags.push(newTag);
      addTag(newTag.id);
      document.querySelector('.tag-selector-modal').remove();
    } catch (err) {
      console.error(err);
    }
  };

  function setupTagsHandlers() {
    loadAvailableTags();
  }

  async function submitForm(event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const user = await getCurrentUser();
    if (!user || !user.username) {
      showNotification('Erreur: utilisateur non authentifié', 'error');
      return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Enregistrement en cours...';

    try {
      const telephoneInput = document.getElementById('telephone').value.trim();
      // Extraire seulement les chiffres pour l'envoi
      const telephoneNumbers = telephoneInput.replace(/\D/g, '');
      const telephoneFormatted = telephoneNumbers ? formatPhoneNumber(telephoneNumbers) : null;

      const photoPreview = document.getElementById('photo_preview');
      const photoUrl = photoPreview && photoPreview.src && !photoPreview.src.includes('default-citoyen.png') ? photoPreview.src.trim() : null;
      const formData = {
        nom: document.getElementById('nom').value.trim(),
        prenom: document.getElementById('prenom').value.trim(),
        date_naissance: document.getElementById('date_naissance').value,
        nationalite: document.getElementById('nationalite').value.trim(),
        genre: document.getElementById('genre').value,
        telephone: telephoneFormatted,
        adresse: document.getElementById('adresse').value.trim() || null,
        gang_affilie: document.getElementById('gang_affilie').value.trim() || null,
        note_interne: document.getElementById('note_interne').value.trim() || null,
        emploi: document.getElementById('emploi').value.trim() || null,
        mandat_actif: document.getElementById('mandat_actif').value === 'true',
        photo: photoUrl,
        permis_A: document.getElementById('permis_A').checked,
        permis_B: document.getElementById('permis_B').checked,
        permis_C: document.getElementById('permis_C').checked,
        permis_PPA: document.getElementById('permis_PPA').checked,
        permis_BRAVO: document.getElementById('permis_BRAVO').checked,
        permis_ASD: document.getElementById('permis_ASD').checked,
        created_by: user.username,
        tags: selectedTags.map(t => t.id)
      };

      const response = await fetch('/api/citoyens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('✓ Citoyen enregistré avec succès', 'success');
        setTimeout(() => {
          window.location.href = '/liste-citoyens.html';
        }, 1500);
      } else {
        showNotification(result.error || 'Erreur lors de l\'enregistrement', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer le citoyen';
      }
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      showNotification('Erreur de connexion au serveur', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer le citoyen';
    }
  }

  // Event listeners
  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('citoyenForm');
    const telephoneInput = document.getElementById('telephone');
    const photoPreview = document.getElementById('photo_preview');
    const photoUrlInput = document.getElementById('photoUrlInput');

    // Form submission
    form.addEventListener('submit', submitForm);

    // Initialiser les tags
    setupTagsHandlers();

    // Formatage automatique du téléphone
    const telInput = document.getElementById('telephone');
    if (telInput) {
      telInput.addEventListener('input', function (e) {
        let value = e.target.value.replace(/\D/g, ''); // Garder que les chiffres
        if (value.startsWith('555')) {
          value = value.substring(3);
        }

        if (value.length > 4) {
          value = value.substring(0, 4);
        }

        if (value.length > 0) {
          e.target.value = '555-' + value;
        } else {
          e.target.value = '555-';
        }
      });

      telInput.addEventListener('focus', function (e) {
        if (!e.target.value) {
          e.target.value = '555-';
        }
      });

      telInput.addEventListener('blur', function (e) {
        if (e.target.value === '555-') {
          e.target.value = '';
        }
      });
    }

    photoUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url) {
        photoPreview.src = url;
        photoPreview.style.display = 'block';
        photoPreview.onerror = () => {
          photoPreview.style.display = 'none';
        };
      } else {
        photoPreview.style.display = 'none';
      }
    });
  });
})();
