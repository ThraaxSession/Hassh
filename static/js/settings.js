// Settings functionality
const API_BASE = '/api';
let authToken = '';
let currentOTPSecret = '';

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadSettings();
    loadOTPStatus();
    
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordChange);
    document.getElementById('haConfigForm').addEventListener('submit', handleHAConfig);
    document.getElementById('otpEnableForm').addEventListener('submit', handleOTPEnable);
    document.getElementById('otpDisableFormElement').addEventListener('submit', handleOTPDisable);
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
        Toast.error('New passwords do not match');
        return;
    }

    if (newPassword.length < 8) {
        Toast.error('Password must be at least 8 characters long');
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

        Toast.success('Password changed successfully!');
        document.getElementById('passwordForm').reset();
    } catch (error) {
        console.error('Error changing password:', error);
        Toast.error(error.message);
    }
}

async function handleHAConfig(e) {
    e.preventDefault();

    const haUrl = document.getElementById('haUrl').value.trim();
    const haToken = document.getElementById('haToken').value.trim();

    if (!haUrl || !haToken) {
        Toast.error('All fields are required');
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

        Toast.success('Home Assistant configuration saved successfully!');
        document.getElementById('haToken').value = '';
        await loadSettings();
    } catch (error) {
        console.error('Error saving HA config:', error);
        Toast.error(error.message);
    }
}

// OTP Functions
async function loadOTPStatus() {
    try {
        const response = await fetch(`${API_BASE}/settings`, {
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) throw new Error('Failed to load OTP status');

        const data = await response.json();
        const otpEnabled = data.otp_enabled || false;

        // Show appropriate section based on OTP status
        document.getElementById('otpStatus').style.display = 'none';
        if (otpEnabled) {
            document.getElementById('otpDisableSection').style.display = 'block';
            document.getElementById('otpEnableSection').style.display = 'none';
        } else {
            document.getElementById('otpEnableSection').style.display = 'block';
            document.getElementById('otpDisableSection').style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading OTP status:', error);
        document.getElementById('otpStatus').innerHTML = '<p class="error">Failed to load OTP status</p>';
    }
}

async function setupOTP() {
    try {
        const response = await fetch(`${API_BASE}/otp/setup`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) throw new Error('Failed to setup OTP');

        const data = await response.json();
        currentOTPSecret = data.secret;

        // Generate QR code
        const qrCodeDiv = document.getElementById('qrCode');
        qrCodeDiv.innerHTML = `<img src="${data.qr_code}" alt="QR Code" style="display: block; margin: 10px auto;" />`;
        
        // Show secret
        document.getElementById('otpSecret').textContent = data.secret;

        // Show setup form
        document.getElementById('otpEnableSection').style.display = 'none';
        document.getElementById('otpSetupSection').style.display = 'block';
    } catch (error) {
        console.error('Error setting up OTP:', error);
        Toast.error(error.message);
    }
}

async function handleOTPEnable(e) {
    e.preventDefault();

    const password = document.getElementById('otpPassword').value;
    const code = document.getElementById('otpCode').value;

    try {
        const response = await fetch(`${API_BASE}/otp/enable`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                password: password,
                secret: currentOTPSecret,
                code: code
            })
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to enable OTP');
        }

        const data = await response.json();
        
        // Show backup codes
        const backupCodesDiv = document.getElementById('backupCodes');
        backupCodesDiv.innerHTML = data.backup_codes.map(code => `<div>${code}</div>`).join('');
        
        document.getElementById('otpSetupSection').style.display = 'none';
        document.getElementById('backupCodesSection').style.display = 'block';
        
        document.getElementById('otpEnableForm').reset();
    } catch (error) {
        console.error('Error enabling OTP:', error);
        Toast.error(error.message);
    }
}

function closeBackupCodes() {
    document.getElementById('backupCodesSection').style.display = 'none';
    loadOTPStatus();
}

function cancelOTPSetup() {
    document.getElementById('otpSetupSection').style.display = 'none';
    document.getElementById('otpEnableSection').style.display = 'block';
    document.getElementById('otpEnableForm').reset();
    currentOTPSecret = '';
}

function disableOTP() {
    document.getElementById('otpDisableSection').style.display = 'none';
    document.getElementById('otpDisableForm').style.display = 'block';
}

function cancelDisableOTP() {
    document.getElementById('otpDisableForm').style.display = 'none';
    document.getElementById('otpDisableSection').style.display = 'block';
    document.getElementById('otpDisableFormElement').reset();
}

async function handleOTPDisable(e) {
    e.preventDefault();

    const password = document.getElementById('disableOtpPassword').value;

    if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/otp/disable`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                password: password
            })
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to disable OTP');
        }

        Toast.success('Two-factor authentication has been disabled');
        document.getElementById('otpDisableFormElement').reset();
        document.getElementById('otpDisableForm').style.display = 'none';
        loadOTPStatus();
    } catch (error) {
        console.error('Error disabling OTP:', error);
        Toast.error(error.message);
    }
}
