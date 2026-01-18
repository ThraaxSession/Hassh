// Settings functionality
const API_BASE = '/api';
let authToken = '';

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadSettings();
    
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordChange);
    document.getElementById('haConfigForm').addEventListener('submit', handleHAConfig);
});

function checkAuth() {
    authToken = localStorage.getItem('token');
    if (!authToken) {
        window.location.href = '/login';
        return;
    }
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
}

async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`, {
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) throw new Error('Failed to load settings');

        const data = await response.json();
        
        // Pre-fill HA URL if exists
        if (data.ha_url) {
            document.getElementById('haUrl').value = data.ha_url;
        }

        // Show status
        if (data.has_ha_config) {
            document.getElementById('haConfigStatus').innerHTML = `
                <div class="success-message" style="margin-top: 15px;">
                    ✅ Home Assistant is configured
                </div>
            `;
        } else {
            document.getElementById('haConfigStatus').innerHTML = `
                <div class="warning" style="margin-top: 15px;">
                    ⚠️ Please configure your Home Assistant connection to use entity features
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    if (newPassword.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/settings/password`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to change password');
        }

        alert('Password changed successfully!');
        document.getElementById('passwordForm').reset();
    } catch (error) {
        console.error('Error changing password:', error);
        alert('Error: ' + error.message);
    }
}

async function handleHAConfig(e) {
    e.preventDefault();

    const haUrl = document.getElementById('haUrl').value.trim();
    const haToken = document.getElementById('haToken').value.trim();

    if (!haUrl || !haToken) {
        alert('All fields are required');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/settings/ha`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                ha_url: haUrl,
                ha_token: haToken
            })
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save configuration');
        }

        alert('Home Assistant configuration saved successfully!');
        document.getElementById('haToken').value = '';
        await loadSettings();
    } catch (error) {
        console.error('Error saving HA config:', error);
        alert('Error: ' + error.message);
    }
}
