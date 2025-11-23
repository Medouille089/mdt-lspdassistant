
let delitsDatabase = {
    'Contravention': [],
    'Délit mineur': [],
    'Délit majeur': [],
    'Crime': []
};

let delitsAjoutes = [];
let isDataLoaded = false;
let selectedDelit = null;
let allDelits = [];

function formatCurrency(value) {
    if (typeof value === 'string') {
        value = value.replace(/[^0-9]/g, '');
    }
    return '$' + parseInt(value).toLocaleString('en-US');
}

function formatTime(value) {
    if (typeof value === 'string' && value.includes(':')) {
        const parts = value.split(':');
        if (parts.length === 3) {
            return value.substring(0, 5);
        }
        return value;
    }
    return '00:00';
}

function timeToMinutes(timeStr) {
    if (!timeStr || timeStr === '0') return 0;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

document.addEventListener('DOMContentLoaded', async function () {
    await loadDelitsFromDatabase();

    const searchInput = document.getElementById('searchDelit');
    const searchResults = document.getElementById('searchResults');
    const clearSelectionBtn = document.getElementById('clearSelection');

    searchInput.addEventListener('input', function () {
        const query = this.value.trim().toLowerCase();

        if (query.length < 2) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            return;
        }

        const results = allDelits.filter(delit => {
            const nomMatch = delit.nom.toLowerCase().includes(query);
            const codeMatch = delit.code_article.toLowerCase().includes(query);
            const categorieMatch = delit.categorie.toLowerCase().includes(query);
            return nomMatch || codeMatch || categorieMatch;
        });

        displaySearchResults(results);
    });

    document.addEventListener('click', function (e) {
        if (!searchResults.contains(e.target) && e.target !== searchInput) {
            searchResults.style.display = 'none';
        }
    });

    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', function () {
            clearDelitSelection();
        });
    }

    const backlinkBtn = document.getElementById('backlinkBtn');
    if (backlinkBtn) {
        backlinkBtn.addEventListener('click', function () {
            window.history.back();
        });
    }

    const ajouterDelitBtn = document.getElementById('ajouterDelitBtn');
    if (ajouterDelitBtn) {
        ajouterDelitBtn.addEventListener('click', ajouterDelit);
    }

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            showConfirm('Êtes-vous sûr de vouloir réinitialiser tous les délits ?', function(confirmed) {
                if (confirmed) {
                    delitsAjoutes = [];
                    afficherDelits();
                    calculerTotaux();
                }
            });
        });
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exporterCalcul);
    }

    setupPeineClickHandlers();
});

