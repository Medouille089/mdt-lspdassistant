async function fetchUser() {
    const res = await fetch('/api/user');
    if (!res.ok) throw new Error('Non connecté');
    const user = await res.json();

    document.getElementById('messageUsername').innerHTML = `Bonjour <strong>${user.username}</strong>`;
    document.getElementById('messageGrade').textContent = user.grade || '';
    document.getElementById('overlayMessage').innerHTML = `Bonjour <strong>${user.username}</strong>`;
    document.getElementById('overlayGrade').textContent = user.grade || '';

    const now = Date.now();
    const lastSeen = localStorage.getItem('overlayLastSeen');
    const delay = 3600000;

    if (!lastSeen || now - lastSeen > delay) {
        showOverlay();
        localStorage.setItem('overlayLastSeen', now);
    }
}

function showOverlay() {
    const overlay = document.getElementById('overlay');
    overlay.classList.add('show');

    setTimeout(() => {
        overlay.classList.add('hide');
    }, 2000);

    overlay.addEventListener('animationend', () => {
        overlay.classList.remove('show', 'hide');
        overlay.style.display = 'none';
    }, { once: true });
}

fetchUser();