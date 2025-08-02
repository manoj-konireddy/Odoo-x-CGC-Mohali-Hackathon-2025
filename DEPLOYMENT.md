# QuickDesk Deployment Guide

## 🚀 Production Deployment

### Prerequisites
- Python 3.8+
- PostgreSQL or MySQL (for production)
- Web server (Nginx/Apache)
- SSL certificate (recommended)

### 1. Server Setup

#### Install Dependencies
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip python3-venv nginx postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install python3 python3-pip nginx postgresql postgresql-server
```

#### Create Application User
```bash
sudo useradd -m -s /bin/bash quickdesk
sudo su - quickdesk
```

### 2. Application Deployment

#### Clone and Setup
```bash
# Clone your repository
git clone <your-repo-url> quickdesk
cd quickdesk

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
pip install gunicorn psycopg2-binary
```

#### Environment Configuration
```bash
# Create production environment file
cat > backend/.env << EOF
SECRET_KEY=your-super-secret-production-key-here
DATABASE_URL=postgresql://quickdesk_user:password@localhost/quickdesk_db
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
EOF
```

### 3. Database Setup

#### PostgreSQL Setup
```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE quickdesk_db;
CREATE USER quickdesk_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE quickdesk_db TO quickdesk_user;
\q
```

#### Initialize Database
```bash
cd backend
python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

### 4. Web Server Configuration

#### Gunicorn Service
```bash
sudo nano /etc/systemd/system/quickdesk.service
```

```ini
[Unit]
Description=QuickDesk Help Desk Application
After=network.target

[Service]
User=quickdesk
Group=quickdesk
WorkingDirectory=/home/quickdesk/quickdesk/backend
Environment=PATH=/home/quickdesk/quickdesk/venv/bin
ExecStart=/home/quickdesk/quickdesk/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

#### Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl start quickdesk
sudo systemctl enable quickdesk
```

#### Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/quickdesk
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend files
    location / {
        root /home/quickdesk/quickdesk/frontend;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        root /home/quickdesk/quickdesk/backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/quickdesk /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. SSL Setup (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 6. Monitoring and Maintenance

#### Log Files
- Application logs: `journalctl -u quickdesk -f`
- Nginx logs: `/var/log/nginx/access.log` and `/var/log/nginx/error.log`

#### Backup Script
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump quickdesk_db > /backup/quickdesk_$DATE.sql
tar -czf /backup/quickdesk_files_$DATE.tar.gz /home/quickdesk/quickdesk
```

#### Update Process
```bash
# Pull latest changes
git pull origin main

# Update dependencies
source venv/bin/activate
pip install -r backend/requirements.txt

# Restart service
sudo systemctl restart quickdesk
```

## 🐳 Docker Deployment (Alternative)

### Dockerfile (Backend)
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .
EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  db:
    image: postgres:13
    environment:
      POSTGRES_DB: quickdesk_db
      POSTGRES_USER: quickdesk_user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://quickdesk_user:password@db/quickdesk_db
    depends_on:
      - db

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./frontend:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend

volumes:
  postgres_data:
```

## 🔧 Performance Optimization

### Database Optimization
- Add indexes on frequently queried columns
- Use connection pooling
- Regular VACUUM and ANALYZE

### Caching
- Implement Redis for session storage
- Cache frequently accessed data
- Use CDN for static files

### Security
- Use HTTPS everywhere
- Implement rate limiting
- Regular security updates
- Database connection encryption
