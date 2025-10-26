// Ce script envoie un heartbeat pour signaler la présence de l'utilisateur sur le site
function sendLiveUserHeartbeat() {
  fetch('/api/live-user-heartbeat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

setInterval(sendLiveUserHeartbeat, 30000); // toutes les 30 secondes

document.addEventListener('DOMContentLoaded', sendLiveUserHeartbeat);