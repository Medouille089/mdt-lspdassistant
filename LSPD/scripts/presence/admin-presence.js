const loader = document.getElementById('loaderOverlay');
const presenceList = document.getElementById('presence-list');

async function fetchPresenceData() {
    // Affiche le loader dès le début
    loader.style.display = 'flex';

    try {
        const res = await fetch('/api/presenceig/admin');
        if (!res.ok) throw new Error('Erreur chargement présences');

        const data = await res.json();
        renderPresence(data);

    } catch (err) {
        console.error(err);
        presenceList.innerHTML = '<div style="color:red">Erreur de chargement des présences.</div>';
    } finally {
        // Cache le loader à la fin, même en cas d'erreur
        loader.style.display = 'none';
    }
}

function renderPresence(data) {
    if (!Array.isArray(data) || data.length === 0) {
        presenceList.innerHTML = '<div>Aucun message de présence IG trouvé.</div>';
        return;
    }

    presenceList.innerHTML = '';
    data.forEach(msg => {
        const createdAt = new Date(msg.timestamp).toLocaleDateString();
        const card = document.createElement('div');
        card.className = 'presence-card';
        card.innerHTML = `
            <div class="presence-message">${createdAt}</div>
            <div class="reactions-list">
                ${msg.reactions.map(r => `
                    <div class="reaction-block">
                        <div class="reaction-title">${r.emoji}</div>
                        <ul class="voters-list">
                            ${r.users.length === 0 ? '<li>Aucun vote</li>' : ''}
                            ${r.users.map(u => `<li>${u.username}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
            <div class="absent-list">
                <div class="absent-title">Membres n'ayant pas voté :</div>
                <ul class="voters-list">
                    ${msg.notVoted.map(u => `<li>${u.username}</li>`).join('')}
                </ul>
            </div>
        `;
        presenceList.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', fetchPresenceData);
