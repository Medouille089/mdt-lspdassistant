document.getElementById('resetForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();

    if (!username) {
        showError('Veuillez entrer votre nom d\'utilisateur');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
        const response = await fetch('/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess(data.message || 'Si ce compte existe, un lien de réinitialisation a été envoyé en message privé Discord.');
            document.getElementById('resetForm').reset();
        } else {
            showError(data.error || 'Erreur lors de l\'envoi du lien de réinitialisation');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur de connexion au serveur');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer le lien de réinitialisation';
    }
});

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    successDiv.style.display = 'none';
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    errorDiv.style.display = 'none';
    successDiv.textContent = message;
    successDiv.style.display = 'block';
}