async function loadDelitsFromDatabase() {
    try {
        const response = await fetch('/api/getDelits');
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des délits');
        }

        const delits = await response.json();

        delitsDatabase = {
            'Contravention': [],
            'Délit mineur': [],
            'Délit majeur': [],
            'Crime': []
        };

        allDelits = [];

        delits.forEach(delit => {
            const categorieNormalized = delit.type || 'Contravention';

            const delitObj = {
                id: delit.id,
                nom: delit.chef_accusation,
                code_article: delit.code_article,
                amendes: delit.amende || '$0',
                peines: delit.peine || '00:00',
                special: delit.commentaire || '',
                categorie: categorieNormalized
            };

            if (delitsDatabase[categorieNormalized]) {
                delitsDatabase[categorieNormalized].push(delitObj);
            }

            allDelits.push(delitObj);
        });

        isDataLoaded = true;

    } catch (error) {
        console.error('Erreur chargement délits:', error);
        showNotification('Erreur lors du chargement des délits depuis la base de données', 'error');
    }
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('searchResults');

    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item no-results">Aucun résultat trouvé</div>';
        searchResults.style.display = 'block';
        return;
    }

    searchResults.innerHTML = '';
    results.slice(0, 10).forEach(delit => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="result-main">
                <strong>${delit.code_article}</strong> - ${delit.nom}
            </div>
            <div class="result-details">
                <span class="result-category">${delit.categorie}</span>
                <span class="result-info">${formatCurrency(delit.amendes)} | ${formatTime(delit.peines)}</span>
            </div>
        `;

        div.addEventListener('click', function () {
            selectDelit(delit);
        });

        searchResults.appendChild(div);
    });

    searchResults.style.display = 'block';
}

function selectDelit(delit) {
    selectedDelit = delit;

    const searchInput = document.getElementById('searchDelit');
    const searchResults = document.getElementById('searchResults');
    const selectedDisplay = document.getElementById('selectedDelitDisplay');
    const selectedText = document.getElementById('selectedDelitText');

    searchResults.style.display = 'none';
    searchInput.value = '';

    selectedText.innerHTML = `
        <strong>${delit.code_article}</strong> - ${delit.nom}
        <span class="category-badge">${delit.categorie}</span>
    `;
    selectedDisplay.style.display = 'block';
}

function clearDelitSelection() {
    selectedDelit = null;

    const selectedDisplay = document.getElementById('selectedDelitDisplay');
    selectedDisplay.style.display = 'none';
}

function ajouterDelit() {
    if (!selectedDelit) {
        showNotification('Veuillez rechercher et sélectionner un chef d\'accusation', 'warning');
        return;
    }

    const qteInput = document.getElementById('qte');
    const tentativeSelect = document.getElementById('tentative');
    const compliciteSelect = document.getElementById('complicite');
    const avocatSelect = document.getElementById('avocat');

    const qte = parseInt(qteInput.value) || 1;
    const tentative = tentativeSelect.value;
    const complicite = compliciteSelect.value;
    const avocat = avocatSelect.value;

    const delit = {
        categorie: selectedDelit.categorie,
        code_article: selectedDelit.code_article,
        nom: selectedDelit.nom,
        qte: qte,
        tentative: tentative,
        complicite: complicite,
        avocat: avocat,
        amendes: selectedDelit.amendes,
        peines: selectedDelit.peines,
        special: selectedDelit.special
    };

    delitsAjoutes.push(delit);
    afficherDelits();
    calculerTotaux();

    clearDelitSelection();
    qteInput.value = 1;
    tentativeSelect.value = 'Non';
    compliciteSelect.value = 'Non';
    avocatSelect.value = 'Non';
}

function afficherDelits() {
    const tbody = document.getElementById('tableauDelitsBody');
    tbody.innerHTML = '';

    if (delitsAjoutes.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="10" style="text-align: center; color: var(--text-muted);">Aucun délit ajouté</td></tr>';
        return;
    }

    delitsAjoutes.forEach((delit, index) => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
      <td>${delit.categorie}</td>
      <td>${delit.code_article || '-'}</td>
      <td>${delit.nom}</td>
      <td>${delit.qte}</td>
      <td>${delit.tentative}</td>
      <td>${delit.complicite}</td>
      <td>${delit.avocat}</td>
      <td>${formatCurrency(delit.amendes)}</td>
      <td>${formatTime(delit.peines)}</td>
      <td>${delit.special}</td>
      <td><button class="delete-btn" onclick="supprimerDelit(${index})">Supprimer</button></td>
    `;
        tbody.appendChild(tr);
    });
}

function supprimerDelit(index) {
    delitsAjoutes.splice(index, 1);
    afficherDelits();
    calculerTotaux();
}

