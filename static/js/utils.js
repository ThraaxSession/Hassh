// Shared utility functions

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// Centralized logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    localStorage.removeItem('is_admin');
    window.location.href = '/login';
}

// Helper function to sort entities alphabetically by ID, then by state
function sortEntitiesByIdAndState(entities, idField = 'entity_id', stateField = 'state') {
    return [...entities].sort((a, b) => {
        const idA = (a[idField] || '').toLowerCase();
        const idB = (b[idField] || '').toLowerCase();
        const stateA = (a[stateField] || 'unknown').toLowerCase();
        const stateB = (b[stateField] || 'unknown').toLowerCase();
        
        // First sort by entity_id
        if (idA < idB) return -1;
        if (idA > idB) return 1;
        
        // If entity_id is the same, sort by state
        if (stateA < stateB) return -1;
        if (stateA > stateB) return 1;
        return 0;
    });
}

// Token refresh functionality
const TokenRefresh = {
    refreshInProgress: false,
    
    // Parse JWT token to get expiration time
    parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    },
    
    // Check if token will expire soon (within 5 minutes)
    shouldRefresh(token) {
        const payload = this.parseJWT(token);
        if (!payload || !payload.exp) return false;
        
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        return (expirationTime - now) < fiveMinutes;
    },
    
    // Refresh the access token using refresh token
    async refresh() {
        if (this.refreshInProgress) {
            return false;
        }
        
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            return false;
        }
        
        this.refreshInProgress = true;
        
        try {
            const response = await fetch('/api/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            
            if (!response.ok) {
                // Refresh token is invalid or expired, logout user
                console.error('Failed to refresh token, logging out');
                logout();
                return false;
            }
            
            const data = await response.json();
            
            // Update stored tokens
            localStorage.setItem('token', data.token);
            localStorage.setItem('refresh_token', data.refresh_token);
            
            console.log('Token refreshed successfully');
            return true;
        } catch (error) {
            console.error('Error refreshing token:', error);
            return false;
        } finally {
            this.refreshInProgress = false;
        }
    },
    
    // Check and refresh token if needed
    async checkAndRefresh() {
        const token = localStorage.getItem('token');
        if (!token) return false;
        
        if (this.shouldRefresh(token)) {
            return await this.refresh();
        }
        
        return true;
    },
    
    // Start periodic token refresh check (every minute)
    startAutoRefresh() {
        // Check immediately
        this.checkAndRefresh();
        
        // Then check every minute
        setInterval(() => {
            this.checkAndRefresh();
        }, 60000); // 1 minute
    }
};

// Start auto-refresh when page loads
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        const token = localStorage.getItem('token');
        if (token) {
            TokenRefresh.startAutoRefresh();
        }
    });
}
