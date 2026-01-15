document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const rapportId = urlParams.get('id');

    if (!rapportId) {
        showNotification('Aucun rapport spécifié', 'error');
        window.location.href = '/liste-rapports-interrogatoire';
        return;
    }

    const loader = document.getElementById('loaderOverlay');
    const rapportContent = document.getElementById('rapportContent');

    // Bouton retour
    const backlinkBtn = document.getElementById('backlinkBtn');
    if (backlinkBtn) {
        backlinkBtn.addEventListener('click', () => {
            if (document.referrer && document.referrer.includes(window.location.host)) {
                window.history.back();
            } else {
                window.location.href = '/liste-rapports-interrogatoire';
            }
        });
    }

    // Charger le rapport
    try {
        loader.style.display = 'flex';

        const res = await fetch(`/api/rapports-interrogatoire/${rapportId}`);
        if (!res.ok) {
            throw new Error('Erreur lors du chargement du rapport');
        }

        const rapport = await res.json();

        // Remplir le formulaire avec les données du rapport
        // Convertir la date au format YYYY-MM-DD en préservant le fuseau horaire local
        const dateObj = new Date(rapport.date_interrogatoire);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateFormatted = `${year}-${month}-${day}`;
        document.getElementById('date').value = dateFormatted;
        document.getElementById('heure').value = rapport.heure_interrogatoire || '';
        document.getElementById('officier').value = rapport.officier_redacteur || '';
        document.getElementById('grade').value = rapport.grade_redacteur || '';
        
        // Remplir les textareas et ajuster leur hauteur automatiquement
        const recitTextarea = document.getElementById('recit');
        const infosTextarea = document.getElementById('infos_complementaires');
        
        recitTextarea.value = rapport.recit || '';
        infosTextarea.value = rapport.infos_complementaires || '';
        
        // Fonction pour auto-resize les textareas
        function autoResizeTextarea(textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            textarea.style.overflow = 'hidden';
        }
        
        autoResizeTextarea(recitTextarea);
        autoResizeTextarea(infosTextarea);

        // Afficher le citoyen sélectionné
        const selectedCitoyenContainer = document.getElementById('selectedCitoyen');
        if (rapport.citoyen_prenom && rapport.citoyen_nom) {
            selectedCitoyenContainer.innerHTML = `
                <div class="selected-item" style="cursor: pointer;" onclick="window.location.href='/view-citoyen?id=${rapport.citoyen_id}'">
                    <span>${rapport.citoyen_prenom} ${rapport.citoyen_nom}</span>
                </div>
            `;
        }

        // Désactiver tous les champs
        document.querySelectorAll('input, textarea, button').forEach(el => {
            if (el.id !== 'backlinkBtn') {
                el.disabled = true;
            }
        });

        // Masquer le bouton d'envoi
        const submitButton = document.querySelector('.send-button');
        if (submitButton) {
            submitButton.style.display = 'none';
        }

        // Masquer le bouton de sélection du citoyen
        const selectCitoyenBtn = document.getElementById('selectCitoyenBtn');
        if (selectCitoyenBtn) {
            selectCitoyenBtn.style.display = 'none';
        }

        // Masquer le lien ChatGPT
        const gptBtn = document.getElementById('gpt-btn');
        if (gptBtn) {
            gptBtn.style.display = 'none';
        }

    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors du chargement du rapport', 'error');
        rapportContent.innerHTML = `
            <div style="text-align: center; padding: 40px; color: red;">
                <p>Impossible de charger le rapport d'interrogatoire</p>
                <p>${error.message}</p>
            </div>
        `;
    } finally {
        loader.style.display = 'none';
    }
});