function calculerTotaux() {
    let totalAmendes = 0;
    let totalPeinesMinutes = 0;

    delitsAjoutes.forEach(delit => {
        let amendeValue = parseInt(delit.amendes.replace(/[^0-9]/g, ''));
        amendeValue *= delit.qte;

        totalAmendes += amendeValue;

        let peineMinutes = timeToMinutes(delit.peines);
        peineMinutes *= delit.qte;

        totalPeinesMinutes += peineMinutes;
    });

    document.getElementById('totalAmendes').textContent = formatCurrency(totalAmendes);
    document.getElementById('totalPeines').textContent = minutesToTime(totalPeinesMinutes);

    // Calculer les peines
    const min1 = Math.round(Math.max(0, totalPeinesMinutes * 0.5));
    const min2 = Math.round(Math.max(0, totalPeinesMinutes * 0.75));
    const min3 = Math.round(Math.max(0, totalPeinesMinutes * 0.85));

    document.getElementById('min1Value').textContent = minutesToTime(min1);
    document.getElementById('min2Value').textContent = minutesToTime(min2);
    document.getElementById('min3Value').textContent = minutesToTime(min3);

    document.getElementById('nominalValue').textContent = minutesToTime(totalPeinesMinutes);

    const max1 = totalPeinesMinutes + Math.round(totalPeinesMinutes * 0.25); // +25%
    const max2 = totalPeinesMinutes + Math.round(totalPeinesMinutes * 0.5); // +50%

    document.getElementById('max1Value').textContent = minutesToTime(max1);
    document.getElementById('max2Value').textContent = minutesToTime(max2);

    // Calculer et afficher les amendes correspondantes
    const min1Amende = Math.round(totalAmendes * 0.5);
    const min2Amende = Math.round(totalAmendes * 0.75);
    const min3Amende = Math.round(totalAmendes * 0.85);
    const nominalAmende = totalAmendes;
    const max1Amende = Math.round(totalAmendes * 1.25);
    const max2Amende = Math.round(totalAmendes * 1.5);

    document.getElementById('min1Amende').textContent = formatCurrency(min1Amende);
    document.getElementById('min2Amende').textContent = formatCurrency(min2Amende);
    document.getElementById('min3Amende').textContent = formatCurrency(min3Amende);
    document.getElementById('nominalAmende').textContent = formatCurrency(nominalAmende);
    document.getElementById('max1Amende').textContent = formatCurrency(max1Amende);
    document.getElementById('max2Amende').textContent = formatCurrency(max2Amende);

    document.querySelectorAll('.peine-item').forEach(item => {
        item.classList.remove('selected');
    });

    const peinesCard = document.getElementById('peinesCard');
    if (peinesCard) {
        peinesCard.classList.remove('peine-min', 'peine-nominal', 'peine-max');
    }

    if (delitsAjoutes.length > 0) {
        highlightSelectedPeine('nominal');
        updatePeinesCardColor('nominal');
    }
}

function setupPeineClickHandlers() {
    const peineItems = [
        { id: 'min1Value', type: 'min1', multiplier: 0.5 },
        { id: 'min2Value', type: 'min2', multiplier: 0.75 },
        { id: 'min3Value', type: 'min3', multiplier: 0.85 },
        { id: 'nominalValue', type: 'nominal', multiplier: 1.0 },
        { id: 'max1Value', type: 'max1', multiplier: 1.25 },
        { id: 'max2Value', type: 'max2', multiplier: 1.5 }
    ];

    peineItems.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) {
            element.style.cursor = 'pointer';
            element.parentElement.style.cursor = 'pointer';

            element.parentElement.addEventListener('click', function () {
                applySelectedPeine(item.type, item.multiplier);
            });
        }
    });
}

function applySelectedPeine(type, multiplier) {
    if (delitsAjoutes.length === 0) {
        showNotification('Aucun délit ajouté pour calculer les peines', 'warning');
        return;
    }

    let baseAmendes = 0;
    let basePeinesMinutes = 0;

    delitsAjoutes.forEach(delit => {
        let amendeValue = parseInt(delit.amendes.replace(/[^0-9]/g, ''));
        amendeValue *= delit.qte;
        baseAmendes += amendeValue;

        let peineMinutes = timeToMinutes(delit.peines);
        peineMinutes *= delit.qte;
        basePeinesMinutes += peineMinutes;
    });

    const adjustedPeinesMinutes = Math.round(basePeinesMinutes * multiplier);
    const adjustedAmendes = Math.round(baseAmendes * multiplier);

    document.getElementById('totalAmendes').textContent = formatCurrency(adjustedAmendes);
    document.getElementById('totalPeines').textContent = minutesToTime(adjustedPeinesMinutes);

    highlightSelectedPeine(type);

    updatePeinesCardColor(type);
}

function highlightSelectedPeine(selectedType) {
    document.querySelectorAll('.peine-item').forEach(item => {
        item.classList.remove('selected');
    });

    const peineElements = {
        'min1': document.getElementById('min1Value'),
        'min2': document.getElementById('min2Value'),
        'min3': document.getElementById('min3Value'),
        'nominal': document.getElementById('nominalValue'),
        'max1': document.getElementById('max1Value'),
        'max2': document.getElementById('max2Value')
    };

    const selectedElement = peineElements[selectedType];
    if (selectedElement) {
        selectedElement.parentElement.classList.add('selected');
    }
}

