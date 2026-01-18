// Login functionality
const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = '/';
        return;
    }

    // Check if admin exists
    checkAdminExists();

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

async function checkAdminExists() {
    try {
        const response = await fetch(`${API_BASE}/admin-exists`);
        const data = await response.json();
        
        if (!data.exists) {
            // No admin exists - show setup button
            document.getElementById('setupMessage').style.display = 'block';
            document.getElementById('contactMessage').style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showError('All fields are required');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                password: password
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
        localStorage.setItem('is_admin', data.is_admin ? 'true' : 'false');

        // Check if password change or HA config is required
        if (data.require_password_change) {
            alert('Please change your password in Settings');
            window.location.href = '/settings';
        } else if (!data.has_ha_config) {
            alert('Please configure your Home Assistant connection in Settings');
            window.location.href = '/settings';
        } else {
            window.location.href = '/';
        }
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
