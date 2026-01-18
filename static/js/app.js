// API helpers
const API_BASE = '/api';

// State
let trackedEntities = [];
let allHAEntities = [];
let shareLinks = [];
let authToken = '';
let isAdmin = false;
let allUsers = [];
let sharedWithMe = [];
let mySharedEntities = [];
let settingsListenersSet = false; // Track if settings listeners are set
let currentOTPSecret = ''; // Track current OTP secret during setup

// Section navigation
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all menu buttons
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(`section-${sectionId}`);
    if (section) {
        section.classList.add('active');
    }
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Load section-specific data
    if (sectionId === 'shared-with-me') {
        loadSharedWithMe();
    } else if (sectionId === 'my-shared-entities') {
        loadMySharedEntities();
    } else if (sectionId === 'admin') {
        loadAdminPanel();
    } else if (sectionId === 'settings') {
        loadSettings();
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    loadEntities();
    loadShareLinks();
    startAutoRefresh();
    checkAdminStatus();
    loadAllUsers();
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
    userControls.className = 'user-controls';
    
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username-display';
    usernameSpan.textContent = `👤 ${username}`; // textContent automatically escapes
    
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-secondary logout-btn';
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = logout;
    
    userControls.appendChild(usernameSpan);
    userControls.appendChild(logoutBtn);
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
    
    // Handle user-to-user sharing differently
    if (type === 'user') {
        const targetUserId = document.getElementById('targetUser').value;
        if (!targetUserId) {
            showError('Please select a user to share with');
            return;
        }
        
        try {
            // Share each entity with the selected user
            for (const entityId of entityIds) {
                const response = await fetch(`${API_BASE}/share-entity`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        entity_id: entityId,
                        shared_with_id: parseInt(targetUserId),
                        access_mode: accessMode
                    })
                });
                
                if (response.status === 401) {
                    logout();
                    return;
                }
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to share entity');
                }
            }
            
            showSuccess(`Successfully shared ${entityIds.length} entities with user`);
            entityCheckboxes.forEach(cb => cb.checked = false);
            return;
        } catch (error) {
            console.error('Error sharing entities:', error);
            showError('Failed to share entities: ' + error.message);
            return;
        }
    }
    
    // Handle link-based sharing
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
    const targetUserGroup = document.getElementById('targetUserGroup');
    
    maxAccessGroup.style.display = type === 'counter' ? 'block' : 'none';
    expiresAtGroup.style.display = type === 'time' ? 'block' : 'none';
    targetUserGroup.style.display = type === 'user' ? 'block' : 'none';
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
        const adminMenuBtn = document.getElementById('adminMenuBtn');
        if (adminMenuBtn) {
            adminMenuBtn.style.display = 'inline-block';
        }
    }
}

function loadAdminPanel() {
    const adminPanel = document.getElementById('adminPanel');
    if (!adminPanel) return;
    
    adminPanel.innerHTML = `
        <h2>👨‍💼 Admin Panel</h2>
        
        <div class="admin-section">
            <h3>User Management</h3>
            <button class="btn btn-primary" onclick="showCreateUserModal()">Create New User</button>
            <div id="usersList"></div>
        </div>
    `;
    
    loadAllUsers();
}

function showAdminPanel() {
    // Legacy function - kept for compatibility
    loadAdminPanel();
}

async function loadAllUsers() {
    try {
        // Use the public user list endpoint for dropdown population
        const response = await fetch(`${API_BASE}/users/list`, {
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) {
            console.error('Failed to load user list');
            return;
        }
        
        const users = await response.json();
        allUsers = users;
        populateUserDropdown(users);
        
        // If admin, also load full user details for admin panel
        if (isAdmin) {
            await loadAdminUsers();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadAdminUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: getAuthHeaders()
        });
        
        if (response.status === 401 || response.status === 403) {
            return;
        }
        
        if (!response.ok) throw new Error('Failed to load users');
        
        const users = await response.json();
        allUsers = users; // Keep state consistent
        renderUsersList(users);
    } catch (error) {
        console.error('Error loading admin users:', error);
    }
}

