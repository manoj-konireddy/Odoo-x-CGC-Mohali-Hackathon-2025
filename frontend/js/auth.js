// Authentication management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initPromise = this.init();
    }

    async init() {
        console.log('AuthManager initializing...');
        // Check if user is already logged in
        const token = api.getToken();
        console.log('Found token:', !!token);

        if (token) {
            try {
                console.log('Validating token...');
                const response = await api.getCurrentUser();
                this.currentUser = response.user;
                console.log('Token valid, user:', this.currentUser.username);
                this.updateUI();
            } catch (error) {
                console.log('Token invalid, logging out:', error.message);
                // Token is invalid, remove it
                this.logout();
            }
        } else {
            console.log('No token found');
        }
        console.log('AuthManager initialization complete');
    }

    async login(email, password) {
        try {
            const response = await api.login({ email, password });
            this.currentUser = response.user;
            this.updateUI();
            showAlert('Login successful!', 'success');
            showPage('dashboard');
            return true;
        } catch (error) {
            showAlert(error.message, 'danger');
            return false;
        }
    }

    async register(userData) {
        try {
            await api.register(userData);
            showAlert('Registration successful! Please login.', 'success');
            showPage('login');
            return true;
        } catch (error) {
            showAlert(error.message, 'danger');
            return false;
        }
    }

    logout() {
        api.removeToken();
        this.currentUser = null;
        this.updateUI();
        showAlert('Logged out successfully', 'info');
        showPage('home');
    }

    updateUI() {
        const isLoggedIn = !!this.currentUser;
        
        // Update navigation
        document.getElementById('nav-login').style.display = isLoggedIn ? 'none' : 'block';
        document.getElementById('nav-register').style.display = isLoggedIn ? 'none' : 'block';
        document.getElementById('nav-dashboard').style.display = isLoggedIn ? 'block' : 'none';
        document.getElementById('nav-user').style.display = isLoggedIn ? 'block' : 'none';
        
        // Update sidebar
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        
        if (isLoggedIn) {
            sidebar.style.display = 'block';
            mainContent.classList.remove('col-12');
            mainContent.classList.add('col-md-10', 'ms-sm-auto');
            
            // Update username display
            document.getElementById('username-display').textContent = this.currentUser.username;
            
            // Show/hide admin features
            const isAdmin = this.currentUser.role === 'admin';
            const isAgent = this.currentUser.role === 'agent' || isAdmin;
            
            document.getElementById('sidebar-all-tickets').style.display = isAgent ? 'block' : 'none';
            document.getElementById('sidebar-users').style.display = isAdmin ? 'block' : 'none';
            document.getElementById('sidebar-categories').style.display = isAdmin ? 'block' : 'none';
        } else {
            sidebar.style.display = 'none';
            mainContent.classList.remove('col-md-10', 'ms-sm-auto');
            mainContent.classList.add('col-12');
        }

        // Show/hide navigation controls
        const navigationControls = document.getElementById('navigation-controls');
        if (navigationControls) {
            navigationControls.style.display = isLoggedIn ? 'block' : 'none';
        }
    }

    isLoggedIn() {
        const loggedIn = !!this.currentUser;
        console.log('isLoggedIn check:', loggedIn, 'currentUser:', this.currentUser);
        return loggedIn;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    isAgent() {
        return this.currentUser && (this.currentUser.role === 'agent' || this.currentUser.role === 'admin');
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Create global auth manager instance
const authManager = new AuthManager();

// Global logout function
function logout() {
    authManager.logout();
}
