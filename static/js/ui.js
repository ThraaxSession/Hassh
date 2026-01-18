// UI Helper Functions - Toast Notifications and Dialog Boxes

// Toast notification system
const Toast = {
    container: null,
    
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    
    show(message, type = 'info', duration = 4000, title = '') {
        this.init();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '📣';
        let defaultTitle = 'Notification';
        
        switch(type) {
            case 'success':
                icon = '✅';
                defaultTitle = 'Success';
                break;
            case 'error':
                icon = '❌';
                defaultTitle = 'Error';
                break;
            case 'warning':
                icon = '⚠️';
                defaultTitle = 'Warning';
                break;
            case 'info':
                icon = 'ℹ️';
                defaultTitle = 'Info';
                break;
        }
        
        const toastTitle = title || defaultTitle;
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">
                <div class="toast-title">${escapeHtml(toastTitle)}</div>
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="toast-close" onclick="Toast.close(this.parentElement)">×</button>
        `;
        
        this.container.appendChild(toast);
        
        if (duration > 0) {
            setTimeout(() => {
                this.close(toast);
            }, duration);
        }
        
        return toast;
    },
    
    close(toast) {
        if (toast && toast.parentElement) {
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
            }, 300);
        }
    },
    
    success(message, title = '') {
        return this.show(message, 'success', 4000, title);
    },
    
    error(message, title = '') {
        return this.show(message, 'error', 5000, title);
    },
    
    warning(message, title = '') {
        return this.show(message, 'warning', 4500, title);
    },
    
    info(message, title = '') {
        return this.show(message, 'info', 3500, title);
    }
};

// Dialog box system (replacement for alert/confirm)
const Dialog = {
    show(options) {
        const {
            title = 'Notification',
            message = '',
            type = 'info',
            buttons = [{ text: 'OK', primary: true }],
            onClose = null
        } = options;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.style.display = 'flex';
        
        let icon = 'ℹ️';
        let iconClass = 'info';
        
        switch(type) {
            case 'success':
                icon = '✅';
                iconClass = 'success';
                break;
            case 'error':
                icon = '❌';
                iconClass = 'error';
                break;
            case 'warning':
                icon = '⚠️';
                iconClass = 'warning';
                break;
            case 'info':
                icon = 'ℹ️';
                iconClass = 'info';
                break;
        }
        
        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        
        const buttonHTML = buttons.map((btn, index) => {
            const btnClass = btn.primary ? 'dialog-btn-primary' : 'dialog-btn-secondary';
            return `<button class="dialog-btn ${btnClass}" data-index="${index}">${escapeHtml(btn.text)}</button>`;
        }).join('');
        
        dialog.innerHTML = `
            <div class="dialog-header">
                <span class="dialog-icon ${iconClass}">${icon}</span>
                <div class="dialog-title">${escapeHtml(title)}</div>
            </div>
            <div class="dialog-body">${escapeHtml(message)}</div>
            <div class="dialog-footer">
                ${buttonHTML}
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Handle button clicks
        const dialogButtons = dialog.querySelectorAll('.dialog-btn');
        dialogButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-index'));
                const button = buttons[index];
                
                if (button.onClick) {
                    button.onClick();
                }
                
                this.close(overlay);
                
                if (onClose) {
                    onClose(index);
                }
            });
        });
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.close(overlay);
                if (onClose) {
                    onClose(-1);
                }
            }
        });
        
        return overlay;
    },
    
    close(overlay) {
        if (overlay && overlay.parentElement) {
            overlay.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (overlay.parentElement) {
                    overlay.parentElement.removeChild(overlay);
                }
            }, 300);
        }
    },
    
    alert(message, title = 'Alert', type = 'info') {
        return new Promise((resolve) => {
            this.show({
                title,
                message,
                type,
                buttons: [{ text: 'OK', primary: true }],
                onClose: () => resolve()
            });
        });
    },
    
    confirm(message, title = 'Confirm', type = 'warning') {
        return new Promise((resolve) => {
            this.show({
                title,
                message,
                type,
                buttons: [
                    { text: 'Cancel', primary: false },
                    { text: 'OK', primary: true }
                ],
                onClose: (index) => resolve(index === 1)
            });
        });
    }
};

// Theme management
const Theme = {
    init() {
        // Check for saved theme preference or default to light
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.set(savedTheme);
        
        // Create theme toggle button if it doesn't exist
        if (!document.querySelector('.theme-toggle')) {
            this.createToggleButton();
        }
    },
    
    set(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
        
        // Update toggle button icon if it exists
        const toggleBtn = document.querySelector('.theme-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    },
    
    toggle() {
        const isDark = document.body.classList.contains('dark-theme');
        this.set(isDark ? 'light' : 'dark');
    },
    
    createToggleButton() {
        const button = document.createElement('button');
        button.className = 'theme-toggle';
        button.setAttribute('aria-label', 'Toggle theme');
        button.textContent = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
        button.onclick = () => this.toggle();
        document.body.appendChild(button);
    }
};

// Initialize theme on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Theme.init());
} else {
    Theme.init();
}

// Add fadeOut animation to CSS if not present
if (!document.querySelector('style[data-ui-animations]')) {
    const style = document.createElement('style');
    style.setAttribute('data-ui-animations', 'true');
    style.textContent = `
        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
