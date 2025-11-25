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

      const formData = {
        nom: document.getElementById('nom').value.trim(),
        prenom: document.getElementById('prenom').value.trim(),
        date_naissance: document.getElementById('date_naissance').value,
        nationalite: document.getElementById('nationalite').value.trim(),
        genre: document.getElementById('genre').value,
        telephone: telephoneFormatted,
        emploi: document.getElementById('emploi').value.trim() || null,
        mandat_actif: document.getElementById('mandat_actif').value === 'true',
        photo: document.getElementById('photo').value.trim() || null,
        created_by: user.username
      };

      const response = await fetch('/api/citoyens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        showNotification('✓ Citoyen enregistré avec succès', 'success');
        setTimeout(() => {
          window.location.href = '/liste-citoyens.html';
        }, 1500);
      } else {
        let errorMessage = 'Erreur lors de l\'enregistrement';
        try {
          const result = await response.json();
          errorMessage = result.error || errorMessage;
        } catch (e) {
          // Si le JSON parsing échoue, utiliser le message par défaut
        }
        showNotification(errorMessage, 'error');
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

    // Form submission
    form.addEventListener('submit', submitForm);

    // Formatage automatique du téléphone
    telephoneInput.addEventListener('input', function(e) {
      const cursorPosition = e.target.selectionStart;
      const oldLength = e.target.value.length;
      
      e.target.value = formatPhoneNumber(e.target.value);
      
      const newLength = e.target.value.length;
      const diff = newLength - oldLength;
      
      // Ajuster la position du curseur si le formatage a ajouté des caractères
      if (diff > 0) {
        e.target.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
      } else {
        e.target.setSelectionRange(cursorPosition, cursorPosition);
      }
    });
  });
})();
