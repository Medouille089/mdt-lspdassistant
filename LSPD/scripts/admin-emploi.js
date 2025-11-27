/* ============================================
   Gestion de l'Emploi du Temps
   ============================================ */

// État global
const state = {
  jours: [],
  creneaux: [],
  matieres: [],
  professeurs: [],
  emploiDuTemps: []
};

// ============================================
// Initialisation au chargement de la page
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📚 Initialisation du gestionnaire d\'emploi du temps...');

  // Charger les données de référence
  await loadReferenceData();

  // Configurer les onglets
  setupTabs();

  // Configurer les formulaires
  setupForms();

  // Configurer le color picker
  setupColorPicker();

  // Configurer le formulaire d'édition
  setupEditForm();

  console.log('✅ Initialisation terminée');
});

// ============================================
// Gestion des onglets
// ============================================
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Désactiver tous les onglets
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Activer l'onglet sélectionné
      button.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');

      // Si on ouvre l'onglet visualisation, charger l'emploi du temps
      if (tabName === 'visualiser') {
        loadSchedule();
      }
    });
  });
}

// ============================================
// Charger les données de référence
// ============================================
async function loadReferenceData() {
  try {
    showNotification('Chargement des données...', 'warning');

    // Charger en parallèle
    const [jours, creneaux, matieres, professeurs] = await Promise.all([
      fetch('/api/emploi/jours').then(r => r.json()),
      fetch('/api/emploi/creneaux').then(r => r.json()),
      fetch('/api/emploi/matieres').then(r => r.json()),
      fetch('/api/emploi/professeurs').then(r => r.json())
    ]);

    state.jours = jours;
    state.creneaux = creneaux;
    state.matieres = matieres;
    state.professeurs = professeurs;

    // Remplir les selects
    populateSelect('jour_id', jours, (j) => `${j.nom}`);
    populateSelect('creneau_id', creneaux, (c) => `${c.nom} (${c.heure_debut.substring(0,5)} - ${c.heure_fin.substring(0,5)})`);
    populateSelect('matiere_id', matieres, (m) => m.nom);
    populateSelect('professeur_id', professeurs, (p) => `${p.prenom} ${p.nom}`);

    console.log('✅ Données chargées:', { jours, creneaux, matieres, professeurs });
    showNotification('Données chargées avec succès', 'success');

  } catch (error) {
    console.error('❌ Erreur chargement données:', error);
    showNotification('Erreur lors du chargement des données', 'error');
  }
}

// ============================================
// Remplir un select avec des options
// ============================================
function populateSelect(selectId, items, labelFn) {
  const select = document.getElementById(selectId);
  if (!select) return;

  // Garder la première option (placeholder)
  const firstOption = select.options[0];
  select.innerHTML = '';
  select.appendChild(firstOption);

  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = labelFn(item);
    select.appendChild(option);
  });
}

// ============================================
// Configuration des formulaires
// ============================================
function setupForms() {
  // Formulaire d'ajout de cours
  const formCours = document.getElementById('form-cours');
  formCours.addEventListener('submit', handleCoursSubmit);

  // Formulaire d'ajout de matière
  const formMatiere = document.getElementById('form-matiere');
  formMatiere.addEventListener('submit', handleMatiereSubmit);

  // Formulaire d'ajout de professeur
  const formProfesseur = document.getElementById('form-professeur');
  formProfesseur.addEventListener('submit', handleProfesseurSubmit);
}

// ============================================
// Gérer la soumission du formulaire de cours
// ============================================
async function handleCoursSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = {
    jour_id: parseInt(formData.get('jour_id')),
    creneau_id: parseInt(formData.get('creneau_id')),
    matiere_id: formData.get('matiere_id') ? parseInt(formData.get('matiere_id')) : null,
    professeur_id: formData.get('professeur_id') ? parseInt(formData.get('professeur_id')) : null,
    salle: formData.get('salle') || null,
    remarques: formData.get('remarques') || null
  };

  try {
    const response = await fetch('/api/emploi-du-temps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showNotification('✅ Cours ajouté avec succès !', 'success');
      e.target.reset();

      // Optionnel: basculer vers l'onglet visualisation
      setTimeout(() => {
        document.querySelector('[data-tab="visualiser"]').click();
      }, 1500);
    } else {
      showNotification(`❌ ${result.error || 'Erreur lors de l\'ajout'}`, 'error');
    }
  } catch (error) {
    console.error('❌ Erreur:', error);
    showNotification('❌ Erreur de connexion au serveur', 'error');
  }
}

