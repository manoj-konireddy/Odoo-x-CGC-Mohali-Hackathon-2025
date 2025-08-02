// API configuration and utilities
const API_BASE_URL = 'http://localhost:5000/api';

class API {
    constructor() {
        this.baseURL = API_BASE_URL;
    }

    // Get auth token from localStorage
    getToken() {
        return localStorage.getItem('token');
    }

    // Set auth token in localStorage
    setToken(token) {
        localStorage.setItem('token', token);
    }

    // Remove auth token from localStorage
    removeToken() {
        localStorage.removeItem('token');
    }

    // Get auth headers
    getAuthHeaders() {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    // Generic API request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        try {
            showLoading(true);
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // Authentication methods
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async login(credentials) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        if (response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    // Category methods
    async getCategories() {
        return this.request('/categories');
    }

    async createCategory(categoryData) {
        return this.request('/categories', {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    }

    // Ticket methods
    async getTickets(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/tickets?${queryString}` : '/tickets';
        return this.request(endpoint);
    }

    async getTicket(id) {
        return this.request(`/tickets/${id}`);
    }

    async createTicket(ticketData) {
        return this.request('/tickets', {
            method: 'POST',
            body: JSON.stringify(ticketData)
        });
    }

    async updateTicket(id, ticketData) {
        return this.request(`/tickets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(ticketData)
        });
    }

    async deleteTicket(id) {
        return this.request(`/tickets/${id}`, {
            method: 'DELETE'
        });
    }

    async deleteTicket(id) {
        return this.request(`/tickets/${id}`, {
            method: 'DELETE'
        });
    }

    // Comment methods
    async getComments(ticketId) {
        return this.request(`/tickets/${ticketId}/comments`);
    }

    async createComment(ticketId, commentData) {
        return this.request(`/tickets/${ticketId}/comments`, {
            method: 'POST',
            body: JSON.stringify(commentData)
        });
    }

    // Vote methods
    async voteTicket(ticketId, voteType) {
        return this.request(`/tickets/${ticketId}/vote`, {
            method: 'POST',
            body: JSON.stringify({ vote_type: voteType })
        });
    }

    async getTicketVotes(ticketId) {
        return this.request(`/tickets/${ticketId}/vote`);
    }

    // User methods (admin only)
    async getUsers() {
        return this.request('/users');
    }

    async updateUser(id, userData) {
        return this.request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async updateUser(id, userData) {
        return this.request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(id) {
        return this.request(`/users/${id}`, {
            method: 'DELETE'
        });
    }

    // Category management methods
    async updateCategory(id, categoryData) {
        return this.request(`/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(categoryData)
        });
    }

    async deleteCategory(id) {
        return this.request(`/categories/${id}`, {
            method: 'DELETE'
        });
    }

    // File attachment methods
    async uploadAttachment(ticketId, file) {
        const formData = new FormData();
        formData.append('file', file);

        const token = this.getToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            showLoading(true);
            const response = await fetch(`${this.baseURL}/tickets/${ticketId}/attachments`, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'File upload failed');
            }

            return data;
        } catch (error) {
            console.error('Upload Error:', error);
            throw error;
        } finally {
            showLoading(false);
        }
    }

    async getAttachments(ticketId) {
        return this.request(`/tickets/${ticketId}/attachments`);
    }

    async downloadAttachment(attachmentId) {
        const token = this.getToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${this.baseURL}/attachments/${attachmentId}/download`, {
                headers: headers
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            return response.blob();
        } catch (error) {
            console.error('Download Error:', error);
            throw error;
        }
    }
}

// Create global API instance
const api = new API();

// Utility functions
function showLoading(show) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.classList.toggle('d-none', !show);
    }
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;

    const alertId = 'alert-' + Date.now();
    const alertHTML = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHTML);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        const alertElement = document.getElementById(alertId);
        if (alertElement) {
            alertElement.remove();
        }
    }, 5000);
}

function clearAlerts() {
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
        alertContainer.innerHTML = '';
    }
}

// Format date utility
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Format relative time utility
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return formatDate(dateString);
}

// Get status badge HTML
function getStatusBadge(status) {
    const statusMap = {
        'open': { class: 'status-open', text: 'Open' },
        'in_progress': { class: 'status-in_progress', text: 'In Progress' },
        'resolved': { class: 'status-resolved', text: 'Resolved' },
        'closed': { class: 'status-closed', text: 'Closed' }
    };
    
    const statusInfo = statusMap[status] || { class: 'bg-secondary', text: status };
    return `<span class="badge ${statusInfo.class} status-badge">${statusInfo.text}</span>`;
}

// Get priority badge HTML
function getPriorityBadge(priority) {
    const priorityMap = {
        'low': { class: 'priority-low', text: 'Low' },
        'medium': { class: 'priority-medium', text: 'Medium' },
        'high': { class: 'priority-high', text: 'High' },
        'urgent': { class: 'priority-urgent', text: 'Urgent' }
    };
    
    const priorityInfo = priorityMap[priority] || { class: 'bg-secondary', text: priority };
    return `<span class="badge ${priorityInfo.class} priority-badge">${priorityInfo.text}</span>`;
}
