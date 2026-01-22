// Register functionality
const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = '/';
        return;
    }

    // Check if admin already exists
    checkAdminExists();

    document.getElementById('registerForm').addEventListener('submit', handleRegister);
});

async function checkAdminExists() {
    try {
        const response = await fetch(`${API_BASE}/admin-exists`);
        const data = await response.json();
        
        if (data.exists) {
            // Admin exists - registration is disabled, redirect to login
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();

    if (!username) {
        showError('Username is required');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }

        const data = await response.json();

        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('username', data.user.username);

        // Show generated password
        showSuccess(data.generated_password, data.message);
    } catch (error) {
        console.error('Registration error:', error);
        showError(error.message);
    }
}

function showSuccess(password, message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `
        <div class="warning">
            <strong>⚠️ Important: Save your password!</strong><br>
            ${escapeHtml(message)}
        </div>
        <div class="password-display">
            <strong>Your Password:</strong><br>
            ${escapeHtml(password)}
        </div>
        <button onclick="continueToSettings()" class="btn btn-primary" style="width: 100%; margin-top: 20px;">
            Continue to Settings
        </button>
    `;
    
    // Hide the form
    document.getElementById('registerForm').style.display = 'none';
}

function continueToSettings() {
    window.location.href = '/settings';
}

function showError(message) {
    const container = document.getElementById('messageContainer');
    container.innerHTML = `<div class="error-message" style="margin-top: 20px;">${escapeHtml(message)}</div>`;
    setTimeout(() => container.innerHTML = '', 5000);
}
