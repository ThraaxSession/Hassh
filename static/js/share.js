// API helpers
const API_BASE = '/api';

// Get share ID from URL
const shareId = window.location.pathname.split('/').pop();

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadSharedEntities();
    startAutoRefresh();
});

async function loadSharedEntities() {
    try {
        const response = await fetch(`${API_BASE}/shares/${shareId}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load shared entities');
        }
        
        const data = await response.json();
        renderShareInfo(data.share);
        renderSharedEntities(data.entities);
    } catch (error) {
        console.error('Error loading shared entities:', error);
        showError(error.message);
    }
}

function renderShareInfo(share) {
    const container = document.getElementById('shareInfo');
    
    let details = '';
    if (share.type === 'counter') {
        details = `<p>Access Count: ${share.access_count}/${share.max_access}</p>`;
    } else if (share.type === 'time') {
        const expiresAt = new Date(share.expires_at).toLocaleString();
        details = `<p>Expires: ${expiresAt}</p>`;
    } else {
        details = '<p>Permanent Share</p>';
    }
    
    container.innerHTML = `
        <h2>Shared Entities</h2>
        <div style="margin-bottom: 20px; color: #666;">
            ${details}
            <p>Sharing ${share.entity_ids.length} entities</p>
        </div>
    `;
}

function renderSharedEntities(entities) {
    const container = document.getElementById('sharedEntities');
    
    if (!entities || entities.length === 0) {
        container.innerHTML = '<div class="empty-state">No entities available</div>';
        return;
    }
    
    container.innerHTML = entities.map(entity => {
        const attributes = entity.attributes || {};
        const attributesList = Object.entries(attributes)
            .slice(0, 5) // Show only first 5 attributes
            .map(([key, value]) => `<div>${escapeHtml(key)}: ${escapeHtml(String(value))}</div>`)
            .join('');
        
        return `
            <div class="entity-item">
                <div class="entity-info">
                    <div class="entity-id">${escapeHtml(entity.entity_id)}</div>
                    <div class="entity-state">
                        <strong>State:</strong> ${escapeHtml(entity.state || 'unknown')}
                    </div>
                    ${attributesList ? `
                        <div style="margin-top: 10px; font-size: 13px; color: #777;">
                            <strong>Attributes:</strong>
                            ${attributesList}
                        </div>
                    ` : ''}
                    ${entity.last_updated ? `
                        <div style="margin-top: 5px; font-size: 12px; color: #999;">
                            Last updated: ${new Date(entity.last_updated).toLocaleString()}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function startAutoRefresh() {
    setInterval(async () => {
        await loadSharedEntities();
    }, 30000); // Refresh every 30 seconds
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function showError(message) {
    const container = document.querySelector('.main-content');
    container.innerHTML = `
        <div class="card">
            <div class="error-message" style="text-align: center; padding: 40px;">
                <h2>❌ Error</h2>
                <p style="margin-top: 20px;">${escapeHtml(message)}</p>
            </div>
        </div>
    `;
}
