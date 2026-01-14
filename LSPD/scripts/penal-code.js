// LSPD/scripts/penal-code.js

document.addEventListener('DOMContentLoaded', async () => {
    const delitsTbody = document.getElementById('delitsTbody');
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const loader = document.getElementById('loaderOverlay');

    let allDelits = [];

    // Charger les délits
    async function loadDelits() {
        loader.style.display = 'flex';
        try {
            const res = await fetch('/api/getDelits');
            if (!res.ok) throw new Error('Erreur lors du chargement');
            allDelits = await res.json();
            filterAndRender();
        } catch (err) {
            console.error(err);
            showNotification('Erreur lors du chargement des délits', 'error');
        } finally {
            loader.style.display = 'none';
        }
    }

    function renderDelits(delits) {
        delitsTbody.innerHTML = '';

        // Tri par type : Contravention > Délit mineur > Délit majeur > Crime
        const typeOrder = {
            'contravention': 1,
            'délit mineur': 2,
            'délit majeur': 3,
            'crime': 4
        };

        const sortedDelits = [...delits].sort((a, b) => {
            const orderA = typeOrder[a.type?.toLowerCase()] || 99;
            const orderB = typeOrder[b.type?.toLowerCase()] || 99;
            
            if (orderA !== orderB) return orderA - orderB;
            return (a.code_article || '').localeCompare(b.code_article || '') || a.chef_accusation.localeCompare(b.chef_accusation);
        });

        sortedDelits.forEach(delit => {
            const tr = document.createElement('tr');
            
            let typeClass = '';
            const type = delit.type?.toLowerCase() || '';
            if (type.includes('contravention')) typeClass = 'type-contravention';
            else if (type.includes('mineur')) typeClass = 'type-delit-mineur';
            else if (type.includes('majeur')) typeClass = 'type-delit-majeur';
            else if (type.includes('crime')) typeClass = 'type-crime';

            tr.innerHTML = `
                <td>${delit.code_article || '-'}</td>
                <td><strong>${delit.chef_accusation}</strong><br><small style="color: #666;">${delit.commentaire || ''}</small></td>
                <td><span class="type-badge ${typeClass}">${delit.type}</span></td>
                <td>${delit.amende || '-'}</td>
                <td>${delit.peine || '-'}</td>
            `;
            delitsTbody.appendChild(tr);
        });
    }

    function filterAndRender() {
        const query = searchInput.value.toLowerCase();
        const typeValue = typeFilter.value;

        const filtered = allDelits.filter(d => {
            const matchesSearch = d.chef_accusation.toLowerCase().includes(query) || 
                                 (d.code_article && d.code_article.toLowerCase().includes(query)) ||
                                 d.type.toLowerCase().includes(query);
            
            const matchesType = typeValue === 'all' || d.type === typeValue;

            return matchesSearch && matchesType;
        });

        renderDelits(filtered);
    }

    searchInput.addEventListener('input', filterAndRender);
    typeFilter.addEventListener('change', filterAndRender);

    loadDelits();
});
