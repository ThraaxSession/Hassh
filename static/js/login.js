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

        // Check if OTP is required
        if (data.otp_required) {
            showOTPInput(username, password);
            return;
        }

        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('is_admin', data.is_admin ? 'true' : 'false');

        // Check if password change or HA config is required
        if (data.require_password_change) {
            await Dialog.alert('Please change your password in Settings', 'Password Change Required', 'warning');
            window.location.href = '/settings';
        } else if (!data.has_ha_config) {
            await Dialog.alert('Please configure your Home Assistant connection in Settings', 'Configuration Required', 'info');
            window.location.href = '/settings';
        } else {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message);
    }
}

function showOTPInput(username, password) {
    // Hide login form, show OTP form
    document.getElementById('loginForm').style.display = 'none';
    
    const otpFormHTML = `
        <div id="otpForm">
            <h3 style="margin-bottom: 20px; color: var(--text-primary);">Enter Two-Factor Code</h3>
            <p style="margin-bottom: 20px; color: var(--text-secondary);">Enter the 6-digit code from your authenticator app or use a backup code.</p>
            <form id="otpVerifyForm" class="login-form">
                <div class="form-group">
                    <label>Verification Code:</label>
                    <input type="text" id="otpCode" placeholder="6-digit code or backup code" maxlength="8" required autocomplete="off" />
                </div>
                <button type="submit" class="btn btn-primary">Verify</button>
                <button type="button" onclick="cancelOTP()" class="btn btn-secondary" style="margin-top: 10px;">Back</button>
            </form>
            <div id="otpError"></div>
        </div>
    `;
    
    const formContainer = document.querySelector('.login-card');
    if (formContainer) {
        formContainer.insertAdjacentHTML('beforeend', otpFormHTML);
        
        document.getElementById('otpVerifyForm').addEventListener('submit', (e) => handleOTPVerify(e, username, password));
    } else {
        console.error('Login card container not found');
    }
}

function cancelOTP() {
    const otpForm = document.getElementById('otpForm');
    if (otpForm) {
        otpForm.remove();
    }
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('loginForm').reset();
}

async function handleOTPVerify(e, username, password) {
    e.preventDefault();

    const code = document.getElementById('otpCode').value.trim();

    if (!code) {
        showOTPError('Verification code is required');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                password: password,
                code: code
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Verification failed');
        }

        const data = await response.json();

        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('is_admin', data.is_admin ? 'true' : 'false');

        // Check if password change or HA config is required
        if (data.require_password_change) {
            await Dialog.alert('Please change your password in Settings', 'Password Change Required', 'warning');
            window.location.href = '/settings';
        } else if (!data.has_ha_config) {
            await Dialog.alert('Please configure your Home Assistant connection in Settings', 'Configuration Required', 'info');
            window.location.href = '/settings';
        } else {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('OTP verification error:', error);
        showOTPError(error.message);
    }
}

function showOTPError(message) {
    const errorDiv = document.getElementById('otpError');
    errorDiv.innerHTML = `<div class="error-message" style="margin-top: 20px;">${escapeHtml(message)}</div>`;
    setTimeout(() => errorDiv.innerHTML = '', 5000);
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.innerHTML = `<div class="error-message" style="margin-top: 20px;">${escapeHtml(message)}</div>`;
    setTimeout(() => errorDiv.innerHTML = '', 5000);
}