// ============================================
// Gérer la soumission du formulaire de matière
// ============================================
async function handleMatiereSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = {
    nom: formData.get('nom'),
    code: formData.get('code') || null,
    couleur: formData.get('couleur'),
    description: formData.get('description') || null
  };

  try {
    const response = await fetch('/api/emploi/matieres', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showNotification('✅ Matière ajoutée avec succès !', 'success');
      e.target.reset();

      // Recharger les matières pour mettre à jour le select
      await loadReferenceData();
    } else {
      showNotification(`❌ ${result.error || 'Erreur lors de l\'ajout'}`, 'error');
    }
  } catch (error) {
    console.error('❌ Erreur:', error);
    showNotification('❌ Erreur de connexion au serveur', 'error');
  }
}

// ============================================
// Gérer la soumission du formulaire de professeur
// ============================================
async function handleProfesseurSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = {
    nom: formData.get('nom'),
    prenom: formData.get('prenom'),
    email: formData.get('email') || null,
    telephone: formData.get('telephone') || null,
    specialite: formData.get('specialite') || null
  };

  try {
    const response = await fetch('/api/emploi/professeurs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showNotification('✅ Professeur ajouté avec succès !', 'success');
      e.target.reset();

      // Recharger les professeurs pour mettre à jour le select
      await loadReferenceData();
    } else {
      showNotification(`❌ ${result.error || 'Erreur lors de l\'ajout'}`, 'error');
    }
  } catch (error) {
    console.error('❌ Erreur:', error);
    showNotification('❌ Erreur de connexion au serveur', 'error');
  }
}