function updatePeinesCardColor(type) {
    const peinesCard = document.getElementById('peinesCard');
    const amendesCard = document.getElementById('amendesCard');
    if (!peinesCard || !amendesCard) return;

    peinesCard.classList.remove('peine-min', 'peine-nominal', 'peine-max');
    amendesCard.classList.remove('peine-min', 'peine-nominal', 'peine-max');

    if (type === 'min1' || type === 'min2' || type === 'min3') {
        peinesCard.classList.add('peine-min');
        amendesCard.classList.add('peine-min');
    } else if (type === 'nominal') {
        peinesCard.classList.add('peine-nominal');
        amendesCard.classList.add('peine-nominal');
    } else if (type === 'max1' || type === 'max2') {
        peinesCard.classList.add('peine-max');
        amendesCard.classList.add('peine-max');
    }
}

async function exporterCalcul() {
    if (delitsAjoutes.length === 0) {
        showNotification('Aucun délit à exporter. Veuillez d\'abord ajouter des délits.', 'warning');
        return;
    }

    try {
    const exportBtn = document.getElementById('exportBtn');
    const originalText = exportBtn.textContent;
    exportBtn.textContent = 'Exportation en cours...';
    exportBtn.disabled = true;
    // Affiche le loader
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

        const tableauSection = document.querySelector('.tableau-section');
        const totauxSection = document.querySelector('.totaux-section');

        if (!tableauSection || !totauxSection) {
            throw new Error('Sections non trouvées');
        }

        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = 'position: absolute; left: -9999px; top: 0; background: white; padding: 30px;';

        // Clone tableau and remove Action column and delete buttons
        const tableauClone = tableauSection.cloneNode(true);
        const theadRow = tableauClone.querySelector('thead tr');
        if (theadRow) {
            // Remove last th (Action)
            theadRow.removeChild(theadRow.lastElementChild);
        }
        const tbodyRows = tableauClone.querySelectorAll('tbody tr');
        tbodyRows.forEach(tr => {
            if (tr.children.length > 0) {
                tr.removeChild(tr.lastElementChild); // Remove last td (button)
            }
        });

        const totauxClone = totauxSection.cloneNode(true);
        const actionsSection = totauxClone.querySelector('.actions-section');
        if (actionsSection) {
            actionsSection.style.display = 'none';
        }

        tempContainer.appendChild(tableauClone);
        tempContainer.appendChild(totauxClone);

        document.body.appendChild(tempContainer);

        // Fixe une largeur obligatoire pour la capture (ex: 1200px)
        const fixedWidth = 1200;
        tempContainer.style.width = fixedWidth + 'px';
        tempContainer.style.maxWidth = fixedWidth + 'px';
        tempContainer.style.minWidth = fixedWidth + 'px';

        const canvas = await html2canvas(tempContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            width: fixedWidth,
            height: tempContainer.scrollHeight
        });

    document.body.removeChild(tempContainer);
    // Masque le loader
    if (loader) loader.style.display = 'none';

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        const formData = new FormData();
        formData.append('screenshot', blob, 'calcul-peines.png');

        const response = await fetch('/api/exportCalculPeines', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de l\'exportation');
        }

        const result = await response.json();

                exportBtn.textContent = originalText;
                exportBtn.disabled = false;

                // Affiche le checkmark SVG de succès
                let feedback = document.getElementById('feedbackAnimation');
                if (!feedback) {
                        feedback = document.createElement('div');
                        feedback.id = 'feedbackAnimation';
                        feedback.className = 'feedback-animation';
                        document.body.appendChild(feedback);
                }
                feedback.innerHTML = `<div class=\"feedback-inner\">
                    <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 130.2 130.2\">
                        <circle class=\"path circle\" fill=\"none\" stroke=\"#0b1b5a\" stroke-width=\"8\" stroke-miterlimit=\"10\" cx=\"65.1\" cy=\"65.1\" r=\"60\"/>
                        <polyline class=\"path check\" fill=\"none\" stroke=\"#0b1b5a\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" points=\"100.2,40.2 51.5,88.8 29.8,67.5 \"/>
                    </svg>
                    <p class=\"success\">Exportation réussie !</p>
                </div>`;
                feedback.style.display = 'flex';
                setTimeout(() => {
                        feedback.style.display = 'none';
                }, 2000);

    } catch (error) {
        console.error('Erreur lors de l\'exportation:', error);
        showNotification('Erreur lors de l\'exportation: ' + error.message, 'error');

        const exportBtn = document.getElementById('exportBtn');
        exportBtn.textContent = 'Exporter';
        exportBtn.disabled = false;
    }
}
