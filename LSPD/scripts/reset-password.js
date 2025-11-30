// Password viewer logic
const passwordInputField = document.getElementById('password');
const confirmInputField = document.getElementById('confirmPassword');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const toggleConfirmBtn = document.getElementById('toggleConfirmBtn');
const eyePassword = document.getElementById('eyePassword');
const eyeConfirm = document.getElementById('eyeConfirm');

togglePasswordBtn.addEventListener('click', function () {
    if (passwordInputField.type === 'password') {
        passwordInputField.type = 'text';
        eyePassword.textContent = 'visibility_off';
    } else {
        passwordInputField.type = 'password';
        eyePassword.textContent = 'visibility';
    }
});
toggleConfirmBtn.addEventListener('click', function () {
    if (confirmInputField.type === 'password') {
        confirmInputField.type = 'text';
        eyeConfirm.textContent = 'visibility_off';
    } else {
        confirmInputField.type = 'password';
        eyeConfirm.textContent = 'visibility';
    }
});
// Récupérer le token depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

if (!token) {
    showError('Lien de réinitialisation invalide ou expiré');
    document.getElementById('submitBtn').disabled = true;
}

// Validation du mot de passe en temps réel
const passwordInput = document.getElementById('password');
const strengthBar = document.getElementById('strengthBar');

passwordInput.addEventListener('input', function () {
    const password = this.value;
    const strength = calculatePasswordStrength(password);

    strengthBar.className = 'password-strength-bar';
    if (strength >= 80) {
        strengthBar.classList.add('strength-strong');
    } else if (strength >= 50) {
        strengthBar.classList.add('strength-medium');
    } else if (strength > 0) {
        strengthBar.classList.add('strength-weak');
    }
});

function calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
    return strength;
}

document.getElementById('resetPasswordForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showError('Les mots de passe ne correspondent pas');
        return;
    }

    if (password.length < 8) {
        showError('Le mot de passe doit contenir au moins 8 caractères');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Réinitialisation en cours...';

    try {
        const response = await fetch('/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token, password })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess('Mot de passe réinitialisé avec succès ! Redirection...');
            setTimeout(() => {
                window.location.href = '/connect';
            }, 2000);
        } else {
            showError(data.error || 'Erreur lors de la réinitialisation du mot de passe');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Réinitialiser le mot de passe';
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur de connexion au serveur');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Réinitialiser le mot de passe';
    }
});

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    successDiv.style.display = 'none';
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    errorDiv.style.display = 'none';
    successDiv.textContent = message;
    successDiv.style.display = 'block';
}
