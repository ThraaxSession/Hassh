// Login functionality
const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = '/';
        return;
    }

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const haUrl = document.getElementById('haUrl').value.trim();
    const haToken = document.getElementById('haToken').value.trim();

    if (!username || !haUrl || !haToken) {
        showError('All fields are required');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                ha_url: haUrl,
                ha_token: haToken
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();

        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('haUrl', haUrl);

        // Redirect to main page
        window.location.href = '/';
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.innerHTML = `<div class="error-message" style="margin-top: 20px;">${escapeHtml(message)}</div>`;
    setTimeout(() => errorDiv.innerHTML = '', 5000);
}
