// API helpers
const API_BASE = '/api';

// State
let trackedEntities = [];
let allHAEntities = [];
let shareLinks = [];
let authToken = '';
let isAdmin = false;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    loadEntities();
    loadShareLinks();
    startAutoRefresh();
    checkAdminStatus();
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
    const userControls = document.createElement('div');
    userControls.style.cssText = 'position: absolute; top: 20px; right: 20px;';
    userControls.innerHTML = `
        <span style="color: white; margin-right: 15px;">👤 ${escapeHtml(username)}</span>
        <button onclick="window.location.href='/settings'" class="btn btn-secondary" style="padding: 8px 16px; margin-right: 5px;">Settings</button>
        <button onclick="logout()" class="btn btn-secondary" style="padding: 8px 16px;">Logout</button>
    `;
    header.style.position = 'relative';
    header.appendChild(userControls);
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
let selectedEntities = []; // Track selected entities for batch operations

async function showBrowseModal() {
    const modal = document.getElementById('browseModal');
    modal.style.display = 'block';
    selectedEntities = []; // Reset selection
    
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
        <div class="browse-entity-item">
            <input type="checkbox" id="entity_${escapeHtml(entity.entity_id)}" 
                   value="${escapeHtml(entity.entity_id)}" 
                   onchange="toggleEntitySelection('${escapeHtml(entity.entity_id)}')"
                   ${selectedEntities.includes(entity.entity_id) ? 'checked' : ''}>
            <label for="entity_${escapeHtml(entity.entity_id)}" style="flex-grow: 1; cursor: pointer;">
                <div class="browse-entity-id">${escapeHtml(entity.entity_id)}</div>
                <div class="browse-entity-state">State: ${escapeHtml(entity.state || 'unknown')}</div>
            </label>
        </div>
    `).join('');
    
    // Add select all button if not already present
    if (!document.getElementById('selectAllBtn')) {
        const header = document.createElement('div');
        header.style.cssText = 'margin-bottom: 10px; display: flex; gap: 10px;';
        header.innerHTML = `
            <button id="selectAllBtn" class="btn btn-secondary" onclick="selectAllEntities()">Select All</button>
            <button class="btn btn-secondary" onclick="deselectAllEntities()">Deselect All</button>
            <button class="btn btn-primary" onclick="addSelectedEntities()">Add Selected (${selectedEntities.length})</button>
        `;
        container.parentElement.insertBefore(header, container);
    } else {
        // Update count
        const addBtn = document.querySelector('#selectAllBtn').parentElement.querySelector('.btn-primary');
        addBtn.textContent = `Add Selected (${selectedEntities.length})`;
    }
}

function toggleEntitySelection(entityId) {
    const index = selectedEntities.indexOf(entityId);
    if (index > -1) {
        selectedEntities.splice(index, 1);
    } else {
        selectedEntities.push(entityId);
    }
    renderAllEntities(document.getElementById('entitySearch').value);
}

function selectAllEntities() {
    const filter = document.getElementById('entitySearch').value;
    const filtered = allHAEntities.filter(entity => 
        entity.entity_id && entity.entity_id.toLowerCase().includes(filter.toLowerCase())
    );
    filtered.forEach(entity => {
        if (!selectedEntities.includes(entity.entity_id)) {
            selectedEntities.push(entity.entity_id);
        }
    });
    renderAllEntities(filter);
}

function deselectAllEntities() {
    selectedEntities = [];
    renderAllEntities(document.getElementById('entitySearch').value);
}

async function addSelectedEntities() {
    if (selectedEntities.length === 0) {
        showError('Please select at least one entity');
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const entityId of selectedEntities) {
        try {
            const response = await fetch(`${API_BASE}/entities`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ entity_id: entityId })
            });
            
            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
        }
    }
    
    showSuccess(`Added ${successCount} entities. ${errorCount > 0 ? errorCount + ' failed.' : ''}`);
    selectedEntities = [];
    document.getElementById('browseModal').style.display = 'none';
    await loadEntities();
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
    const accessMode = document.getElementById('accessMode').value;
    const data = {
        entity_ids: entityIds,
        type: type,
        access_mode: accessMode
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
        
        const accessModeBadge = link.access_mode === 'triggerable' ? 'badge-permanent' : 'badge-counter';
        const accessModeText = link.access_mode === 'triggerable' ? 'Triggerable' : 'Read-Only';
        
        return `
            <div class="share-item">
                <div class="share-header">
                    <div>
                        <span class="badge ${typeBadge}">${link.type}</span>
                        <span class="badge ${accessModeBadge}">${accessModeText}</span>
                        <span class="badge ${statusBadge}">${link.active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div>
                        <button class="btn btn-secondary" onclick="editShareLink('${link.id}')" style="margin-right: 5px;">Edit</button>
                        <button class="btn btn-danger" onclick="deleteShareLink('${link.id}')">Delete</button>
                    </div>
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

function editShareLink(shareId) {
    const share = shareLinks.find(s => s.id === shareId);
    if (!share) return;
    
    // Show edit modal (we'll create this)
    const modal = document.getElementById('editShareModal');
    if (!modal) {
        // Create edit modal dynamically
        const modalHTML = `
            <div id="editShareModal" class="modal">
                <div class="modal-content">
                    <span class="close" onclick="document.getElementById('editShareModal').style.display='none'">&times;</span>
                    <h2>Edit Share Link</h2>
                    <div id="editShareContent"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    const content = document.getElementById('editShareContent');
    content.innerHTML = `
        <div class="form-group">
            <label>Select Entities to Share:</label>
            <div id="editShareEntitySelect" class="checkbox-group"></div>
        </div>
        
        <div class="form-group">
            <label>Link Type:</label>
            <select id="editShareType">
                <option value="permanent" ${share.type === 'permanent' ? 'selected' : ''}>Permanent</option>
                <option value="counter" ${share.type === 'counter' ? 'selected' : ''}>Counter-Limited</option>
                <option value="time" ${share.type === 'time' ? 'selected' : ''}>Time-Limited</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Access Mode:</label>
            <select id="editAccessMode">
                <option value="readonly" ${share.access_mode === 'readonly' ? 'selected' : ''}>Read-Only</option>
                <option value="triggerable" ${share.access_mode === 'triggerable' ? 'selected' : ''}>Triggerable</option>
            </select>
        </div>
        
        <div id="editShareOptions"></div>
        
        <button class="btn btn-primary" onclick="saveShareLink('${shareId}')">Save Changes</button>
        <button class="btn btn-secondary" onclick="document.getElementById('editShareModal').style.display='none'">Cancel</button>
    `;
    
    // Populate entities
    const entityContainer = document.getElementById('editShareEntitySelect');
    entityContainer.innerHTML = trackedEntities.map(entity => `
        <div class="checkbox-item">
            <label>
                <input type="checkbox" value="${entity.entity_id}" 
                       ${share.entity_ids.includes(entity.entity_id) ? 'checked' : ''}>
                ${escapeHtml(entity.entity_id)}
            </label>
        </div>
    `).join('');
    
    // Setup type change handler
    document.getElementById('editShareType').addEventListener('change', updateEditShareOptions);
    updateEditShareOptions();
    
    document.getElementById('editShareModal').style.display = 'block';
}

function updateEditShareOptions() {
    const type = document.getElementById('editShareType').value;
    const container = document.getElementById('editShareOptions');
    
    if (type === 'counter') {
        container.innerHTML = `
            <div class="form-group">
                <label>Max Access Count:</label>
                <input type="number" id="editMaxAccess" min="1" value="10" />
            </div>
        `;
    } else if (type === 'time') {
        container.innerHTML = `
            <div class="form-group">
                <label>Expires At:</label>
                <input type="datetime-local" id="editExpiresAt" />
            </div>
        `;
    } else {
        container.innerHTML = '';
    }
}

async function saveShareLink(shareId) {
    const type = document.getElementById('editShareType').value;
    const accessMode = document.getElementById('editAccessMode').value;
    
    // Get selected entities
    const checkboxes = document.querySelectorAll('#editShareEntitySelect input[type="checkbox"]:checked');
    const entityIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (entityIds.length === 0) {
        showError('Please select at least one entity');
        return;
    }
    
    const data = {
        entity_ids: entityIds,
        type: type,
        access_mode: accessMode
    };
    
    if (type === 'counter') {
        const maxAccess = parseInt(document.getElementById('editMaxAccess').value);
        if (maxAccess < 1) {
            showError('Max access must be at least 1');
            return;
        }
        data.max_access = maxAccess;
    } else if (type === 'time') {
        const expiresAt = document.getElementById('editExpiresAt').value;
        if (!expiresAt) {
            showError('Please select an expiration date');
            return;
        }
        data.expires_at = new Date(expiresAt).toISOString();
    }
    
    try {
        const response = await fetch(`${API_BASE}/shares/${shareId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update share link');
        }
        
        showSuccess('Share link updated successfully');
        document.getElementById('editShareModal').style.display = 'none';
        await loadShareLinks();
    } catch (error) {
        console.error('Error updating share link:', error);
        showError('Failed to update share link: ' + error.message);
    }
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

// Admin functions
async function checkAdminStatus() {
    isAdmin = localStorage.getItem('is_admin') === 'true';
    if (isAdmin) {
        showAdminPanel();
    }
}

function showAdminPanel() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;
    
    const adminPanel = document.createElement('section');
    adminPanel.className = 'card';
    adminPanel.id = 'adminPanel';
    adminPanel.innerHTML = `
        <h2>👨‍💼 Admin Panel</h2>
        
        <div class="admin-section">
            <h3>User Management</h3>
            <button class="btn btn-primary" onclick="showCreateUserModal()">Create New User</button>
            <div id="usersList"></div>
        </div>
    `;
    
    mainContent.insertBefore(adminPanel, mainContent.firstChild);
    loadAllUsers();
}

async function loadAllUsers() {
    if (!isAdmin) return;
    
    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: getAuthHeaders()
        });
        
        if (response.status === 401 || response.status === 403) {
            return;
        }
        
        if (!response.ok) throw new Error('Failed to load users');
        
        const users = await response.json();
        renderUsersList(users);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsersList(users) {
    const container = document.getElementById('usersList');
    if (!container) return;
    
    container.innerHTML = `
        <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
            <thead>
                <tr style="background: #f5f5f5; text-align: left;">
                    <th style="padding: 10px;">Username</th>
                    <th style="padding: 10px;">Admin</th>
                    <th style="padding: 10px;">Created</th>
                    <th style="padding: 10px;">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr style="border-bottom: 1px solid #e0e0e0;">
                        <td style="padding: 10px;">${escapeHtml(user.username)}</td>
                        <td style="padding: 10px;">${user.is_admin ? '✅ Yes' : 'No'}</td>
                        <td style="padding: 10px;">${new Date(user.created_at).toLocaleDateString()}</td>
                        <td style="padding: 10px;">
                            ${user.is_admin ? '' : `<button class="btn btn-danger" onclick="deleteUser(${user.id})">Delete</button>`}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function showCreateUserModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>Create New User</h2>
            <div class="form-group">
                <label>Username:</label>
                <input type="text" id="newUsername" placeholder="Enter username" />
            </div>
            <button class="btn btn-primary" onclick="createNewUser()">Create User</button>
            <div id="createUserResult"></div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function createNewUser() {
    const username = document.getElementById('newUsername').value.trim();
    if (!username) {
        showError('Username is required');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ username })
        });
        
        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create user');
        }
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('createUserResult');
        resultDiv.innerHTML = `
            <div class="success-message" style="margin-top: 20px;">
                <strong>User created successfully!</strong><br><br>
                <strong>Username:</strong> ${escapeHtml(data.user.username)}<br>
                <strong>Generated Password:</strong><br>
                <div style="background: #f5f5f5; padding: 10px; margin: 10px 0; font-family: monospace; word-break: break-all;">
                    ${escapeHtml(data.generated_password)}
                </div>
                <strong>⚠️ Save this password! It cannot be recovered.</strong>
            </div>
        `;
        
        await loadAllUsers();
    } catch (error) {
        console.error('Error creating user:', error);
        showError('Failed to create user: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their entities and share links.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete user');
        }
        
        showSuccess('User deleted successfully');
        await loadAllUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showError('Failed to delete user: ' + error.message);
    }
}
