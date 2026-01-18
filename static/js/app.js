// API helpers
const API_BASE = '/api';

// State
let trackedEntities = [];
let allHAEntities = [];
let shareLinks = [];
let authToken = '';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    loadEntities();
    loadShareLinks();
    startAutoRefresh();
});

// Check if user is authenticated
function checkAuth() {
    authToken = localStorage.getItem('token');
    if (!authToken) {
        window.location.href = '/login';
        return;
    }
    
    // Display username
    const username = localStorage.getItem('username');
    if (username) {
        displayUsername(username);
    }
}

// Display username in header
function displayUsername(username) {
    const header = document.querySelector('header');
    const logoutBtn = document.createElement('div');
    logoutBtn.style.cssText = 'position: absolute; top: 20px; right: 20px;';
    logoutBtn.innerHTML = `
        <span style="color: white; margin-right: 15px;">👤 ${escapeHtml(username)}</span>
        <button onclick="logout()" class="btn btn-secondary" style="padding: 8px 16px;">Logout</button>
    `;
    header.style.position = 'relative';
    header.appendChild(logoutBtn);
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('haUrl');
    window.location.href = '/login';
}

// Get auth headers
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

function setupEventListeners() {
    document.getElementById('addEntityBtn').addEventListener('click', addEntity);
    document.getElementById('browseEntitiesBtn').addEventListener('click', showBrowseModal);
    document.getElementById('createShareBtn').addEventListener('click', createShareLink);
    document.getElementById('shareType').addEventListener('change', handleShareTypeChange);
    
    // Modal
    const modal = document.getElementById('browseModal');
    const span = document.getElementsByClassName('close')[0];
    span.onclick = function() {
        modal.style.display = 'none';
    }
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
    
    // Search
    document.getElementById('entitySearch').addEventListener('input', filterEntities);
}

