// Shared utility functions

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
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
