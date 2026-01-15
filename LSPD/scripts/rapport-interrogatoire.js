document.addEventListener("DOMContentLoaded", () => {
    // Initialisation des dates
    const now = new Date();
    const formatterDate = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' });
    const formatterTime = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris', hour12: false, hour: '2-digit', minute: '2-digit'
    });

    const dateInput = document.getElementById("date");
    if (dateInput) dateInput.value = formatterDate.format(now);

    const heureInput = document.getElementById("heure");
    if (heureInput) {
        const heureParts = formatterTime.formatToParts(now);
        const heure = heureParts.filter(p => p.type === 'hour' || p.type === 'minute')
            .map(p => p.value.padStart(2, '0'))
            .join(':');
        heureInput.value = heure;
    }

    // Chargement de l'utilisateur courant
    fetch("/api/user")
        .then((res) => res.json())
        .then((user) => {
            document.getElementById("officier").value = user.username;
            document.getElementById("grade").value = user.grade;
        })
        .catch((err) => {
            console.error("Erreur chargement utilisateur :", err);
            document.getElementById("officier").value = "Erreur de chargement";
        });

    // --- Sélection du citoyen interrogé ---
    let selectedCitoyen = null;

    const selectCitoyenBtn = document.getElementById('selectCitoyenBtn');
    const selectedCitoyenContainer = document.getElementById('selectedCitoyen');
    const citoyenIdInput = document.getElementById('citoyen_id');

    if (selectCitoyenBtn) {
        selectCitoyenBtn.addEventListener('click', () => {
            openCitoyenSelector((citoyenId, citoyenName, citoyen) => {
                if (!citoyen) {
                    showNotification('Erreur: aucun citoyen sélectionné', 'error');
                    return;
                }
                selectedCitoyen = { id: citoyenId, nom: citoyen.nom, prenom: citoyen.prenom, date_naissance: citoyen.date_naissance };
                updateCitoyenDisplay();
            });
        });
    }

    window.removeCitoyen = function() {
        selectedCitoyen = null;
        updateCitoyenDisplay();
    };

    function updateCitoyenDisplay() {
        if (!selectedCitoyen) {
            selectedCitoyenContainer.innerHTML = '';
            citoyenIdInput.value = '';
        } else {
            selectedCitoyenContainer.innerHTML = `
                <div class="selected-item">
                    <span>${selectedCitoyen.prenom} ${selectedCitoyen.nom}</span>
                    <span class="remove-btn" onclick="removeCitoyen()">&times;</span>
                </div>
            `;
            citoyenIdInput.value = selectedCitoyen.id;
        }
    }

    // --- Gestion du bouton retour ---
    const backlinkBtn = document.getElementById("backlinkBtn");
    if (backlinkBtn) {
        backlinkBtn.addEventListener("click", () => {
            if (document.referrer && document.referrer.includes(window.location.host)) {
                window.history.back();
            } else {
                window.location.href = "/liste-rapports-interrogatoire.html";
            }
        });
    }

    // --- Soumission du formulaire ---
    const form = document.getElementById("interrogatoireForm");
    let isEditMode = false;
    let editId = null;
    
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Si on est en mode édition, ne pas utiliser ce handler
            if (isEditMode) return;

            // Validation du citoyen
            if (!selectedCitoyen || !selectedCitoyen.id) {
                showNotification("Veuillez sélectionner un citoyen interrogé", "error");
                return;
            }

            const loaderOverlay = document.getElementById("loaderOverlay");
            if (loaderOverlay) loaderOverlay.style.display = "flex";

            try {
                const formData = {
                    date_interrogatoire: document.getElementById("date").value,
                    heure_interrogatoire: document.getElementById("heure").value,
                    officier_redacteur: document.getElementById("officier").value,
                    grade_redacteur: document.getElementById("grade").value,
                    citoyen_id: selectedCitoyen.id,
                    citoyen_nom: selectedCitoyen.nom,
                    citoyen_prenom: selectedCitoyen.prenom,
                    citoyen_date_naissance: selectedCitoyen.date_naissance,
                    droits_cites: true, // Toujours coché par défaut
                    recit: document.getElementById("recit").value,
                    infos_complementaires: document.getElementById("infos_complementaires").value || ""
                };

                const response = await fetch("/api/rapports-interrogatoire", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Erreur lors de l'envoi du rapport");
                }

                const result = await response.json();
                showNotification("Rapport d'interrogatoire créé avec succès", "success");

                // Redirection après succès
                setTimeout(() => {
                    window.location.href = "/liste-rapports-interrogatoire.html";
                }, 1500);

            } catch (error) {
                console.error("Erreur:", error);
                showNotification(error.message || "Une erreur est survenue", "error");
            } finally {
                if (loaderOverlay) loaderOverlay.style.display = "none";
            }
        });
    }

    // --- Gestion de l'édition (si ID dans l'URL) ---
    const urlParams = new URLSearchParams(window.location.search);
    editId = urlParams.get('edit');

    if (editId) {
        isEditMode = true;
        loadRapportForEdit(editId);
    }

    async function loadRapportForEdit(id) {
        const loaderOverlay = document.getElementById("loaderOverlay");
        if (loaderOverlay) loaderOverlay.style.display = "flex";

        try {
            const response = await fetch(`/api/rapports-interrogatoire/${id}`);
            if (!response.ok) throw new Error("Erreur lors du chargement du rapport");

            const rapport = await response.json();

            // Remplir le formulaire
            // Convertir la date au format YYYY-MM-DD en préservant le fuseau horaire local
            const dateObj = new Date(rapport.date_interrogatoire);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const dateFormatted = `${year}-${month}-${day}`;
            document.getElementById("date").value = dateFormatted;
            document.getElementById("heure").value = rapport.heure_interrogatoire;
            document.getElementById("officier").value = rapport.officier_redacteur;
            document.getElementById("grade").value = rapport.grade_redacteur;
            
            // Vérifier si l'élément droits_cites existe avant de le modifier
            const droitsCitesEl = document.getElementById("droits_cites");
            if (droitsCitesEl) {
                droitsCitesEl.checked = rapport.droits_cites;
            }
            
            document.getElementById("recit").value = rapport.recit;
            document.getElementById("infos_complementaires").value = rapport.infos_complementaires || "";

            // Charger le citoyen
            if (rapport.citoyen_id) {
                selectedCitoyen = {
                    id: rapport.citoyen_id,
                    nom: rapport.citoyen_nom,
                    prenom: rapport.citoyen_prenom,
                    date_naissance: rapport.citoyen_date_naissance
                };
                updateCitoyenDisplay();
            }

            // Changer le bouton d'envoi pour mise à jour
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = "Mettre à jour le rapport";
            }

            // Ajouter le handler de mise à jour
            form.addEventListener("submit", async (e) => {
                e.preventDefault();

                // Vérifier qu'on est bien en mode édition
                if (!isEditMode) return;

                if (!selectedCitoyen || !selectedCitoyen.id) {
                    showNotification("Veuillez sélectionner un citoyen interrogé", "error");
                    return;
                }

                if (loaderOverlay) loaderOverlay.style.display = "flex";

                try {
                    const formData = {
                        date_interrogatoire: document.getElementById("date").value,
                        heure_interrogatoire: document.getElementById("heure").value,
                        officier_redacteur: document.getElementById("officier").value,
                        grade_redacteur: document.getElementById("grade").value,
                        citoyen_id: selectedCitoyen.id,
                        citoyen_nom: selectedCitoyen.nom,
                        citoyen_prenom: selectedCitoyen.prenom,
                        citoyen_date_naissance: selectedCitoyen.date_naissance,
                        droits_cites: true,
                        recit: document.getElementById("recit").value,
                        infos_complementaires: document.getElementById("infos_complementaires").value || ""
                    };

                    const response = await fetch(`/api/rapports-interrogatoire/${editId}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(formData)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Erreur lors de la mise à jour");
                    }

                    showNotification("Rapport mis à jour avec succès", "success");

                    setTimeout(() => {
                        window.location.href = "/liste-rapports-interrogatoire.html";
                    }, 1500);

                } catch (error) {
                    console.error("Erreur:", error);
                    showNotification(error.message || "Une erreur est survenue", "error");
                } finally {
                    if (loaderOverlay) loaderOverlay.style.display = "none";
                }
            });

        } catch (error) {
            console.error("Erreur:", error);
            showNotification("Erreur lors du chargement du rapport", "error");
        } finally {
            if (loaderOverlay) loaderOverlay.style.display = "none";
        }
    }
});