// ============================================
// Charger et afficher l'emploi du temps
// ============================================
async function loadSchedule() {
  const container = document.getElementById('schedule-container');

  // Afficher le loader
  container.innerHTML = `
    <div class="loader-container">
      <div class="loader"></div>
      <p>Chargement de l'emploi du temps...</p>
    </div>
  `;

  try {
    const response = await fetch('/api/emploi-du-temps');
    const emploi = await response.json();

    state.emploiDuTemps = emploi;

    if (emploi.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <p style="font-size: 1.2rem; color: var(--text-muted);">
            📅 Aucun cours dans l'emploi du temps
          </p>
          <p style="margin-top: 10px; color: var(--text-muted);">
            Utilisez le formulaire pour ajouter des cours
          </p>
        </div>
      `;
      return;
    }

    // Grouper par jour
    const parJour = {};
    emploi.forEach(cours => {
      if (!parJour[cours.jour]) {
        parJour[cours.jour] = [];
      }
      parJour[cours.jour].push(cours);
    });

    // Générer le HTML
    let html = '';
    Object.keys(parJour).sort((a, b) => {
      const jourA = state.jours.find(j => j.nom === a);
      const jourB = state.jours.find(j => j.nom === b);
      return (jourA?.numero || 0) - (jourB?.numero || 0);
    }).forEach(jour => {
      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: var(--primary-color); margin-bottom: 15px; font-size: 1.5rem;">
            📅 ${jour}
          </h3>
          <table class="schedule-table">
            <thead>
              <tr>
                <th>Créneau</th>
                <th>Horaires</th>
                <th>Matière</th>
                <th>Professeur</th>
                <th>Salle</th>
                <th>Remarques</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
      `;

      parJour[jour].forEach(cours => {
        const couleur = cours.matiere_couleur || '#3498db';
        html += `
          <tr>
            <td>${cours.creneau}</td>
            <td>${cours.heure_debut?.substring(0,5)} - ${cours.heure_fin?.substring(0,5)}</td>
            <td>
              ${cours.matiere ? `<span class="matiere-badge" style="background: ${couleur};">${cours.matiere}</span>` : '-'}
            </td>
            <td>${cours.professeur_prenom && cours.professeur_nom ? `${cours.professeur_prenom} ${cours.professeur_nom}` : '-'}</td>
            <td>${cours.salle || '-'}</td>
            <td>${cours.remarques || '-'}</td>
            <td>
              <div class="action-buttons">
                <button class="btn-edit" onclick="openEditModal(${cours.id})">✏️ Modifier</button>
                <button class="btn-delete" onclick="deleteCours(${cours.id})">🗑️ Supprimer</button>
              </div>
            </td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;
    });

    container.innerHTML = html;

  } catch (error) {
    console.error('❌ Erreur chargement emploi du temps:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--danger-color);">
        <p style="font-size: 1.2rem;">❌ Erreur lors du chargement</p>
        <p style="margin-top: 10px;">${error.message}</p>
        <button class="btn-secondary" onclick="loadSchedule()" style="margin-top: 20px;">
          🔄 Réessayer
        </button>
      </div>
    `;
  }
}

// ============================================
// Supprimer un cours
// ============================================
async function deleteCours(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce cours ?')) {
    return;
  }

  try {
    const response = await fetch(`/api/emploi-du-temps/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (response.ok) {
      showNotification('✅ Cours supprimé avec succès', 'success');
      loadSchedule(); // Recharger l'affichage
    } else {
      showNotification(`❌ ${result.error || 'Erreur lors de la suppression'}`, 'error');
    }
  } catch (error) {
    console.error('❌ Erreur:', error);
    showNotification('❌ Erreur de connexion au serveur', 'error');
  }
}

// ============================================
// Réinitialiser un formulaire
// ============================================
function resetForm(formId) {
  const form = document.getElementById(formId);
  if (form) {
    form.reset();
    showNotification('Formulaire réinitialisé', 'warning');
  }
}

// ============================================
// Configuration du color picker
// ============================================
function setupColorPicker() {
  const colorInput = document.getElementById('matiere_couleur');
  const colorPreview = document.getElementById('color-preview');

  if (colorInput && colorPreview) {
    colorInput.addEventListener('input', (e) => {
      colorPreview.textContent = e.target.value;
      colorPreview.style.borderColor = e.target.value;
    });
  }
}

// ============================================
// Afficher une notification
// ============================================
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');

  notification.textContent = message;
  notification.className = `notification ${type}`;

  // Forcer le reflow pour redémarrer l'animation
  notification.offsetHeight;

  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 4000);
}

// ============================================
// Configuration du formulaire d'édition
// ============================================
function setupEditForm() {
  const formEdit = document.getElementById('form-edit-cours');
  if (formEdit) {
    formEdit.addEventListener('submit', handleEditSubmit);
  }

  // Fermer le modal en cliquant en dehors
  const modal = document.getElementById('edit-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEditModal();
      }
    });
  }
}

// ============================================
// Ouvrir le modal de modification
// ============================================
function openEditModal(coursId) {
  const cours = state.emploiDuTemps.find(c => c.id === coursId);
  if (!cours) {
    showNotification('Cours introuvable', 'error');
    return;
  }

  // Remplir les champs
  document.getElementById('edit_cours_id').value = cours.id;
  document.getElementById('edit_jour').value = cours.jour;
  document.getElementById('edit_creneau').value = `${cours.creneau} (${cours.heure_debut?.substring(0,5)} - ${cours.heure_fin?.substring(0,5)})`;

  // Remplir les selects
  const editMatiereSelect = document.getElementById('edit_matiere_id');
  const editProfesseurSelect = document.getElementById('edit_professeur_id');

  // Vider et remplir le select matière
  editMatiereSelect.innerHTML = '<option value="">-- Aucune matière --</option>';
  state.matieres.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = m.nom;
    if (cours.matiere === m.nom) {
      option.selected = true;
    }
    editMatiereSelect.appendChild(option);
  });

  // Vider et remplir le select professeur
  editProfesseurSelect.innerHTML = '<option value="">-- Aucun professeur --</option>';
  state.professeurs.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `${p.prenom} ${p.nom}`;
    if (cours.professeur_prenom === p.prenom && cours.professeur_nom === p.nom) {
      option.selected = true;
    }
    editProfesseurSelect.appendChild(option);
  });

  // Remplir les autres champs
  document.getElementById('edit_salle').value = cours.salle || '';
  document.getElementById('edit_remarques').value = cours.remarques || '';

  // Afficher le modal
  const modal = document.getElementById('edit-modal');
  modal.classList.add('show');
}

// ============================================
// Fermer le modal de modification
// ============================================
function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  modal.classList.remove('show');

  // Réinitialiser le formulaire
  document.getElementById('form-edit-cours').reset();
}

// ============================================
// Gérer la soumission du formulaire d'édition
// ============================================
async function handleEditSubmit(e) {
  e.preventDefault();

  const coursId = document.getElementById('edit_cours_id').value;
  const formData = new FormData(e.target);

  const data = {
    matiere_id: formData.get('matiere_id') ? parseInt(formData.get('matiere_id')) : null,
    professeur_id: formData.get('professeur_id') ? parseInt(formData.get('professeur_id')) : null,
    salle: formData.get('salle') || null,
    remarques: formData.get('remarques') || null
  };

  try {
    const response = await fetch(`/api/emploi-du-temps/${coursId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showNotification('✅ Cours modifié avec succès !', 'success');
      closeEditModal();
      loadSchedule(); // Recharger l'affichage
    } else {
      showNotification(`❌ ${result.error || 'Erreur lors de la modification'}`, 'error');
    }
  } catch (error) {
    console.error('❌ Erreur:', error);
    showNotification('❌ Erreur de connexion au serveur', 'error');
  }
}

// ============================================
// Exposer les fonctions globalement
// ============================================
window.loadSchedule = loadSchedule;
window.deleteCours = deleteCours;
window.resetForm = resetForm;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
