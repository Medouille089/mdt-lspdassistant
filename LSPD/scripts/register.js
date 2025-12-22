// Password viewer
const passwordInputField = document.getElementById('password');
const confirmInputField = document.getElementById('confirmPassword');
const togglePasswordBtn = document.getElementById('togglePassword');
const toggleConfirmBtn = document.getElementById('toggleConfirmPassword');
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
// Récupérer les infos Discord de l'utilisateur
fetch('/api/user/discord-info')
    .then(res => res.json())
    .then(data => {
        if (data.discord_id) {
            document.getElementById('userAvatar').src = data.avatar || 'data/images/officier.png';
            document.getElementById('discordUsername').textContent = data.displayName || data.username || 'Utilisateur Discord';
        } else {
            window.location.href = '/login';
        }
    })
    .catch(err => {
        console.error('Erreur:', err);
        showError('Impossible de récupérer vos informations Discord');
    });

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

// Soumission du formulaire
document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validation
    if (password !== confirmPassword) {
        showError('Les mots de passe ne correspondent pas');
        return;
    }

    if (password.length < 8) {
        showError('Le mot de passe doit contenir au moins 8 caractères');
        return;
    }

    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
        showError('Le nom d\'utilisateur doit contenir entre 3 et 30 caractères (lettres, chiffres, tirets et underscores uniquement)');
        return;
    }

    // Désactiver le bouton pendant la soumission
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Création en cours...';

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
                body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess('Compte créé avec succès ! Redirection...');
            setTimeout(() => {
                window.location.href = data.redirect || '/protected';
            }, 1500);
        } else {
            showError(data.error || 'Erreur lors de la création du compte');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Créer mon compte';
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur de connexion au serveur');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Créer mon compte';
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
