# 🎫 QuickDesk - Help Desk System

A modern, full-featured help desk ticketing system built with Flask (Python) backend and vanilla HTML/CSS/JavaScript frontend.

![QuickDesk](https://img.shields.io/badge/QuickDesk-Help%20Desk%20System-blue)
![Python](https://img.shields.io/badge/Python-3.8+-green)
![Flask](https://img.shields.io/badge/Flask-2.0+-red)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.1+-purple)

## Project Structure

```
QuickDesk/
├── backend/                 # Flask REST API
│   ├── app.py              # Main Flask application
│   ├── models.py           # Database models
│   ├── config.py           # Configuration
│   └── requirements.txt    # Python dependencies
├── frontend/               # HTML/CSS/JavaScript client
│   ├── index.html          # Main HTML file
│   ├── css/style.css       # Styling
│   └── js/
│       ├── api.js          # API communication
│       ├── auth.js         # Authentication management
│       └── app.js          # Main application logic
├── .venv/                  # Virtual environment (hidden)
└── README.md               # This file
```

## Setup Instructions

### 1. Activate Virtual Environment
```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# You should see (.venv) prefix in your terminal
```

### 2. Install Dependencies
```powershell
# Make sure virtual environment is activated
pip install -r backend\requirements.txt
```

### 3. Run Backend API
```powershell
# Navigate to backend directory and run
cd backend
python app.py
```

The backend will start on `http://localhost:5000`

### 4. Start Frontend Server
```powershell
# In a new terminal, run the frontend server
python start_frontend.py
```

The frontend will start on `http://localhost:8000` and automatically open in your browser.

## Quick Start (Easy Method)

Run the batch file to start both servers automatically:
```powershell
start_servers.bat
```

This will:
- Activate the virtual environment
- Start the backend on `http://localhost:5000`
- Start the frontend on `http://localhost:8000`
- Open the frontend in your browser

## Default Credentials

- **Admin User**: `admin@quickdesk.com` / `admin123`

## Features

### ✅ **Completed Features**
- **Authentication System**: JWT-based auth with role-based access control
- **Ticket Management**: Full CRUD operations with status workflow
- **User Dashboard**: Search, filtering, sorting, and pagination
- **Comment System**: Threaded conversations with timeline view
- **File Attachments**: Upload and download functionality
- **Voting System**: Upvote/downvote tickets
- **Support Agent Interface**: Agent dashboard with ticket assignment
- **Admin Panel**: User and category management
- **Email Notifications**: Automated emails for ticket events
- **Responsive UI**: Bootstrap-based responsive design

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category (admin only)

## Testing

### Run All Tests
```powershell
python run_tests.py
```

### Run Backend Tests Only
```powershell
cd backend
python -m unittest test_app.py -v
```

### Manual Testing Checklist
- [ ] User registration and login
- [ ] Create, view, and update tickets
- [ ] Add comments to tickets
- [ ] Upload and download attachments
- [ ] Vote on tickets (upvote/downvote)
- [ ] Agent ticket assignment and status updates
- [ ] Admin user and category management
- [ ] Email notifications (check logs)

## Development Notes

- Backend uses SQLite database (stored in `backend/instance/`)
- Frontend communicates with backend via REST API
- CORS is enabled for frontend-backend communication
- Virtual environment is `.venv` (with dot prefix)
- Email notifications are logged to console in development

## Troubleshooting

### Virtual Environment Issues
If you have issues with the virtual environment:
1. Delete `.venv` folder
2. Create new: `python -m venv .venv`
3. Activate: `.\.venv\Scripts\Activate.ps1`
4. Install dependencies: `pip install -r backend\requirements.txt`

### Backend Not Starting
1. Make sure virtual environment is activated
2. Check if all dependencies are installed
3. Verify you're in the correct directory