// Entity Management
async function loadEntities() {
    try {
        const response = await fetch(`${API_BASE}/entities`, {
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) throw new Error('Failed to load entities');
        
        trackedEntities = await response.json();
        renderEntities();
        updateShareEntitySelect();
    } catch (error) {
        console.error('Error loading entities:', error);
        showError('Failed to load entities: ' + error.message);
    }
}

async function addEntity() {
    const entityId = document.getElementById('entityIdInput').value.trim();
    if (!entityId) {
        showError('Please enter an entity ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/entities`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ entity_id: entityId })
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add entity');
        }
        
        document.getElementById('entityIdInput').value = '';
        showSuccess('Entity added successfully');
        await loadEntities();
    } catch (error) {
        console.error('Error adding entity:', error);
        showError('Failed to add entity: ' + error.message);
    }
}

async function deleteEntity(entityId) {
    if (!confirm('Are you sure you want to delete this entity?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/entities/${entityId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) throw new Error('Failed to delete entity');
        
        showSuccess('Entity deleted successfully');
        await loadEntities();
    } catch (error) {
        console.error('Error deleting entity:', error);
        showError('Failed to delete entity: ' + error.message);
    }
}

function renderEntities() {
    const container = document.getElementById('entitiesList');
    
    if (!trackedEntities || trackedEntities.length === 0) {
        container.innerHTML = '<div class="empty-state">No entities tracked yet. Add some to get started!</div>';
        return;
    }
    
    container.innerHTML = trackedEntities.map(entity => `
        <div class="entity-item">
            <div class="entity-info">
                <div class="entity-id">${escapeHtml(entity.entity_id)}</div>
                <div class="entity-state">State: ${escapeHtml(entity.state || 'unknown')}</div>
            </div>
            <button class="btn btn-danger" onclick="deleteEntity(${entity.id})">Delete</button>
        </div>
    `).join('');
}

// Browse Entities Modal
async function showBrowseModal() {
    const modal = document.getElementById('browseModal');
    modal.style.display = 'block';
    
    if (allHAEntities.length === 0) {
        try {
            const response = await fetch(`${API_BASE}/ha/entities`, {
                headers: getAuthHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (!response.ok) throw new Error('Failed to load Home Assistant entities');
            
            allHAEntities = await response.json();
            renderAllEntities();
        } catch (error) {
            console.error('Error loading HA entities:', error);
            showError('Failed to load Home Assistant entities: ' + error.message);
        }
    } else {
        renderAllEntities();
    }
}

function renderAllEntities(filter = '') {
    const container = document.getElementById('allEntitiesList');
    const filtered = allHAEntities.filter(entity => 
        entity.entity_id && entity.entity_id.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No entities found</div>';
        return;
    }
    
    container.innerHTML = filtered.map(entity => `
        <div class="browse-entity-item" onclick="selectEntity('${escapeHtml(entity.entity_id)}')">
            <div class="browse-entity-id">${escapeHtml(entity.entity_id)}</div>
            <div class="browse-entity-state">State: ${escapeHtml(entity.state || 'unknown')}</div>
        </div>
    `).join('');
}

function filterEntities() {
    const filter = document.getElementById('entitySearch').value;
    renderAllEntities(filter);
}

function selectEntity(entityId) {
    document.getElementById('entityIdInput').value = entityId;
    document.getElementById('browseModal').style.display = 'none';
}

// Share Link Management
async function loadShareLinks() {
    try {
        const response = await fetch(`${API_BASE}/shares`, {
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) throw new Error('Failed to load share links');
        
        shareLinks = await response.json();
        renderShareLinks();
    } catch (error) {
        console.error('Error loading share links:', error);
        showError('Failed to load share links: ' + error.message);
    }
}

async function createShareLink() {
    const entityCheckboxes = document.querySelectorAll('#shareEntitySelect input[type="checkbox"]:checked');
    const entityIds = Array.from(entityCheckboxes).map(cb => cb.value);
    
    if (entityIds.length === 0) {
        showError('Please select at least one entity to share');
        return;
    }
    
    const type = document.getElementById('shareType').value;
    const data = {
        entity_ids: entityIds,
        type: type
    };
    
    if (type === 'counter') {
        data.max_access = parseInt(document.getElementById('maxAccess').value);
    } else if (type === 'time') {
        const expiresAt = document.getElementById('expiresAt').value;
        if (!expiresAt) {
            showError('Please select an expiration date');
            return;
        }
        data.expires_at = new Date(expiresAt).toISOString();
    }
    
    try {
        const response = await fetch(`${API_BASE}/shares`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create share link');
        }
        
        showSuccess('Share link created successfully');
        await loadShareLinks();
        
        // Clear selections
        entityCheckboxes.forEach(cb => cb.checked = false);
    } catch (error) {
        console.error('Error creating share link:', error);
        showError('Failed to create share link: ' + error.message);
    }
}

async function deleteShareLink(shareId) {
    if (!confirm('Are you sure you want to delete this share link?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/shares/${shareId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) throw new Error('Failed to delete share link');
        
        showSuccess('Share link deleted successfully');
        await loadShareLinks();
    } catch (error) {
        console.error('Error deleting share link:', error);
        showError('Failed to delete share link: ' + error.message);
    }
}

function renderShareLinks() {
    const container = document.getElementById('sharesList');
    
    if (!shareLinks || shareLinks.length === 0) {
        container.innerHTML = '<div class="empty-state">No share links created yet</div>';
        return;
    }
    
    container.innerHTML = shareLinks.map(link => {
        const shareUrl = `${window.location.origin}/share/${link.id}`;
        const typeBadge = `badge-${link.type}`;
        const statusBadge = link.active ? 'badge-active' : 'badge-inactive';
        
        let details = '';
        if (link.type === 'counter') {
            details = `Access: ${link.access_count}/${link.max_access}`;
        } else if (link.type === 'time') {
            const expiresAt = new Date(link.expires_at).toLocaleString();
            details = `Expires: ${expiresAt}`;
        } else {
            details = 'Permanent link';
        }
        
        return `
            <div class="share-item">
                <div class="share-header">
                    <div>
                        <span class="badge ${typeBadge}">${link.type}</span>
                        <span class="badge ${statusBadge}">${link.active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <button class="btn btn-danger" onclick="deleteShareLink('${link.id}')">Delete</button>
                </div>
                <div class="share-details">
                    <div>Entities: ${link.entity_ids.length}</div>
                    <div>${details}</div>
                    <div>Created: ${new Date(link.created_at).toLocaleString()}</div>
                </div>
                <div class="share-link">${shareUrl}</div>
                <button class="btn btn-copy" onclick="copyToClipboard('${shareUrl}')">Copy Link</button>
            </div>
        `;
    }).join('');
}

function updateShareEntitySelect() {
    const container = document.getElementById('shareEntitySelect');
    
    if (!trackedEntities || trackedEntities.length === 0) {
        container.innerHTML = '<div class="empty-state">No entities available. Add entities first.</div>';
        return;
    }
    
    container.innerHTML = '<div class="checkbox-group">' + 
        trackedEntities.map(entity => `
            <div class="checkbox-item">
                <label>
                    <input type="checkbox" value="${escapeHtml(entity.entity_id || entity.id)}">
                    ${escapeHtml(entity.entity_id || entity.id)}
                </label>
            </div>
        `).join('') + 
        '</div>';
}

function handleShareTypeChange() {
    const type = document.getElementById('shareType').value;
    const maxAccessGroup = document.getElementById('maxAccessGroup');
    const expiresAtGroup = document.getElementById('expiresAtGroup');
    
    maxAccessGroup.style.display = type === 'counter' ? 'block' : 'none';
    expiresAtGroup.style.display = type === 'time' ? 'block' : 'none';
}

// Auto-refresh
function startAutoRefresh() {
    setInterval(async () => {
        await loadEntities();
    }, 30000); // Refresh every 30 seconds
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showSuccess('Link copied to clipboard');
    }).catch(err => {
        showError('Failed to copy link');
    });
}

function showError(message) {
    const container = document.querySelector('.main-content');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const container = document.querySelector('.main-content');
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    container.insertBefore(successDiv, container.firstChild);
    
    setTimeout(() => successDiv.remove(), 3000);
}
