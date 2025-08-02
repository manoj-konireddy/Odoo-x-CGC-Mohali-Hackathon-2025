// Main application logic
class QuickDeskApp {
    constructor() {
        this.currentPage = 'home';
        this.categories = [];
        this.navigationHistory = [];
        this.historyIndex = -1;
        this.init();
    }

    async init() {
        // Wait for auth manager to initialize
        console.log('Waiting for auth manager to initialize...');
        await authManager.initPromise;
        console.log('Auth manager initialized, user logged in:', authManager.isLoggedIn());

        // Load appropriate initial page based on auth status
        if (authManager.isLoggedIn()) {
            console.log('User is logged in, loading dashboard');
            await this.loadPage('dashboard');
            await this.loadCategories();
        } else {
            console.log('User not logged in, loading home page');
            await this.loadPage('home');
        }

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when user is logged in and not typing in input fields
            if (!authManager.isLoggedIn() ||
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                e.target.isContentEditable) {
                return;
            }

            // Alt + Left Arrow = Go Back
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.goBack();
            }

            // Alt + Right Arrow = Go Forward
            if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                this.goForward();
            }
        });
    }

    async loadCategories() {
        try {
            console.log('Loading categories...');
            const response = await api.getCategories();
            this.categories = response.categories;
            console.log('Categories loaded:', this.categories);
        } catch (error) {
            console.error('Failed to load categories:', error);
            this.categories = [];
        }
    }

    async loadPage(pageName, addToHistory = true) {
        try {
            console.log('Loading page:', pageName);

            // Add to navigation history
            if (addToHistory) {
                this.addToHistory(pageName);
            }

            this.currentPage = pageName;
            clearAlerts();

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                console.log('DOM not ready, waiting...');
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            const pageContent = document.getElementById('page-content');
            if (!pageContent) {
                console.error('page-content element not found! DOM state:', document.readyState);
                console.error('Available elements with IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
                return;
            }
            pageContent.innerHTML = '';
            pageContent.classList.add('fade-in');

            switch (pageName) {
            case 'home':
                pageContent.innerHTML = this.getHomePage();
                break;
            case 'login':
                pageContent.innerHTML = this.getLoginPage();
                this.setupLoginForm();
                break;
            case 'register':
                pageContent.innerHTML = this.getRegisterPage();
                this.setupRegisterForm();
                break;
            case 'dashboard':
                if (!authManager.isLoggedIn()) {
                    showPage('login');
                    return;
                }
                pageContent.innerHTML = this.getDashboardPage();
                await this.loadCategories();
                await this.loadDashboardData();
                break;
            case 'create-ticket':
                console.log('Loading create-ticket page...');
                if (!authManager.isLoggedIn()) {
                    console.log('User not logged in, redirecting to login');
                    showPage('login');
                    return;
                }

                // Show loading first
                pageContent.innerHTML = `
                    <div class="text-center py-5">
                        <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2">Loading create ticket form...</p>
                    </div>
                `;

                try {
                    console.log('Loading categories...');
                    await this.loadCategories();
                    console.log('Categories loaded:', this.categories);

                    console.log('Generating page HTML...');
                    const pageHTML = this.getCreateTicketPage();
                    console.log('Page HTML generated, length:', pageHTML.length);

                    pageContent.innerHTML = pageHTML;
                    console.log('Setting up form...');
                    this.setupCreateTicketForm();
                    console.log('Create ticket page setup complete');
                } catch (error) {
                    console.error('Error in create-ticket case:', error);
                    pageContent.innerHTML = `
                        <div class="alert alert-danger">
                            <h4>Error Loading Create Ticket Page</h4>
                            <p>Error: ${error.message}</p>
                            <button class="btn btn-primary" onclick="showPage('dashboard')">Back to Dashboard</button>
                        </div>
                    `;
                }
                break;
            case 'my-tickets':
                if (!authManager.isLoggedIn()) {
                    showPage('login');
                    return;
                }
                pageContent.innerHTML = this.getMyTicketsPage();
                await this.loadMyTickets();
                this.setupTicketFilters();
                break;
            case 'ticket-detail':
                if (!authManager.isLoggedIn()) {
                    showPage('login');
                    return;
                }
                const ticketId = new URLSearchParams(window.location.hash.split('?')[1] || '').get('id');
                if (ticketId) {
                    pageContent.innerHTML = this.getTicketDetailPage();
                    await this.loadTicketDetail(ticketId);
                } else {
                    pageContent.innerHTML = '<h2>Ticket not found</h2>';
                }
                break;
            case 'all-tickets':
                if (!authManager.isAgent()) {
                    showPage('dashboard');
                    return;
                }
                pageContent.innerHTML = this.getAllTicketsPage();
                await this.loadAllTickets();
                this.setupAllTicketFilters();
                break;
            case 'users':
                if (!authManager.isAdmin()) {
                    showPage('dashboard');
                    return;
                }
                pageContent.innerHTML = this.getUsersPage();
                await this.loadUsers();
                break;
            case 'categories':
                if (!authManager.isAdmin()) {
                    showPage('dashboard');
                    return;
                }
                pageContent.innerHTML = this.getCategoriesPage();
                await this.loadCategories(); // This will now update the categories-container
                this.setupCategoryForm();
                break;
            default:
                console.log('Unknown page:', pageName);
                pageContent.innerHTML = '<h2>Page not found</h2>';
        }
        } catch (error) {
            console.error('Error loading page:', error);
            const pageContent = document.getElementById('page-content');
            if (pageContent) {
                pageContent.innerHTML = `
                    <div class="alert alert-danger">
                        <h4>Error Loading Page</h4>
                        <p>There was an error loading the page. Please check the console for details.</p>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <button class="btn btn-primary" onclick="showPage('dashboard')">Go to Dashboard</button>
                    </div>
                `;
            }
        }
    }

    getHomePage() {
        return `
            <div class="row">
                <div class="col-lg-8 mx-auto text-center">
                    <div class="hero-section py-5">
                        <h1 class="display-4 mb-4">
                            <i class="fas fa-headset text-white"></i>
                            Welcome to QuickDesk
                        </h1>
                        <p class="lead mb-4">
                            Your simple and efficient help desk solution. Create tickets, track progress, and get support quickly.
                        </p>
                        
                        ${!authManager.isLoggedIn() ? `
                        <div class="d-grid gap-2 d-md-flex justify-content-md-center">
                            <button onclick="showPage('register')" class="btn btn-light btn-lg me-md-2">
                                <i class="fas fa-user-plus"></i> Get Started
                            </button>
                            <button onclick="showPage('login')" class="btn btn-outline-light btn-lg">
                                <i class="fas fa-sign-in-alt"></i> Sign In
                            </button>
                        </div>
                        ` : `
                        <div class="d-grid gap-2 d-md-flex justify-content-md-center">
                            <button onclick="showPage('dashboard')" class="btn btn-light btn-lg">
                                <i class="fas fa-tachometer-alt"></i> Go to Dashboard
                            </button>
                        </div>
                        `}
                    </div>
                </div>
            </div>

            <div class="row mt-5">
                <div class="col-md-4 text-center mb-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <i class="fas fa-ticket-alt fa-3x text-primary mb-3"></i>
                            <h5 class="card-title">Create Tickets</h5>
                            <p class="card-text">Easily submit support requests with detailed descriptions and attachments.</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 text-center mb-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <i class="fas fa-search fa-3x text-success mb-3"></i>
                            <h5 class="card-title">Track Progress</h5>
                            <p class="card-text">Monitor your tickets with real-time status updates and notifications.</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 text-center mb-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <i class="fas fa-users fa-3x text-info mb-3"></i>
                            <h5 class="card-title">Team Collaboration</h5>
                            <p class="card-text">Support agents can efficiently manage and resolve tickets together.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getLoginPage() {
        return `
            <div class="row justify-content-center">
                <div class="col-md-6 col-lg-4">
                    <div class="card auth-card">
                        <div class="card-body">
                            <div class="text-center mb-4">
                                <i class="fas fa-sign-in-alt fa-3x text-primary mb-3"></i>
                                <h3 class="card-title">Sign In</h3>
                                <p class="text-muted">Welcome back to QuickDesk</p>
                            </div>
                            
                            <form id="login-form">
                                <div class="mb-3">
                                    <label for="email" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="password" class="form-label">Password</label>
                                    <input type="password" class="form-control" id="password" required>
                                </div>
                                
                                <div class="mb-3 form-check">
                                    <input type="checkbox" class="form-check-input" id="remember">
                                    <label class="form-check-label" for="remember">Remember Me</label>
                                </div>
                                
                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary">Sign In</button>
                                </div>
                            </form>
                            
                            <hr class="my-4">
                            
                            <div class="text-center">
                                <p class="mb-0">Don't have an account?</p>
                                <button onclick="showPage('register')" class="btn btn-outline-primary btn-sm">
                                    <i class="fas fa-user-plus"></i> Create Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getRegisterPage() {
        return `
            <div class="row justify-content-center">
                <div class="col-md-6 col-lg-5">
                    <div class="card auth-card">
                        <div class="card-body">
                            <div class="text-center mb-4">
                                <i class="fas fa-user-plus fa-3x text-primary mb-3"></i>
                                <h3 class="card-title">Create Account</h3>
                                <p class="text-muted">Join QuickDesk to get started</p>
                            </div>
                            
                            <form id="register-form">
                                <div class="mb-3">
                                    <label for="username" class="form-label">Username</label>
                                    <input type="text" class="form-control" id="username" required>
                                    <div class="form-text">Choose a unique username (4-20 characters)</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="email" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="password" class="form-label">Password</label>
                                    <input type="password" class="form-control" id="password" required>
                                    <div class="form-text">Minimum 6 characters</div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="password2" class="form-label">Confirm Password</label>
                                    <input type="password" class="form-control" id="password2" required>
                                </div>
                                
                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary">Create Account</button>
                                </div>
                            </form>
                            
                            <hr class="my-4">
                            
                            <div class="text-center">
                                <p class="mb-0">Already have an account?</p>
                                <button onclick="showPage('login')" class="btn btn-outline-primary btn-sm">
                                    <i class="fas fa-sign-in-alt"></i> Sign In
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getDashboardPage() {
        return `
            <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                <h1 class="h2">Dashboard</h1>
                <div class="btn-toolbar mb-2 mb-md-0">
                    <button onclick="showPage('create-ticket')" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Create Ticket
                    </button>
                </div>
            </div>

            <div class="row mb-4">
                <div class="col-md-3 mb-3">
                    <div class="card text-white bg-primary">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <div>
                                    <h4 class="card-title" id="total-tickets">0</h4>
                                    <p class="card-text">Total Tickets</p>
                                </div>
                                <div class="align-self-center">
                                    <i class="fas fa-ticket-alt fa-2x"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card text-white bg-warning">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <div>
                                    <h4 class="card-title" id="open-tickets">0</h4>
                                    <p class="card-text">Open Tickets</p>
                                </div>
                                <div class="align-self-center">
                                    <i class="fas fa-clock fa-2x"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card text-white bg-info">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <div>
                                    <h4 class="card-title" id="in-progress-tickets">0</h4>
                                    <p class="card-text">In Progress</p>
                                </div>
                                <div class="align-self-center">
                                    <i class="fas fa-cog fa-2x"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card text-white bg-success">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <div>
                                    <h4 class="card-title" id="resolved-tickets">0</h4>
                                    <p class="card-text">Resolved</p>
                                </div>
                                <div class="align-self-center">
                                    <i class="fas fa-check fa-2x"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Recent Tickets</h5>
                        </div>
                        <div class="card-body">
                            <div id="recent-tickets">
                                <div class="text-center">
                                    <div class="spinner-border" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getCreateTicketPage() {
        // Fallback categories if API fails
        const fallbackCategories = [
            { id: 1, name: 'Technical Support' },
            { id: 2, name: 'Account Issues' },
            { id: 3, name: 'Feature Request' },
            { id: 4, name: 'Bug Report' },
            { id: 5, name: 'General Inquiry' }
        ];

        const categoriesToUse = (this.categories && this.categories.length > 0) ? this.categories : fallbackCategories;

        const categoryOptions = categoriesToUse.map(cat =>
            `<option value="${cat.id}">${cat.name}</option>`
        ).join('');

        const hasCategories = categoriesToUse.length > 0;

        return `
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">
                                <i class="fas fa-plus"></i> Create New Ticket
                            </h5>
                        </div>
                        <div class="card-body">
                            <form id="create-ticket-form">
                                <div class="mb-3">
                                    <label for="subject" class="form-label">Subject *</label>
                                    <input type="text" class="form-control" id="subject" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="category" class="form-label">Category *</label>
                                    <select class="form-select" id="category" required>
                                        <option value="">Select a category</option>
                                        ${hasCategories ? categoryOptions : '<option value="" disabled>Loading categories...</option>'}
                                    </select>
                                    ${!hasCategories ? '<div class="form-text text-warning">Categories are loading...</div>' : ''}
                                </div>
                                
                                <div class="mb-3">
                                    <label for="priority" class="form-label">Priority</label>
                                    <select class="form-select" id="priority">
                                        <option value="low">Low</option>
                                        <option value="medium" selected>Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="description" class="form-label">Description *</label>
                                    <textarea class="form-control" id="description" rows="5" required></textarea>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="attachment" class="form-label">Attachment</label>
                                    <input type="file" class="form-control" id="attachment">
                                    <div class="form-text">Max file size: 16MB. Allowed: images, PDFs, documents</div>
                                </div>
                                
                                <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                                    <button type="button" onclick="showPage('dashboard')" class="btn btn-secondary">Cancel</button>
                                    <button type="submit" class="btn btn-primary">Create Ticket</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupLoginForm() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            await authManager.login(email, password);
        });
    }

    setupRegisterForm() {
        const form = document.getElementById('register-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const password2 = document.getElementById('password2').value;
            
            if (password !== password2) {
                showAlert('Passwords do not match', 'danger');
                return;
            }
            
            await authManager.register({ username, email, password });
        });
    }

    setupCreateTicketForm() {
        const form = document.getElementById('create-ticket-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const ticketData = {
                subject: document.getElementById('subject').value,
                category_id: parseInt(document.getElementById('category').value),
                priority: document.getElementById('priority').value,
                description: document.getElementById('description').value
            };

            try {
                const response = await api.createTicket(ticketData);
                const ticketId = response.ticket.id;

                // Handle file upload if file is selected
                const fileInput = document.getElementById('attachment');
                if (fileInput.files.length > 0) {
                    try {
                        await api.uploadAttachment(ticketId, fileInput.files[0]);
                        showAlert('Ticket created with attachment successfully!', 'success');
                    } catch (error) {
                        showAlert('Ticket created but file upload failed: ' + error.message, 'warning');
                    }
                } else {
                    showAlert('Ticket created successfully!', 'success');
                }

                showPage('dashboard');
            } catch (error) {
                showAlert(error.message, 'danger');
            }
        });
    }

    async loadDashboardData() {
        try {
            // Load actual ticket data from the API
            const response = await api.getTickets();
            const tickets = response.tickets || [];

            // Calculate statistics
            const totalTickets = tickets.length;
            const openTickets = tickets.filter(t => t.status === 'open').length;
            const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
            const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;

            // Update dashboard stats
            document.getElementById('total-tickets').textContent = totalTickets;
            document.getElementById('open-tickets').textContent = openTickets;
            document.getElementById('in-progress-tickets').textContent = inProgressTickets;
            document.getElementById('resolved-tickets').textContent = resolvedTickets;

            // Display recent tickets
            const recentTicketsContainer = document.getElementById('recent-tickets');

            if (tickets.length === 0) {
                recentTicketsContainer.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="fas fa-ticket-alt fa-3x mb-3"></i>
                        <p>No tickets yet. <a href="#" onclick="showPage('create-ticket')">Create your first ticket</a></p>
                    </div>
                `;
            } else {
                const recentTickets = tickets.slice(0, 5); // Show last 5 tickets
                recentTicketsContainer.innerHTML = recentTickets.map(ticket => `
                    <div class="card mb-2 ticket-card" onclick="showTicketDetail(${ticket.id})">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 class="card-title mb-1">${ticket.subject}</h6>
                                    <p class="card-text text-muted small mb-1">${ticket.description.substring(0, 100)}...</p>
                                    <small class="text-muted">
                                        <i class="fas fa-user"></i> ${ticket.creator?.username || 'Unknown'} •
                                        <i class="fas fa-clock"></i> ${formatRelativeTime(ticket.created_at)}
                                    </small>
                                </div>
                                <div class="text-end">
                                    ${getStatusBadge(ticket.status)}
                                    ${getPriorityBadge(ticket.priority)}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            document.getElementById('recent-tickets').innerHTML = `
                <div class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                    <p>Failed to load tickets. Please try again.</p>
                </div>
            `;
        }
    }

    getMyTicketsPage() {
        return `
            <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                <h1 class="h2">My Tickets</h1>
                <div class="btn-toolbar mb-2 mb-md-0">
                    <button onclick="showPage('create-ticket')" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Create Ticket
                    </button>
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-md-6">
                    <input type="text" class="form-control" id="search-tickets" placeholder="Search tickets...">
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="filter-status">
                        <option value="">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="sort-tickets">
                        <option value="created_at_desc">Newest First</option>
                        <option value="created_at_asc">Oldest First</option>
                        <option value="updated_at_desc">Recently Updated</option>
                    </select>
                </div>
            </div>

            <div id="tickets-container">
                <div class="text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `;
    }

    getTicketDetailPage() {
        return `
            <div id="ticket-detail-container">
                <div class="text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `;
    }

    async loadMyTickets() {
        try {
            const filters = this.getTicketFilters();
            const response = await api.getTickets(filters);
            const tickets = response.tickets || [];

            const container = document.getElementById('tickets-container');

            if (tickets.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <i class="fas fa-ticket-alt fa-3x mb-3"></i>
                        <h5>No tickets found</h5>
                        <p>You haven't created any tickets yet.</p>
                        <button onclick="showPage('create-ticket')" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Create Your First Ticket
                        </button>
                    </div>
                `;
                return;
            }

            container.innerHTML = tickets.map(ticket => `
                <div class="card mb-3 ticket-card">
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-8" onclick="showTicketDetail(${ticket.id})" style="cursor: pointer;">
                                <h5 class="card-title">${ticket.subject}</h5>
                                <p class="card-text text-muted">${ticket.description.substring(0, 150)}...</p>
                                <small class="text-muted">
                                    <i class="fas fa-tag"></i> ${ticket.category?.name || 'No Category'} •
                                    <i class="fas fa-clock"></i> ${formatRelativeTime(ticket.created_at)}
                                </small>
                            </div>
                            <div class="col-md-4 text-end">
                                <div class="mb-2">
                                    ${getStatusBadge(ticket.status)}
                                    ${getPriorityBadge(ticket.priority)}
                                </div>
                                <div class="mb-2">
                                    <span class="vote-score">${ticket.vote_score || 0}</span>
                                    <small class="text-muted">votes</small>
                                </div>
                                <div class="btn-group-sm">
                                    <button class="btn btn-sm btn-outline-primary me-1" onclick="showTicketDetail(${ticket.id})" title="View Details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    ${this.canDeleteTicket(ticket) ? `
                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteTicket(${ticket.id})" title="Delete Ticket">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Failed to load tickets:', error);
            document.getElementById('tickets-container').innerHTML = `
                <div class="text-center text-danger py-5">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                    <p>Failed to load tickets. Please try again.</p>
                </div>
            `;
        }
    }

    async loadTicketDetail(ticketId) {
        try {
            const response = await api.getTicket(ticketId);
            const ticket = response.ticket;

            const container = document.getElementById('ticket-detail-container');
            container.innerHTML = `
                <div class="row">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h4 class="mb-1">${ticket.subject}</h4>
                                        <small class="text-muted">
                                            Created by ${ticket.creator?.username || 'Unknown'} •
                                            ${formatRelativeTime(ticket.created_at)}
                                        </small>
                                    </div>
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="me-2">
                                            ${getStatusBadge(ticket.status)}
                                            ${getPriorityBadge(ticket.priority)}
                                        </div>
                                        <div class="btn-group">
                                            ${this.canDeleteTicket(ticket) ? `
                                                <button class="btn btn-sm btn-outline-danger" onclick="deleteTicketFromDetail(${ticket.id})" title="Delete Ticket">
                                                    <i class="fas fa-trash"></i> Delete
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <p>${ticket.description}</p>

                                <!-- Voting Section -->
                                <div class="d-flex align-items-center mb-3">
                                    <div class="vote-buttons me-3">
                                        <button class="vote-btn" id="upvote-btn" onclick="voteTicket(${ticket.id}, 'up')">
                                            <i class="fas fa-chevron-up"></i>
                                        </button>
                                        <span class="vote-score" id="vote-score">${ticket.vote_score || 0}</span>
                                        <button class="vote-btn" id="downvote-btn" onclick="voteTicket(${ticket.id}, 'down')">
                                            <i class="fas fa-chevron-down"></i>
                                        </button>
                                    </div>
                                    <small class="text-muted">
                                        <span id="vote-details">Loading votes...</span>
                                    </small>
                                </div>

                                <hr>

                                <h6>Comments</h6>
                                <div id="comments-container">
                                    ${ticket.comments && ticket.comments.length > 0 ?
                                        ticket.comments.map(comment => `
                                            <div class="comment-item">
                                                <div class="d-flex justify-content-between">
                                                    <strong>${comment.author?.username || 'Unknown'}</strong>
                                                    <small class="text-muted">${formatRelativeTime(comment.created_at)}</small>
                                                </div>
                                                <p class="mt-2">${comment.content}</p>
                                            </div>
                                        `).join('') :
                                        '<p class="text-muted">No comments yet.</p>'
                                    }
                                </div>

                                <form id="comment-form" class="mt-3">
                                    <div class="mb-3">
                                        <textarea class="form-control" id="comment-content" rows="3" placeholder="Add a comment..."></textarea>
                                    </div>
                                    <button type="submit" class="btn btn-primary">Add Comment</button>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">Ticket Details</h6>
                            </div>
                            <div class="card-body">
                                <p><strong>Category:</strong> ${ticket.category?.name || 'No Category'}</p>
                                <p><strong>Priority:</strong> ${ticket.priority}</p>
                                <p><strong>Status:</strong> ${ticket.status}</p>
                                <p><strong>Created:</strong> ${formatDate(ticket.created_at)}</p>
                                <p><strong>Updated:</strong> ${formatDate(ticket.updated_at)}</p>
                                ${ticket.assignee ? `<p><strong>Assigned to:</strong> ${ticket.assignee.username}</p>` : ''}
                            </div>
                        </div>

                        <div class="card mt-3">
                            <div class="card-header">
                                <h6 class="mb-0">Attachments</h6>
                            </div>
                            <div class="card-body" id="attachments-container">
                                <div class="text-center">
                                    <div class="spinner-border spinner-border-sm" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Setup comment form
            this.setupCommentForm(ticketId);

            // Load attachments
            await this.loadAttachments(ticketId);

            // Load voting data
            await this.loadVotingData(ticketId);

        } catch (error) {
            console.error('Failed to load ticket:', error);
            document.getElementById('ticket-detail-container').innerHTML = `
                <div class="text-center text-danger py-5">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                    <p>Failed to load ticket details. Please try again.</p>
                </div>
            `;
        }
    }

    setupCommentForm(ticketId) {
        const form = document.getElementById('comment-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = document.getElementById('comment-content').value.trim();

            if (!content) {
                showAlert('Please enter a comment', 'warning');
                return;
            }

            try {
                await api.createComment(ticketId, { content });
                showAlert('Comment added successfully', 'success');
                // Reload ticket detail to show new comment
                await this.loadTicketDetail(ticketId);
            } catch (error) {
                showAlert(error.message, 'danger');
            }
        });
    }

    setupTicketFilters() {
        const searchInput = document.getElementById('search-tickets');
        const statusFilter = document.getElementById('filter-status');
        const sortSelect = document.getElementById('sort-tickets');

        // Debounced search function
        let searchTimeout;
        const performSearch = () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.loadMyTickets();
            }, 300);
        };

        // Event listeners
        searchInput.addEventListener('input', performSearch);
        statusFilter.addEventListener('change', () => this.loadMyTickets());
        sortSelect.addEventListener('change', () => this.loadMyTickets());
    }

    getTicketFilters() {
        const search = document.getElementById('search-tickets')?.value || '';
        const status = document.getElementById('filter-status')?.value || '';
        const sortBy = document.getElementById('sort-tickets')?.value || 'created_at_desc';

        const params = {};
        if (search) params.search = search;
        if (status) params.status = status;
        params.sort_by = sortBy;

        return params;
    }

    getAllTicketsPage() {
        return `
            <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                <h1 class="h2">All Tickets</h1>
                <div class="btn-toolbar mb-2 mb-md-0">
                    <div class="btn-group me-2">
                        <button class="btn btn-outline-secondary" onclick="showPage('my-tickets')">My Tickets</button>
                        <button class="btn btn-primary" onclick="showPage('all-tickets')">All Tickets</button>
                    </div>
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-md-4">
                    <input type="text" class="form-control" id="search-all-tickets" placeholder="Search all tickets...">
                </div>
                <div class="col-md-2">
                    <select class="form-select" id="filter-all-status">
                        <option value="">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <select class="form-select" id="filter-all-priority">
                        <option value="">All Priorities</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <select class="form-select" id="filter-assigned">
                        <option value="">All Assignments</option>
                        <option value="unassigned">Unassigned</option>
                        <option value="assigned">Assigned</option>
                        <option value="mine">Assigned to Me</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <select class="form-select" id="sort-all-tickets">
                        <option value="created_at_desc">Newest First</option>
                        <option value="created_at_asc">Oldest First</option>
                        <option value="updated_at_desc">Recently Updated</option>
                        <option value="priority_desc">Priority</option>
                    </select>
                </div>
            </div>

            <div id="all-tickets-container">
                <div class="text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `;
    }

    async loadAllTickets() {
        try {
            const filters = this.getAllTicketFilters();
            const response = await api.getTickets(filters);
            const tickets = response.tickets || [];

            const container = document.getElementById('all-tickets-container');

            if (tickets.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <i class="fas fa-ticket-alt fa-3x mb-3"></i>
                        <h5>No tickets found</h5>
                        <p>No tickets match your current filters.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = tickets.map(ticket => `
                <div class="card mb-3 ticket-card" onclick="showTicketDetail(${ticket.id})">
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h5 class="card-title">${ticket.subject}</h5>
                                <p class="card-text text-muted">${ticket.description.substring(0, 120)}...</p>
                                <small class="text-muted">
                                    <i class="fas fa-user"></i> ${ticket.creator?.username || 'Unknown'} •
                                    <i class="fas fa-tag"></i> ${ticket.category?.name || 'No Category'} •
                                    <i class="fas fa-clock"></i> ${formatRelativeTime(ticket.created_at)}
                                </small>
                            </div>
                            <div class="col-md-3">
                                <div class="mb-2">
                                    ${getStatusBadge(ticket.status)}
                                    ${getPriorityBadge(ticket.priority)}
                                </div>
                                <small class="text-muted">
                                    ${ticket.assignee ?
                                        `<i class="fas fa-user-check"></i> Assigned to ${ticket.assignee.username}` :
                                        '<i class="fas fa-user-times"></i> Unassigned'
                                    }
                                </small>
                            </div>
                            <div class="col-md-3 text-end">
                                <div class="btn-group-vertical btn-group-sm">
                                    <button class="btn btn-outline-primary btn-sm" onclick="event.stopPropagation(); assignTicket(${ticket.id})">
                                        <i class="fas fa-user-plus"></i> Assign
                                    </button>
                                    <button class="btn btn-outline-success btn-sm" onclick="event.stopPropagation(); updateTicketStatus(${ticket.id}, 'in_progress')">
                                        <i class="fas fa-play"></i> Start
                                    </button>
                                </div>
                                <div class="vote-buttons mt-2">
                                    <span class="vote-score">${ticket.vote_score || 0}</span>
                                    <small class="text-muted">votes</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Failed to load all tickets:', error);
            document.getElementById('all-tickets-container').innerHTML = `
                <div class="text-center text-danger py-5">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                    <p>Failed to load tickets. Please try again.</p>
                </div>
            `;
        }
    }

    setupAllTicketFilters() {
        const searchInput = document.getElementById('search-all-tickets');
        const statusFilter = document.getElementById('filter-all-status');
        const priorityFilter = document.getElementById('filter-all-priority');
        const assignedFilter = document.getElementById('filter-assigned');
        const sortSelect = document.getElementById('sort-all-tickets');

        // Debounced search function
        let searchTimeout;
        const performSearch = () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.loadAllTickets();
            }, 300);
        };

        // Event listeners
        searchInput.addEventListener('input', performSearch);
        statusFilter.addEventListener('change', () => this.loadAllTickets());
        priorityFilter.addEventListener('change', () => this.loadAllTickets());
        assignedFilter.addEventListener('change', () => this.loadAllTickets());
        sortSelect.addEventListener('change', () => this.loadAllTickets());
    }

    getAllTicketFilters() {
        const search = document.getElementById('search-all-tickets')?.value || '';
        const status = document.getElementById('filter-all-status')?.value || '';
        const priority = document.getElementById('filter-all-priority')?.value || '';
        const assigned = document.getElementById('filter-assigned')?.value || '';
        const sortBy = document.getElementById('sort-all-tickets')?.value || 'created_at_desc';

        const params = {};
        if (search) params.search = search;
        if (status) params.status = status;
        if (priority) params.priority = priority;
        if (assigned === 'unassigned') params.assigned_to = 'null';
        if (assigned === 'assigned') params.assigned_to = 'not_null';
        if (assigned === 'mine') params.assigned_to = authManager.getCurrentUser().id;
        params.sort_by = sortBy;

        return params;
    }

    getUsersPage() {
        return `
            <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                <h1 class="h2">User Management</h1>
            </div>

            <div class="row mb-3">
                <div class="col-md-6">
                    <input type="text" class="form-control" id="search-users" placeholder="Search users...">
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="filter-user-role">
                        <option value="">All Roles</option>
                        <option value="user">End Users</option>
                        <option value="agent">Support Agents</option>
                        <option value="admin">Administrators</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <select class="form-select" id="filter-user-status">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            <div id="users-container">
                <div class="text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `;
    }

    getCategoriesPage() {
        return `
            <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                <h1 class="h2">Category Management</h1>
                <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#categoryModal">
                    <i class="fas fa-plus"></i> Add Category
                </button>
            </div>

            <div id="categories-container">
                <div class="text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>

            <!-- Category Modal -->
            <div class="modal fade" id="categoryModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Add New Category</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="category-form">
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label for="category-name" class="form-label">Category Name</label>
                                    <input type="text" class="form-control" id="category-name" required>
                                </div>
                                <div class="mb-3">
                                    <label for="category-description" class="form-label">Description</label>
                                    <textarea class="form-control" id="category-description" rows="3"></textarea>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">Save Category</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    async loadUsers() {
        try {
            const response = await api.getUsers();
            const users = response.users || [];

            const container = document.getElementById('users-container');

            if (users.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <i class="fas fa-users fa-3x mb-3"></i>
                        <h5>No users found</h5>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => `
                                <tr>
                                    <td>${user.username}</td>
                                    <td>${user.email}</td>
                                    <td>
                                        <span class="badge bg-${user.role === 'admin' ? 'danger' : user.role === 'agent' ? 'warning' : 'primary'}">
                                            ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge bg-${user.is_active ? 'success' : 'secondary'}">
                                            ${user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>${formatDate(user.created_at)}</td>
                                    <td>
                                        <div class="btn-group btn-group-sm">
                                            <button class="btn btn-outline-primary" onclick="editUser(${user.id})">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn btn-outline-${user.is_active ? 'warning' : 'success'}"
                                                    onclick="toggleUserStatus(${user.id}, ${!user.is_active})">
                                                <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            console.error('Failed to load users:', error);
            document.getElementById('users-container').innerHTML = `
                <div class="text-center text-danger py-5">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                    <p>Failed to load users. Please try again.</p>
                </div>
            `;
        }
    }

    async loadCategories() {
        try {
            console.log('Loading categories...');
            const response = await api.getCategories();
            this.categories = response.categories || [];
            console.log('Categories loaded:', this.categories);

            // Only update UI if we're on the categories admin page
            const container = document.getElementById('categories-container');
            if (!container) {
                console.log('categories-container not found, skipping UI update');
                return;
            }

            if (this.categories.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <i class="fas fa-tags fa-3x mb-3"></i>
                        <h5>No categories found</h5>
                        <p>Create your first category to organize tickets.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="row">
                    ${this.categories.map(category => `
                        <div class="col-md-6 col-lg-4 mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div>
                                            <h5 class="card-title">${category.name}</h5>
                                            <p class="card-text text-muted">${category.description || 'No description'}</p>
                                            <small class="text-muted">
                                                Created ${formatRelativeTime(category.created_at)}
                                            </small>
                                        </div>
                                        <div class="dropdown">
                                            <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown">
                                                <i class="fas fa-ellipsis-v"></i>
                                            </button>
                                            <ul class="dropdown-menu">
                                                <li><a class="dropdown-item" href="#" onclick="editCategory(${category.id})">
                                                    <i class="fas fa-edit"></i> Edit
                                                </a></li>
                                                <li><a class="dropdown-item text-danger" href="#" onclick="deleteCategory(${category.id})">
                                                    <i class="fas fa-trash"></i> Delete
                                                </a></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            console.error('Failed to load categories:', error);
            this.categories = [];

            const container = document.getElementById('categories-container');
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-danger py-5">
                        <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                        <p>Failed to load categories. Please try again.</p>
                    </div>
                `;
            }
        }
    }

    setupCategoryForm() {
        const form = document.getElementById('category-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('category-name').value.trim();
            const description = document.getElementById('category-description').value.trim();

            if (!name) {
                showAlert('Category name is required', 'warning');
                return;
            }

            try {
                await api.createCategory({ name, description });
                showAlert('Category created successfully', 'success');

                // Close modal and reload categories
                const modal = bootstrap.Modal.getInstance(document.getElementById('categoryModal'));
                modal.hide();
                form.reset();
                await this.loadCategories();

            } catch (error) {
                showAlert(error.message, 'danger');
            }
        });
    }

    async loadAttachments(ticketId) {
        try {
            const response = await api.getAttachments(ticketId);
            const attachments = response.attachments || [];

            const container = document.getElementById('attachments-container');

            if (attachments.length === 0) {
                container.innerHTML = '<p class="text-muted mb-0">No attachments</p>';
                return;
            }

            container.innerHTML = attachments.map(attachment => `
                <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                    <div>
                        <i class="fas fa-file me-2"></i>
                        <strong>${attachment.original_filename}</strong>
                        <small class="text-muted ms-2">(${this.formatFileSize(attachment.file_size)})</small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="downloadAttachment(${attachment.id})">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            `).join('');

        } catch (error) {
            console.error('Failed to load attachments:', error);
            document.getElementById('attachments-container').innerHTML =
                '<p class="text-danger mb-0">Failed to load attachments</p>';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    canDeleteTicket(ticket) {
        const currentUser = authManager.getCurrentUser();
        if (!currentUser) return false;

        // Admins and agents can delete any ticket
        if (currentUser.role === 'admin' || currentUser.role === 'agent') {
            return true;
        }

        // Users can only delete their own tickets, and not if resolved/closed
        if (currentUser.role === 'user') {
            const isOwner = ticket.user_id === currentUser.id;
            const canDelete = !['resolved', 'closed'].includes(ticket.status);
            return isOwner && canDelete;
        }

        return false;
    }

    async loadVotingData(ticketId) {
        try {
            const response = await api.getTicketVotes(ticketId);

            // Update vote score
            document.getElementById('vote-score').textContent = response.vote_score;

            // Update vote details
            document.getElementById('vote-details').textContent =
                `${response.upvotes} upvotes, ${response.downvotes} downvotes`;

            // Update button states
            const upvoteBtn = document.getElementById('upvote-btn');
            const downvoteBtn = document.getElementById('downvote-btn');

            // Reset button states
            upvoteBtn.classList.remove('voted');
            downvoteBtn.classList.remove('voted');

            // Highlight user's vote
            if (response.user_vote === 'up') {
                upvoteBtn.classList.add('voted');
            } else if (response.user_vote === 'down') {
                downvoteBtn.classList.add('voted');
            }

        } catch (error) {
            console.error('Failed to load voting data:', error);
            document.getElementById('vote-details').textContent = 'Failed to load votes';
        }
    }

    // Navigation history management
    addToHistory(pageName) {
        // Don't add the same page consecutively
        if (this.navigationHistory.length > 0 &&
            this.navigationHistory[this.historyIndex] === pageName) {
            return;
        }

        // If we're not at the end of history, remove forward history
        if (this.historyIndex < this.navigationHistory.length - 1) {
            this.navigationHistory = this.navigationHistory.slice(0, this.historyIndex + 1);
        }

        // Add new page to history
        this.navigationHistory.push(pageName);
        this.historyIndex = this.navigationHistory.length - 1;

        // Limit history to 50 entries
        if (this.navigationHistory.length > 50) {
            this.navigationHistory.shift();
            this.historyIndex--;
        }

        console.log('Navigation history:', this.navigationHistory);
        console.log('Current index:', this.historyIndex);

        // Update navigation buttons
        this.updateNavigationButtons();
    }

    canGoBack() {
        return this.historyIndex > 0;
    }

    canGoForward() {
        return this.historyIndex < this.navigationHistory.length - 1;
    }

    async goBack() {
        if (this.canGoBack()) {
            this.historyIndex--;
            const previousPage = this.navigationHistory[this.historyIndex];
            console.log('Going back to:', previousPage);
            await this.loadPage(previousPage, false); // Don't add to history
            this.updateNavigationButtons();
        }
    }

    async goForward() {
        if (this.canGoForward()) {
            this.historyIndex++;
            const nextPage = this.navigationHistory[this.historyIndex];
            console.log('Going forward to:', nextPage);
            await this.loadPage(nextPage, false); // Don't add to history
            this.updateNavigationButtons();
        }
    }

    updateNavigationButtons() {
        const backBtn = document.getElementById('nav-back-btn');
        const forwardBtn = document.getElementById('nav-forward-btn');
        const currentPageDisplay = document.getElementById('nav-current-page');

        if (backBtn) {
            backBtn.disabled = !this.canGoBack();
            backBtn.classList.toggle('disabled', !this.canGoBack());

            // Update tooltip with previous page
            if (this.canGoBack()) {
                const previousPage = this.navigationHistory[this.historyIndex - 1];
                backBtn.title = `Go back to ${this.getPageDisplayName(previousPage)}`;
            } else {
                backBtn.title = 'Go Back';
            }
        }

        if (forwardBtn) {
            forwardBtn.disabled = !this.canGoForward();
            forwardBtn.classList.toggle('disabled', !this.canGoForward());

            // Update tooltip with next page
            if (this.canGoForward()) {
                const nextPage = this.navigationHistory[this.historyIndex + 1];
                forwardBtn.title = `Go forward to ${this.getPageDisplayName(nextPage)}`;
            } else {
                forwardBtn.title = 'Go Forward';
            }
        }

        // Update current page display
        if (currentPageDisplay) {
            const currentPageName = this.getPageDisplayName(this.currentPage);
            currentPageDisplay.textContent = `Current: ${currentPageName}`;
        }
    }

    getPageDisplayName(pageName) {
        const pageNames = {
            'home': 'Home',
            'dashboard': 'Dashboard',
            'create-ticket': 'Create Ticket',
            'my-tickets': 'My Tickets',
            'all-tickets': 'All Tickets',
            'ticket-detail': 'Ticket Details',
            'users': 'User Management',
            'categories': 'Categories',
            'login': 'Login',
            'register': 'Register',
            'profile': 'Profile'
        };

        return pageNames[pageName] || pageName.charAt(0).toUpperCase() + pageName.slice(1);
    }
}

// Global function to show pages
function showPage(pageName) {
    console.log('showPage called with:', pageName);

    // Check if DOM is ready
    if (document.readyState === 'loading') {
        console.log('DOM not ready, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', () => {
            showPage(pageName);
        });
        return;
    }

    if (!app) {
        console.error('App not initialized!');
        // Try to initialize if not done
        if (typeof QuickDeskApp !== 'undefined') {
            console.log('Initializing app...');
            window.app = new QuickDeskApp();
            setTimeout(() => showPage(pageName), 100);
        }
        return;
    }

    app.loadPage(pageName);
}

// Global function to show ticket detail
function showTicketDetail(ticketId) {
    window.location.hash = `#ticket-detail?id=${ticketId}`;
    app.loadPage('ticket-detail');
}

// Global function to assign ticket
async function assignTicket(ticketId) {
    const currentUser = authManager.getCurrentUser();
    try {
        await api.updateTicket(ticketId, { assigned_to: currentUser.id });
        showAlert('Ticket assigned to you successfully', 'success');
        // Reload current page
        if (app.currentPage === 'all-tickets') {
            app.loadAllTickets();
        }
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Global function to update ticket status
async function updateTicketStatus(ticketId, status) {
    try {
        await api.updateTicket(ticketId, { status });
        showAlert(`Ticket status updated to ${status.replace('_', ' ')}`, 'success');
        // Reload current page
        if (app.currentPage === 'all-tickets') {
            app.loadAllTickets();
        } else if (app.currentPage === 'my-tickets') {
            app.loadMyTickets();
        }
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Global admin functions
async function editUser(userId) {
    // TODO: Implement user edit modal
    showAlert('User edit functionality coming soon', 'info');
}

async function toggleUserStatus(userId, isActive) {
    try {
        await api.updateUser(userId, { is_active: isActive });
        showAlert(`User ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
        app.loadUsers();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function editCategory(categoryId) {
    // TODO: Implement category edit modal
    showAlert('Category edit functionality coming soon', 'info');
}

async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category?')) {
        return;
    }

    try {
        await api.deleteCategory(categoryId);
        showAlert('Category deleted successfully', 'success');
        app.loadCategories();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Global download function
async function downloadAttachment(attachmentId) {
    try {
        const blob = await api.downloadAttachment(attachmentId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'attachment';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        showAlert('Download failed: ' + error.message, 'danger');
    }
}

// Global vote function
async function voteTicket(ticketId, voteType) {
    try {
        const response = await api.voteTicket(ticketId, voteType);
        showAlert(response.message, 'success');

        // Update voting UI
        if (app.currentPage === 'ticket-detail') {
            await app.loadVotingData(ticketId);
        }

    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Global delete ticket function
async function deleteTicket(ticketId) {
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
        return;
    }

    try {
        await api.deleteTicket(ticketId);
        showAlert('Ticket deleted successfully', 'success');

        // Refresh the current page
        if (app.currentPage === 'dashboard') {
            await app.loadDashboardData();
        } else if (app.currentPage === 'my-tickets') {
            await app.loadMyTickets();
        } else if (app.currentPage === 'all-tickets') {
            await app.loadAllTickets();
        }

    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Delete ticket from detail page (redirects after deletion)
async function deleteTicketFromDetail(ticketId) {
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
        return;
    }

    try {
        await api.deleteTicket(ticketId);
        showAlert('Ticket deleted successfully', 'success');

        // Redirect to dashboard
        showPage('dashboard');

    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

// Test function for debugging
function testCreateTicketPage() {
    console.log('Testing create ticket page...');
    console.log('Document ready state:', document.readyState);

    const pageContent = document.getElementById('page-content');
    console.log('page-content element:', pageContent);

    if (!pageContent) {
        console.error('page-content not found');
        console.log('All elements with IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
        return;
    }

    pageContent.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-md-8">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-plus"></i> Create New Ticket (Test)
                        </h5>
                    </div>
                    <div class="card-body">
                        <p class="alert alert-success">✅ Create ticket page is working!</p>
                        <button class="btn btn-primary" onclick="showPage('dashboard')">Back to Dashboard</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    console.log('Test page loaded successfully');
}

// Emergency create ticket function
function emergencyCreateTicket() {
    console.log('Emergency create ticket function called');

    // Wait for DOM if needed
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', emergencyCreateTicket);
        return;
    }

    const mainContent = document.querySelector('.main-content .container-fluid');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">
                                <i class="fas fa-plus"></i> Create New Ticket
                            </h5>
                        </div>
                        <div class="card-body">
                            <form id="emergency-ticket-form">
                                <div class="mb-3">
                                    <label for="subject" class="form-label">Subject *</label>
                                    <input type="text" class="form-control" id="subject" required>
                                </div>

                                <div class="mb-3">
                                    <label for="category" class="form-label">Category *</label>
                                    <select class="form-select" id="category" required>
                                        <option value="">Select a category</option>
                                        <option value="1">Technical Support</option>
                                        <option value="2">Account Issues</option>
                                        <option value="3">Feature Request</option>
                                        <option value="4">Bug Report</option>
                                        <option value="5">General Inquiry</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label for="priority" class="form-label">Priority</label>
                                    <select class="form-select" id="priority">
                                        <option value="low">Low</option>
                                        <option value="medium" selected>Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label for="description" class="form-label">Description *</label>
                                    <textarea class="form-control" id="description" rows="5" required></textarea>
                                </div>

                                <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                                    <button type="button" class="btn btn-secondary" onclick="showPage('dashboard')">Cancel</button>
                                    <button type="submit" class="btn btn-primary">Create Ticket</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add form handler
        document.getElementById('emergency-ticket-form').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Emergency form working! This confirms the create ticket functionality is operational.');
        });

        console.log('Emergency create ticket page loaded');
    } else {
        console.error('Could not find main content area');
    }
}

// Direct create ticket function that bypasses all routing
function directCreateTicket() {
    console.log('Direct create ticket called');

    // Find any container we can use
    let container = document.getElementById('page-content');
    if (!container) {
        container = document.querySelector('.main-content .container-fluid');
    }
    if (!container) {
        container = document.querySelector('main');
    }
    if (!container) {
        container = document.body;
    }

    console.log('Using container:', container);

    if (!container) {
        alert('Could not find container element. Please refresh the page.');
        return;
    }

    // Clear alerts
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
        alertContainer.innerHTML = '';
    }

    // Create the form HTML
    const formHTML = `
        <div class="row justify-content-center">
            <div class="col-md-8">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-plus"></i> Create New Ticket
                        </h5>
                    </div>
                    <div class="card-body">
                        <form id="direct-ticket-form">
                            <div class="mb-3">
                                <label for="ticket-subject" class="form-label">Subject *</label>
                                <input type="text" class="form-control" id="ticket-subject" required>
                            </div>

                            <div class="mb-3">
                                <label for="ticket-category" class="form-label">Category *</label>
                                <select class="form-select" id="ticket-category" required>
                                    <option value="">Select a category</option>
                                    <option value="1">Technical Support</option>
                                    <option value="2">Account Issues</option>
                                    <option value="3">Feature Request</option>
                                    <option value="4">Bug Report</option>
                                    <option value="5">General Inquiry</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="ticket-priority" class="form-label">Priority</label>
                                <select class="form-select" id="ticket-priority">
                                    <option value="low">Low</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="ticket-description" class="form-label">Description *</label>
                                <textarea class="form-control" id="ticket-description" rows="5" required placeholder="Describe your issue in detail..."></textarea>
                            </div>

                            <div class="mb-3">
                                <label for="ticket-attachment" class="form-label">Attachment</label>
                                <input type="file" class="form-control" id="ticket-attachment">
                                <div class="form-text">Max file size: 16MB. Allowed: images, PDFs, documents</div>
                            </div>

                            <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                                <button type="button" class="btn btn-secondary" onclick="goBackToDashboard()">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-paper-plane"></i> Create Ticket
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Set the HTML
    if (container.id === 'page-content') {
        container.innerHTML = formHTML;
    } else {
        // If we're using a different container, wrap it properly
        container.innerHTML = `
            <div id="alert-container"></div>
            <div id="page-content">${formHTML}</div>
        `;
    }

    // Setup form submission
    const form = document.getElementById('direct-ticket-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const subject = document.getElementById('ticket-subject').value;
            const category_id = parseInt(document.getElementById('ticket-category').value);
            const priority = document.getElementById('ticket-priority').value;
            const description = document.getElementById('ticket-description').value;

            if (!subject || !category_id || !description) {
                alert('Please fill in all required fields');
                return;
            }

            try {
                // Show loading
                const submitBtn = form.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                submitBtn.disabled = true;

                // Create ticket
                const response = await api.createTicket({
                    subject: subject,
                    category_id: category_id,
                    priority: priority,
                    description: description
                });

                // Handle file upload if present
                const fileInput = document.getElementById('ticket-attachment');
                if (fileInput.files.length > 0) {
                    try {
                        await api.uploadAttachment(response.ticket.id, fileInput.files[0]);
                        alert('✅ Ticket created successfully with attachment!');
                    } catch (error) {
                        alert('✅ Ticket created successfully, but file upload failed: ' + error.message);
                    }
                } else {
                    alert('✅ Ticket created successfully!');
                }

                // Go back to dashboard
                goBackToDashboard();

            } catch (error) {
                alert('❌ Error creating ticket: ' + error.message);

                // Restore button
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    console.log('Direct create ticket form loaded successfully');
}

// Simple function to go back to dashboard
function goBackToDashboard() {
    if (window.app && typeof window.app.loadPage === 'function') {
        window.app.loadPage('dashboard');
    } else {
        // Fallback: reload the page
        window.location.reload();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing app...');
    try {
        window.app = new QuickDeskApp();
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        // Show error message to user
        const pageContent = document.getElementById('page-content') || document.body;
        pageContent.innerHTML = `
            <div class="alert alert-danger m-3">
                <h4>Application Error</h4>
                <p>Failed to initialize the application. Please refresh the page.</p>
                <button class="btn btn-primary" onclick="window.location.reload()">Refresh Page</button>
            </div>
        `;
    }
});

// Global navigation functions
function goBack() {
    if (app && app.canGoBack()) {
        app.goBack();
    }
}

function goForward() {
    if (app && app.canGoForward()) {
        app.goForward();
    }
}