function populateUserDropdown(users) {
    const dropdown = document.getElementById('targetUser');
    if (!dropdown) return;
    
    const currentUsername = localStorage.getItem('username');
    dropdown.innerHTML = '<option value="">Select a user...</option>' + 
        users
            .filter(user => user.username !== currentUsername)
            .map(user => `<option value="${user.id}">${escapeHtml(user.username)}</option>`)
            .join('');
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
                        <td style="padding: 10px;">
                            <label class="switch">
                                <input type="checkbox" ${user.is_admin ? 'checked' : ''} onchange="toggleUserAdmin(${user.id}, this.checked)">
                                <span class="slider round"></span>
                            </label>
                        </td>
                        <td style="padding: 10px;">${new Date(user.created_at).toLocaleDateString()}</td>
                        <td style="padding: 10px;">
                            <button class="btn btn-danger" onclick="deleteUser(${user.id})" ${user.is_admin ? 'disabled' : ''}>Delete</button>
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

async function toggleUserAdmin(userId, isAdmin) {
    try {
        const response = await fetch(`${API_BASE}/users/${userId}/admin`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ is_admin: isAdmin })
        });
        
        if (response.status === 401 || response.status === 403) {
            logout();
            return;
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update admin status');
        }
        
        showSuccess(`User admin status updated successfully`);
        await loadAllUsers();
    } catch (error) {
        console.error('Error updating admin status:', error);
        showError('Failed to update admin status: ' + error.message);
        // Reload to revert the checkbox state
        await loadAllUsers();
    }
}

