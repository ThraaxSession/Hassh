// API helpers
const API_BASE = '/api';

// Get share ID from URL
const shareId = window.location.pathname.split('/').pop();
let accessMode = 'readonly';  // Will be set when data loads

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
        accessMode = data.access_mode || 'readonly';
        renderShareInfo(data.share, accessMode);
        renderSharedEntities(data.entities, accessMode);
    } catch (error) {
        console.error('Error loading shared entities:', error);
        showError(error.message);
    }
}

function renderShareInfo(share, accessMode) {
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
    
    const accessModeLabel = accessMode === 'triggerable' ? '🎮 Triggerable' : '👁️ Read-Only';
    
    container.innerHTML = `
        <h2>Shared Entities</h2>
        <div style="margin-bottom: 20px; color: #666;">
            ${details}
            <p>Sharing ${share.entity_ids.length} entities - ${accessModeLabel}</p>
        </div>
    `;
}

function renderSharedEntities(entities, accessMode) {
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
        
        // Add control buttons for triggerable shares
        let controlButtons = '';
        if (accessMode === 'triggerable') {
            const domain = entity.entity_id.split('.')[0];
            if (domain === 'light' || domain === 'switch') {
                controlButtons = `
                    <div style="margin-top: 10px;">
                        <button class="btn btn-primary" onclick="triggerEntity('${entity.entity_id}', 'turn_on')" style="padding: 6px 12px; font-size: 12px; margin-right: 5px;">Turn On</button>
                        <button class="btn btn-secondary" onclick="triggerEntity('${entity.entity_id}', 'turn_off')" style="padding: 6px 12px; font-size: 12px;">Turn Off</button>
                    </div>
                `;
            } else if (domain === 'cover') {
                controlButtons = `
                    <div style="margin-top: 10px;">
                        <button class="btn btn-primary" onclick="triggerEntity('${entity.entity_id}', 'open_cover')" style="padding: 6px 12px; font-size: 12px; margin-right: 5px;">Open</button>
                        <button class="btn btn-secondary" onclick="triggerEntity('${entity.entity_id}', 'close_cover')" style="padding: 6px 12px; font-size: 12px;">Close</button>
                    </div>
                `;
            } else if (domain === 'scene' || domain === 'script') {
                controlButtons = `
                    <div style="margin-top: 10px;">
                        <button class="btn btn-primary" onclick="triggerEntity('${entity.entity_id}', 'turn_on')" style="padding: 6px 12px; font-size: 12px;">Activate</button>
                    </div>
                `;
            }
        }
        
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
                    ${controlButtons}
                </div>
            </div>
        `;
    }).join('');
}

async function triggerEntity(entityId, service) {
    try {
        const response = await fetch(`${API_BASE}/shares/${shareId}/trigger/${entityId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: service })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to trigger entity');
        }
        
        // Reload entities to show updated state
        setTimeout(() => loadSharedEntities(), 500);
    } catch (error) {
        console.error('Error triggering entity:', error);
        alert('Failed to trigger entity: ' + error.message);
    }
}

function startAutoRefresh() {
    setInterval(async () => {
        await loadSharedEntities();
    }, 30000); // Refresh every 30 seconds
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
