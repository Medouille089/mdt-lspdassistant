// Client-side script for arme.html
document.addEventListener('DOMContentLoaded', async () => {
    const modelSelect = document.getElementById('model_select');
    const ownerSearch = document.getElementById('owner_search');
    const ownerResults = document.getElementById('owner_results');
    const ownerIdInput = document.getElementById('owner_id');
    const createCitizenBtn = document.getElementById('create_citizen_btn');
    const submitBtn = document.getElementById('submitWeapon');
    const serialInput = document.getElementById('serial_number');
    const loader = document.getElementById('loaderOverlay');

    // Load weapon models
    try {
        const res = await fetch('/api/weapon_models');
        if (res.ok) {
            const data = await res.json();
            (data.models || []).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.model_name;
                modelSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Erreur chargement modèles armes', e);
    }

    // Debounced search
    let timeout = null;
    ownerSearch.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => searchOwners(ownerSearch.value.trim()), 300);
    });

    async function searchOwners(q) {
        ownerResults.innerHTML = '';
        ownerIdInput.value = '';
        if (!q) return;
        try {
            const res = await fetch(`/api/citoyens?search=${encodeURIComponent(q)}&limit=10`);
            if (!res.ok) return;
            const data = await res.json();
            const list = data.citoyens || [];
            if (list.length === 0) {
                ownerResults.innerHTML = '<div style="color:#7f8c8d">Aucun citoyen trouvé</div>';
                return;
            }
            const ul = document.createElement('div');
            ul.style.display = 'flex';
            ul.style.flexDirection = 'column';
            ul.style.gap = '6px';
            list.forEach(c => {
                const el = document.createElement('div');
                el.className = 'search-result-item';
                el.style.padding = '6px';
                el.style.border = '1px solid #eee';
                el.style.borderRadius = '6px';
                el.style.cursor = 'pointer';
                el.textContent = `${c.prenom || ''} ${c.nom || ''} (${c.telephone || '-'})`;
                el.addEventListener('click', () => {
                    ownerIdInput.value = c.id;
                    ownerSearch.value = `${c.prenom || ''} ${c.nom || ''}`.trim();
                    ownerResults.innerHTML = '';
                });
                ul.appendChild(el);
            });
            ownerResults.appendChild(ul);
        } catch (e) {
            console.error('Erreur recherche citoyens', e);
        }
    }

    createCitizenBtn.addEventListener('click', () => {
        // Open citizen creation page in new tab
        window.open('/citoyen.html', '_blank');
    });

    submitBtn.addEventListener('click', async () => {
        const modelId = modelSelect.value;
        const serial = serialInput.value.trim();
        const ownerId = ownerIdInput.value || null;

        if (!modelId || !serial) {
            showNotification('Veuillez choisir un modèle et saisir le numéro de série', 'error');
            return;
        }

        loader.style.display = 'flex';
        try {
            const res = await fetch('/api/weapons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_id: modelId, serial_number: serial, owner_id: ownerId })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erreur serveur');
            }
            const data = await res.json();
            showNotification('Arme enregistrée', 'success');
            setTimeout(() => { window.location.href = `/view-citoyen.html?id=${ownerId || ''}`; }, 800);
        } catch (e) {
            console.error('Erreur enregistrement arme', e);
            showNotification(e.message || 'Erreur lors de l\'enregistrement', 'error');
        } finally {
            loader.style.display = 'none';
        }
    });

    // Back link
    document.getElementById('backlinkBtn').addEventListener('click', () => {
        window.history.back();
    });
});