// Shared With Me functionality
async function loadSharedWithMe() {
    try {
        const response = await fetch(`${API_BASE}/shared-with-me`, {
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) throw new Error('Failed to load shared entities');
        
        sharedWithMe = await response.json();
        renderSharedWithMe();
    } catch (error) {
        console.error('Error loading shared entities:', error);
        showError('Failed to load shared entities: ' + error.message);
    }
}

async function renderSharedWithMe() {
    const container = document.getElementById('sharedWithMeList');
    
    if (!sharedWithMe || sharedWithMe.length === 0) {
        container.innerHTML = '<div class="empty-state">No entities have been shared with you yet.</div>';
        return;
    }
    
    // Group by owner
    const groupedByOwner = {};
    sharedWithMe.forEach(item => {
        const ownerName = item.Owner ? item.Owner.username : 'Unknown';
        if (!groupedByOwner[ownerName]) {
            groupedByOwner[ownerName] = [];
        }
        groupedByOwner[ownerName].push(item);
    });
    
    container.innerHTML = Object.keys(groupedByOwner).map(ownerName => {
        const entities = groupedByOwner[ownerName];
        const entitiesHtml = entities.map(item => `
            <div class="entity-item">
                <div class="entity-info">
                    <div class="entity-id">${escapeHtml(item.EntityID)}</div>
                    <div class="entity-state" id="shared-entity-state-${escapeHtml(item.EntityID).replace(/\./g, '-')}">
                        <span class="badge badge-secondary">Loading...</span>
                    </div>
                    <div class="entity-access">
                        <span class="badge badge-${item.AccessMode === 'triggerable' ? 'success' : 'info'}">
                            ${item.AccessMode === 'triggerable' ? '🎛️ Triggerable' : '👁️ Read-Only'}
                        </span>
                    </div>
                </div>
                <button class="btn btn-secondary" onclick="viewSharedEntity('${escapeHtml(item.EntityID)}', '${escapeHtml(ownerName)}', '${escapeHtml(item.AccessMode)}')">
                    View Details
                </button>
            </div>
        `).join('');
        
        return `
            <div class="shared-group">
                <h3 class="shared-owner">📤 Shared from: ${escapeHtml(ownerName)}</h3>
                ${entitiesHtml}
            </div>
        `;
    }).join('');
    
    // Load entity states
    sharedWithMe.forEach(item => {
        loadSharedEntityState(item.EntityID);
    });
}

async function loadSharedEntityState(entityId) {
    try {
        const response = await fetch(`${API_BASE}/shared-entity/${encodeURIComponent(entityId)}/state`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            updateSharedEntityStateDisplay(entityId, null, 'Error loading state');
            return;
        }
        
        const data = await response.json();
        updateSharedEntityStateDisplay(entityId, data.entity, null);
    } catch (error) {
        console.error('Error loading shared entity state:', error);
        updateSharedEntityStateDisplay(entityId, null, 'Error');
    }
}

function updateSharedEntityStateDisplay(entityId, entity, errorMessage) {
    const stateElement = document.getElementById(`shared-entity-state-${entityId.replace(/\./g, '-')}`);
    if (!stateElement) return;
    
    if (errorMessage) {
        stateElement.innerHTML = `<span class="badge badge-danger">${escapeHtml(errorMessage)}</span>`;
        return;
    }
    
    if (entity) {
        stateElement.innerHTML = `
            <span class="badge badge-primary">State: ${escapeHtml(entity.state)}</span>
        `;
    }
}

async function viewSharedEntity(entityId, ownerName, accessMode) {
    try {
        const response = await fetch(`${API_BASE}/shared-entity/${encodeURIComponent(entityId)}/state`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to load entity details');
        }
        
        const data = await response.json();
        const entity = data.entity;
        
        // Build attributes display
        let attributesHtml = '';
        if (entity.attributes) {
            const attrs = typeof entity.attributes === 'string' ? JSON.parse(entity.attributes) : entity.attributes;
            attributesHtml = '<div class="attributes-list">';
            for (const [key, value] of Object.entries(attrs)) {
                attributesHtml += `<div class="attribute-item"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</div>`;
            }
            attributesHtml += '</div>';
        }
        
        // Build modal content
        let modalContent = `
            <div class="modal-overlay" id="entityModal" onclick="closeEntityModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>${escapeHtml(entityId)}</h2>
                        <button class="modal-close" onclick="closeEntityModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="entity-details">
                            <div class="detail-row">
                                <strong>Shared by:</strong> ${escapeHtml(ownerName)}
                            </div>
                            <div class="detail-row">
                                <strong>Access Mode:</strong> 
                                <span class="badge badge-${accessMode === 'triggerable' ? 'success' : 'info'}">
                                    ${accessMode === 'triggerable' ? '🎛️ Triggerable' : '👁️ Read-Only'}
                                </span>
                            </div>
                            <div class="detail-row">
                                <strong>Current State:</strong> 
                                <span class="badge badge-primary">${escapeHtml(entity.state)}</span>
                            </div>
                            <div class="detail-row">
                                <strong>Last Updated:</strong> ${escapeHtml(new Date(entity.last_updated).toLocaleString())}
                            </div>
                        </div>
                        
                        ${attributesHtml ? '<h3>Attributes</h3>' + attributesHtml : ''}
                        
                        ${accessMode === 'triggerable' ? `
                            <div class="entity-controls">
                                <h3>Controls</h3>
                                <div class="control-buttons">
                                    ${generateControlButtons(entityId, entity)}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        const existingModal = document.getElementById('entityModal');
        if (existingModal) {
            existingModal.remove();
        }
        document.body.insertAdjacentHTML('beforeend', modalContent);
        
    } catch (error) {
        console.error('Error viewing shared entity:', error);
        showError('Failed to load entity details: ' + error.message);
    }
}

function generateControlButtons(entityId, entity) {
    const domain = entityId.split('.')[0];
    const state = entity.state;
    
    let buttons = '';
    
    // Generate common control buttons based on domain and state
    if (domain === 'light') {
        if (state === 'on') {
            buttons += `<button class="btn btn-danger" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'turn_off')">Turn Off</button>`;
        } else {
            buttons += `<button class="btn btn-success" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'turn_on')">Turn On</button>`;
        }
        buttons += `<button class="btn btn-secondary" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'toggle')">Toggle</button>`;
    } else if (domain === 'switch') {
        if (state === 'on') {
            buttons += `<button class="btn btn-danger" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'turn_off')">Turn Off</button>`;
        } else {
            buttons += `<button class="btn btn-success" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'turn_on')">Turn On</button>`;
        }
        buttons += `<button class="btn btn-secondary" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'toggle')">Toggle</button>`;
    } else if (domain === 'scene') {
        buttons += `<button class="btn btn-primary" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'turn_on')">Activate Scene</button>`;
    } else if (domain === 'script') {
        buttons += `<button class="btn btn-primary" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'turn_on')">Run Script</button>`;
    } else if (domain === 'automation') {
        buttons += `<button class="btn btn-primary" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'trigger')">Trigger Automation</button>`;
    } else if (domain === 'button') {
        buttons += `<button class="btn btn-primary" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'press')">Press</button>`;
    } else {
        // Generic controls for other entity types
        buttons += `<button class="btn btn-primary" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'turn_on')">Turn On</button>`;
        buttons += `<button class="btn btn-secondary" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'turn_off')">Turn Off</button>`;
        buttons += `<button class="btn btn-secondary" onclick="triggerSharedEntity('${escapeHtml(entityId)}', 'toggle')">Toggle</button>`;
    }
    
    return buttons;
}

async function triggerSharedEntity(entityId, service) {
    try {
        const response = await fetch(`${API_BASE}/shared-entity/${encodeURIComponent(entityId)}/trigger`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                service: service,
                data: {}
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to trigger entity');
        }
        
        showSuccess('Entity triggered successfully');
        
        // Refresh entity state after a short delay
        setTimeout(() => {
            const modal = document.getElementById('entityModal');
            if (modal) {
                // Close and reopen to refresh
                const entityIdMatch = modal.querySelector('.modal-header h2');
                if (entityIdMatch) {
                    closeEntityModal();
                    // Get owner and access mode from the shared entity list
                    const sharedItem = sharedWithMe.find(item => item.EntityID === entityId);
                    if (sharedItem) {
                        viewSharedEntity(entityId, sharedItem.Owner.username, sharedItem.AccessMode);
                    }
                }
            }
            // Also refresh the state in the list
            loadSharedEntityState(entityId);
        }, 1000);
        
    } catch (error) {
        console.error('Error triggering shared entity:', error);
        showError('Failed to trigger entity: ' + error.message);
    }
}

function closeEntityModal(event) {
    if (event && event.target.classList.contains('modal-content')) {
        return;
    }
    const modal = document.getElementById('entityModal');
    if (modal) {
        modal.remove();
    }
}

async function viewSharedEntity(entityId, ownerName, accessMode) {
    alert(`Viewing entity ${entityId} shared by ${ownerName}\nAccess Mode: ${accessMode}\n\nThis would show entity details and controls if triggerable.`);
    // TODO: Implement entity details view with real-time state
}

// My Shared Entities functionality
async function loadMySharedEntities() {
    try {
        const response = await fetch(`${API_BASE}/my-shares`, {
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) throw new Error('Failed to load my shared entities');
        
        mySharedEntities = await response.json();
        renderMySharedEntities();
    } catch (error) {
        console.error('Error loading my shared entities:', error);
        showError('Failed to load my shared entities: ' + error.message);
    }
}

async function renderMySharedEntities() {
    const container = document.getElementById('mySharedEntitiesList');
    
    if (!mySharedEntities || mySharedEntities.length === 0) {
        container.innerHTML = '<div class="empty-state">You haven\'t shared any entities with other users yet.</div>';
        return;
    }
    
    // Group by target user
    const groupedByUser = {};
    mySharedEntities.forEach(item => {
        const targetName = item.SharedUser ? item.SharedUser.username : 'Unknown';
        if (!groupedByUser[targetName]) {
            groupedByUser[targetName] = [];
        }
        groupedByUser[targetName].push(item);
    });
    
    container.innerHTML = Object.keys(groupedByUser).map(targetName => {
        const entities = groupedByUser[targetName];
        const entitiesHtml = entities.map(item => `
            <div class="entity-item">
                <div class="entity-info">
                    <div class="entity-id">${escapeHtml(item.EntityID)}</div>
                    <div class="entity-state">
                        <span class="badge badge-${item.AccessMode === 'triggerable' ? 'success' : 'info'}">
                            ${item.AccessMode === 'triggerable' ? '🎛️ Triggerable' : '👁️ Read-Only'}
                        </span>
                    </div>
                </div>
                <button class="btn btn-danger" onclick="unshareEntity(${item.ID})">
                    Unshare
                </button>
            </div>
        `).join('');
        
        return `
            <div class="shared-group">
                <h3 class="shared-owner">👤 Shared with: ${escapeHtml(targetName)}</h3>
                ${entitiesHtml}
            </div>
        `;
    }).join('');
}

async function unshareEntity(sharedEntityId) {
    if (!confirm('Are you sure you want to unshare this entity?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/shared-entity/${sharedEntityId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) throw new Error('Failed to unshare entity');
        
        showSuccess('Entity unshared successfully');
        await loadMySharedEntities();
    } catch (error) {
        console.error('Error unsharing entity:', error);
        showError('Failed to unshare entity: ' + error.message);
    }
}

// Settings functionality
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
    
    // Load OTP status
    loadOTPStatus();
    
    // Setup form listeners only once
    if (!settingsListenersSet) {
        const passwordForm = document.getElementById('passwordForm');
        const haConfigForm = document.getElementById('haConfigForm');
        const otpEnableForm = document.getElementById('otpEnableForm');
        const otpDisableFormElement = document.getElementById('otpDisableFormElement');
        
        if (passwordForm) {
            passwordForm.addEventListener('submit', handlePasswordChange);
        }
        
        if (haConfigForm) {
            haConfigForm.addEventListener('submit', handleHAConfig);
        }
        
        if (otpEnableForm) {
            otpEnableForm.addEventListener('submit', handleOTPEnable);
        }
        
        if (otpDisableFormElement) {
            otpDisableFormElement.addEventListener('submit', handleOTPDisable);
        }
        
        settingsListenersSet = true;
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showError('New passwords do not match');
        return;
    }

    if (newPassword.length < 8) {
        showError('Password must be at least 8 characters long');
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

        showSuccess('Password changed successfully!');
        document.getElementById('passwordForm').reset();
    } catch (error) {
        console.error('Error changing password:', error);
        showError('Error: ' + error.message);
    }
}

async function handleHAConfig(e) {
    e.preventDefault();

    const haUrl = document.getElementById('haUrl').value.trim();
    const haToken = document.getElementById('haToken').value.trim();

    if (!haUrl || !haToken) {
        showError('All fields are required');
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

        showSuccess('Home Assistant configuration saved successfully!');
        document.getElementById('haConfigForm').reset();
        await loadSettings();
    } catch (error) {
        console.error('Error saving HA config:', error);
        showError('Error: ' + error.message);
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
        const otpStatus = document.getElementById('otpStatus');
        if (otpStatus) {
            otpStatus.style.display = 'none';
        }
        
        const otpEnableSection = document.getElementById('otpEnableSection');
        const otpDisableSection = document.getElementById('otpDisableSection');
        
        if (otpEnabled) {
            if (otpDisableSection) otpDisableSection.style.display = 'block';
            if (otpEnableSection) otpEnableSection.style.display = 'none';
        } else {
            if (otpEnableSection) otpEnableSection.style.display = 'block';
            if (otpDisableSection) otpDisableSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading OTP status:', error);
        const otpStatus = document.getElementById('otpStatus');
        if (otpStatus) {
            otpStatus.innerHTML = '<p class="error">Failed to load OTP status</p>';
        }
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
        if (qrCodeDiv) {
            qrCodeDiv.innerHTML = `<img src="${data.qr_code}" alt="QR Code" style="display: block; margin: 10px auto;" />`;
        }
        
        // Show secret
        const otpSecretDiv = document.getElementById('otpSecret');
        if (otpSecretDiv) {
            otpSecretDiv.textContent = data.secret;
        }

        // Show setup form
        const otpEnableSection = document.getElementById('otpEnableSection');
        const otpSetupSection = document.getElementById('otpSetupSection');
        if (otpEnableSection) otpEnableSection.style.display = 'none';
        if (otpSetupSection) otpSetupSection.style.display = 'block';
    } catch (error) {
        console.error('Error setting up OTP:', error);
        showError('Error: ' + error.message);
    }
}

async function handleOTPEnable(e) {
    e.preventDefault();

    const passwordInput = document.getElementById('otpPassword');
    const codeInput = document.getElementById('otpCode');
    
    if (!passwordInput || !codeInput) {
        showError('Form fields not found');
        return;
    }

    const password = passwordInput.value;
    const code = codeInput.value;

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
        if (backupCodesDiv) {
            backupCodesDiv.innerHTML = data.backup_codes.map(code => `<div>${escapeHtml(code)}</div>`).join('');
        }
        
        const otpSetupSection = document.getElementById('otpSetupSection');
        const backupCodesSection = document.getElementById('backupCodesSection');
        if (otpSetupSection) otpSetupSection.style.display = 'none';
        if (backupCodesSection) backupCodesSection.style.display = 'block';
        
        const otpEnableForm = document.getElementById('otpEnableForm');
        if (otpEnableForm) otpEnableForm.reset();
    } catch (error) {
        console.error('Error enabling OTP:', error);
        showError('Error: ' + error.message);
    }
}

function closeBackupCodes() {
    const backupCodesSection = document.getElementById('backupCodesSection');
    if (backupCodesSection) backupCodesSection.style.display = 'none';
    loadOTPStatus();
}

function cancelOTPSetup() {
    const otpSetupSection = document.getElementById('otpSetupSection');
    const otpEnableSection = document.getElementById('otpEnableSection');
    const otpEnableForm = document.getElementById('otpEnableForm');
    
    if (otpSetupSection) otpSetupSection.style.display = 'none';
    if (otpEnableSection) otpEnableSection.style.display = 'block';
    if (otpEnableForm) otpEnableForm.reset();
    currentOTPSecret = '';
}

function disableOTP() {
    const otpDisableSection = document.getElementById('otpDisableSection');
    const otpDisableForm = document.getElementById('otpDisableForm');
    
    if (otpDisableSection) otpDisableSection.style.display = 'none';
    if (otpDisableForm) otpDisableForm.style.display = 'block';
}

function cancelDisableOTP() {
    const otpDisableForm = document.getElementById('otpDisableForm');
    const otpDisableSection = document.getElementById('otpDisableSection');
    const otpDisableFormElement = document.getElementById('otpDisableFormElement');
    
    if (otpDisableForm) otpDisableForm.style.display = 'none';
    if (otpDisableSection) otpDisableSection.style.display = 'block';
    if (otpDisableFormElement) otpDisableFormElement.reset();
}

async function handleOTPDisable(e) {
    e.preventDefault();

    const passwordInput = document.getElementById('disableOtpPassword');
    if (!passwordInput) {
        showError('Password field not found');
        return;
    }

    const password = passwordInput.value;

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

        showSuccess('Two-factor authentication has been disabled');
        
        const otpDisableFormElement = document.getElementById('otpDisableFormElement');
        const otpDisableForm = document.getElementById('otpDisableForm');
        
        if (otpDisableFormElement) otpDisableFormElement.reset();
        if (otpDisableForm) otpDisableForm.style.display = 'none';
        
        loadOTPStatus();
    } catch (error) {
        console.error('Error disabling OTP:', error);
        showError('Error: ' + error.message);
    }
}
