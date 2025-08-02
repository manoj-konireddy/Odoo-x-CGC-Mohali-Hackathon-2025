from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from flask_mail import Mail, Message
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import os
import jwt
import uuid
import mimetypes
from functools import wraps

from config import Config
from models import db, User, Category, Ticket, Comment, Attachment, Vote

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for frontend communication (allow all origins for development)
CORS(app, origins=['*'])

# Initialize extensions
db.init_app(app)
mail = Mail(app)

# Create upload directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# JWT token decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
            current_user = User.query.get(current_user_id)
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

# Authentication routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not all(k in data for k in ('username', 'email', 'password')):
            return jsonify({'message': 'Missing required fields'}), 400
        
        # Check if user already exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'message': 'Email already registered'}), 400
        
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'message': 'Username already taken'}), 400
        
        # Create new user
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=generate_password_hash(data['password']),
            role=data.get('role', 'user')
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({'message': 'User created successfully'}), 201
        
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not all(k in data for k in ('email', 'password')):
            return jsonify({'message': 'Missing email or password'}), 400
        
        user = User.query.filter_by(email=data['email']).first()
        
        if user and check_password_hash(user.password_hash, data['password']):
            # Generate JWT token
            token = jwt.encode({
                'user_id': user.id,
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm='HS256')
            
            return jsonify({
                'token': token,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': user.role
                }
            }), 200
        
        return jsonify({'message': 'Invalid credentials'}), 401
        
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify({
        'user': {
            'id': current_user.id,
            'username': current_user.username,
            'email': current_user.email,
            'role': current_user.role
        }
    }), 200

# Category routes
@app.route('/api/categories', methods=['GET'])
@token_required
def get_categories(current_user):
    categories = Category.query.filter_by(is_active=True).all()
    return jsonify({
        'categories': [{
            'id': cat.id,
            'name': cat.name,
            'description': cat.description
        } for cat in categories]
    }), 200

@app.route('/api/categories', methods=['POST'])
@token_required
def create_category(current_user):
    if current_user.role != 'admin':
        return jsonify({'message': 'Admin access required'}), 403
    
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'message': 'Category name is required'}), 400
        
        category = Category(
            name=data['name'],
            description=data.get('description', '')
        )
        
        db.session.add(category)
        db.session.commit()
        
        return jsonify({
            'message': 'Category created successfully',
            'category': {
                'id': category.id,
                'name': category.name,
                'description': category.description
            }
        }), 201
        
    except Exception as e:
        return jsonify({'message': str(e)}), 500

# Ticket routes
@app.route('/api/tickets', methods=['GET'])
@token_required
def get_tickets(current_user):
    try:
        # Get query parameters
        status = request.args.get('status')
        category_id = request.args.get('category_id', type=int)
        user_id = request.args.get('user_id', type=int)
        search = request.args.get('search')
        sort_by = request.args.get('sort_by', 'created_at_desc')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)

        # Build query
        query = Ticket.query

        # Apply filters
        if status:
            query = query.filter(Ticket.status == status)
        if category_id:
            query = query.filter(Ticket.category_id == category_id)
        if user_id:
            query = query.filter(Ticket.user_id == user_id)
        if search:
            query = query.filter(Ticket.subject.contains(search) | Ticket.description.contains(search))

        # For regular users, only show their own tickets
        if current_user.role == 'user':
            query = query.filter(Ticket.user_id == current_user.id)

        # Apply sorting
        if sort_by == 'created_at_desc':
            query = query.order_by(Ticket.created_at.desc())
        elif sort_by == 'created_at_asc':
            query = query.order_by(Ticket.created_at.asc())
        elif sort_by == 'updated_at_desc':
            query = query.order_by(Ticket.updated_at.desc())
        elif sort_by == 'priority_desc':
            priority_order = ['urgent', 'high', 'medium', 'low']
            query = query.order_by(Ticket.priority.desc())

        # Paginate
        tickets = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'tickets': [ticket.to_dict() for ticket in tickets.items],
            'total': tickets.total,
            'pages': tickets.pages,
            'current_page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/tickets', methods=['POST'])
@token_required
def create_ticket(current_user):
    try:
        data = request.get_json()

        # Validate required fields
        if not all(k in data for k in ('subject', 'description', 'category_id')):
            return jsonify({'message': 'Missing required fields'}), 400

        # Create new ticket
        ticket = Ticket(
            subject=data['subject'],
            description=data['description'],
            category_id=data['category_id'],
            priority=data.get('priority', 'medium'),
            user_id=current_user.id
        )

        db.session.add(ticket)
        db.session.commit()

        # Send email notification
        send_ticket_created_notification(ticket)

        return jsonify({
            'message': 'Ticket created successfully',
            'ticket': ticket.to_dict()
        }), 201

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>', methods=['GET'])
@token_required
def get_ticket(current_user, ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)

        # Check permissions
        if current_user.role == 'user' and ticket.user_id != current_user.id:
            return jsonify({'message': 'Access denied'}), 403

        return jsonify({
            'ticket': ticket.to_dict(include_comments=True)
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>', methods=['PUT'])
@token_required
def update_ticket(current_user, ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)

        # Check permissions
        if current_user.role == 'user' and ticket.user_id != current_user.id:
            return jsonify({'message': 'Access denied'}), 403

        data = request.get_json()
        old_status = ticket.status

        # Update allowed fields
        if 'subject' in data and (current_user.role != 'user' or ticket.user_id == current_user.id):
            ticket.subject = data['subject']
        if 'description' in data and (current_user.role != 'user' or ticket.user_id == current_user.id):
            ticket.description = data['description']
        if 'status' in data and current_user.role in ['agent', 'admin']:
            ticket.status = data['status']
        if 'priority' in data and current_user.role in ['agent', 'admin']:
            ticket.priority = data['priority']
        if 'assigned_to' in data and current_user.role in ['agent', 'admin']:
            ticket.assigned_to = data['assigned_to']

        ticket.updated_at = datetime.utcnow()
        db.session.commit()

        # Send email notification if status changed
        if old_status != ticket.status:
            send_ticket_status_notification(ticket, old_status)

        return jsonify({
            'message': 'Ticket updated successfully',
            'ticket': ticket.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>', methods=['DELETE'])
@token_required
def delete_ticket(current_user, ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)

        # Check permissions - only ticket creator, agents, or admins can delete
        if current_user.role == 'user' and ticket.user_id != current_user.id:
            return jsonify({'message': 'You can only delete your own tickets'}), 403

        # Check if ticket can be deleted (optional business rule)
        if ticket.status in ['resolved', 'closed'] and current_user.role == 'user':
            return jsonify({'message': 'Cannot delete resolved or closed tickets'}), 400

        # Delete associated comments first (cascade delete)
        Comment.query.filter_by(ticket_id=ticket_id).delete()

        # Delete associated votes
        Vote.query.filter_by(ticket_id=ticket_id).delete()

        # Delete associated attachments and files
        attachments = Attachment.query.filter_by(ticket_id=ticket_id).all()
        for attachment in attachments:
            # Delete physical file
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], attachment.filename)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError as e:
                    print(f"Error deleting file {file_path}: {e}")

            # Delete attachment record
            db.session.delete(attachment)

        # Delete the ticket
        db.session.delete(ticket)
        db.session.commit()

        return jsonify({'message': 'Ticket deleted successfully'}), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/comments', methods=['GET'])
@token_required
def get_ticket_comments(current_user, ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)

        # Check permissions
        if current_user.role == 'user' and ticket.user_id != current_user.id:
            return jsonify({'message': 'Access denied'}), 403

        comments = Comment.query.filter_by(ticket_id=ticket_id).order_by(Comment.created_at.asc()).all()

        # Filter internal comments for regular users
        if current_user.role == 'user':
            comments = [c for c in comments if not c.is_internal]

        return jsonify({
            'comments': [comment.to_dict() for comment in comments]
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/comments', methods=['POST'])
@token_required
def create_comment(current_user, ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)

        # Check permissions
        if current_user.role == 'user' and ticket.user_id != current_user.id:
            return jsonify({'message': 'Access denied'}), 403

        data = request.get_json()

        if not data.get('content'):
            return jsonify({'message': 'Comment content is required'}), 400

        comment = Comment(
            content=data['content'],
            ticket_id=ticket_id,
            user_id=current_user.id,
            is_internal=data.get('is_internal', False) and current_user.role in ['agent', 'admin']
        )

        db.session.add(comment)

        # Update ticket's updated_at timestamp
        ticket.updated_at = datetime.utcnow()
        db.session.commit()

        # Send email notification
        send_comment_notification(comment)

        return jsonify({
            'message': 'Comment added successfully',
            'comment': comment.to_dict()
        }), 201

    except Exception as e:
        return jsonify({'message': str(e)}), 500

# User management routes (admin only)
@app.route('/api/users', methods=['GET'])
@token_required
def get_users(current_user):
    if current_user.role != 'admin':
        return jsonify({'message': 'Admin access required'}), 403

    try:
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users]
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
def update_user(current_user, user_id):
    if current_user.role != 'admin':
        return jsonify({'message': 'Admin access required'}), 403

    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()

        # Update allowed fields
        if 'username' in data:
            user.username = data['username']
        if 'email' in data:
            user.email = data['email']
        if 'role' in data:
            user.role = data['role']
        if 'is_active' in data:
            user.is_active = data['is_active']

        db.session.commit()

        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/categories/<int:category_id>', methods=['PUT'])
@token_required
def update_category(current_user, category_id):
    if current_user.role != 'admin':
        return jsonify({'message': 'Admin access required'}), 403

    try:
        category = Category.query.get_or_404(category_id)
        data = request.get_json()

        if 'name' in data:
            category.name = data['name']
        if 'description' in data:
            category.description = data['description']
        if 'is_active' in data:
            category.is_active = data['is_active']

        db.session.commit()

        return jsonify({
            'message': 'Category updated successfully',
            'category': category.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
@token_required
def delete_category(current_user, category_id):
    if current_user.role != 'admin':
        return jsonify({'message': 'Admin access required'}), 403

    try:
        category = Category.query.get_or_404(category_id)

        # Check if category has tickets
        ticket_count = Ticket.query.filter_by(category_id=category_id).count()
        if ticket_count > 0:
            return jsonify({'message': f'Cannot delete category with {ticket_count} tickets'}), 400

        db.session.delete(category)
        db.session.commit()

        return jsonify({'message': 'Category deleted successfully'}), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

# File upload routes
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/tickets/<int:ticket_id>/attachments', methods=['POST'])
@token_required
def upload_attachment(current_user, ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)

        # Check permissions
        if current_user.role == 'user' and ticket.user_id != current_user.id:
            return jsonify({'message': 'Access denied'}), 403

        if 'file' not in request.files:
            return jsonify({'message': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'message': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'message': 'File type not allowed'}), 400

        # Generate unique filename
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"

        # Save file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)

        # Get file info
        file_size = os.path.getsize(file_path)
        mime_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'

        # Create attachment record
        attachment = Attachment(
            filename=unique_filename,
            original_filename=original_filename,
            file_size=file_size,
            mime_type=mime_type,
            ticket_id=ticket_id,
            user_id=current_user.id
        )

        db.session.add(attachment)
        db.session.commit()

        return jsonify({
            'message': 'File uploaded successfully',
            'attachment': attachment.to_dict()
        }), 201

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/attachments/<int:attachment_id>/download', methods=['GET'])
@token_required
def download_attachment(current_user, attachment_id):
    try:
        attachment = Attachment.query.get_or_404(attachment_id)
        ticket = attachment.ticket

        # Check permissions
        if current_user.role == 'user' and ticket.user_id != current_user.id:
            return jsonify({'message': 'Access denied'}), 403

        file_path = os.path.join(app.config['UPLOAD_FOLDER'], attachment.filename)

        if not os.path.exists(file_path):
            return jsonify({'message': 'File not found'}), 404

        return send_from_directory(
            app.config['UPLOAD_FOLDER'],
            attachment.filename,
            as_attachment=True,
            download_name=attachment.original_filename
        )

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/attachments', methods=['GET'])
@token_required
def get_attachments(current_user, ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)

        # Check permissions
        if current_user.role == 'user' and ticket.user_id != current_user.id:
            return jsonify({'message': 'Access denied'}), 403

        attachments = Attachment.query.filter_by(ticket_id=ticket_id).all()

        return jsonify({
            'attachments': [attachment.to_dict() for attachment in attachments]
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

# Voting routes
@app.route('/api/tickets/<int:ticket_id>/vote', methods=['POST'])
@token_required
def vote_ticket(current_user, ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)
        data = request.get_json()

        if 'vote_type' not in data or data['vote_type'] not in ['up', 'down']:
            return jsonify({'message': 'Invalid vote type'}), 400

        vote_type = data['vote_type']

        # Check if user already voted
        existing_vote = Vote.query.filter_by(ticket_id=ticket_id, user_id=current_user.id).first()

        if existing_vote:
            if existing_vote.vote_type == vote_type:
                # Remove vote if same type
                db.session.delete(existing_vote)
                message = f'{vote_type.capitalize()}vote removed'
            else:
                # Change vote type
                existing_vote.vote_type = vote_type
                message = f'Vote changed to {vote_type}vote'
        else:
            # Create new vote
            new_vote = Vote(
                ticket_id=ticket_id,
                user_id=current_user.id,
                vote_type=vote_type
            )
            db.session.add(new_vote)
            message = f'{vote_type.capitalize()}voted successfully'

        db.session.commit()

        # Get updated vote score
        upvotes = Vote.query.filter_by(ticket_id=ticket_id, vote_type='up').count()
        downvotes = Vote.query.filter_by(ticket_id=ticket_id, vote_type='down').count()
        vote_score = upvotes - downvotes

        # Get user's current vote
        user_vote = Vote.query.filter_by(ticket_id=ticket_id, user_id=current_user.id).first()
        user_vote_type = user_vote.vote_type if user_vote else None

        return jsonify({
            'message': message,
            'vote_score': vote_score,
            'user_vote': user_vote_type,
            'upvotes': upvotes,
            'downvotes': downvotes
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/vote', methods=['GET'])
@token_required
def get_ticket_votes(current_user, ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)

        upvotes = Vote.query.filter_by(ticket_id=ticket_id, vote_type='up').count()
        downvotes = Vote.query.filter_by(ticket_id=ticket_id, vote_type='down').count()
        vote_score = upvotes - downvotes

        # Get user's current vote
        user_vote = Vote.query.filter_by(ticket_id=ticket_id, user_id=current_user.id).first()
        user_vote_type = user_vote.vote_type if user_vote else None

        return jsonify({
            'vote_score': vote_score,
            'user_vote': user_vote_type,
            'upvotes': upvotes,
            'downvotes': downvotes
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

# Email notification functions
def send_email(to_email, subject, body):
    """Send email notification"""
    try:
        if not app.config['MAIL_USERNAME']:
            print(f"Email notification (not configured): {subject} to {to_email}")
            return

        msg = Message(
            subject=subject,
            sender=app.config['MAIL_USERNAME'],
            recipients=[to_email],
            body=body
        )
        mail.send(msg)
        print(f"Email sent: {subject} to {to_email}")
    except Exception as e:
        print(f"Failed to send email: {e}")

def send_ticket_created_notification(ticket):
    """Send notification when ticket is created"""
    subject = f"New Ticket Created: {ticket.subject}"
    body = f"""
Hello {ticket.creator.username},

Your support ticket has been created successfully.

Ticket Details:
- Subject: {ticket.subject}
- Category: {ticket.category.name}
- Priority: {ticket.priority.title()}
- Status: {ticket.status.title()}

Description:
{ticket.description}

You can track your ticket progress by logging into QuickDesk.

Best regards,
QuickDesk Support Team
    """
    send_email(ticket.creator.email, subject, body)

def send_ticket_status_notification(ticket, old_status):
    """Send notification when ticket status changes"""
    subject = f"Ticket Status Updated: {ticket.subject}"
    body = f"""
Hello {ticket.creator.username},

Your support ticket status has been updated.

Ticket: {ticket.subject}
Status: {old_status.title()} → {ticket.status.title()}

{f"Assigned to: {ticket.assignee.username}" if ticket.assignee else ""}

You can view your ticket details by logging into QuickDesk.

Best regards,
QuickDesk Support Team
    """
    send_email(ticket.creator.email, subject, body)

def send_comment_notification(comment):
    """Send notification when comment is added"""
    ticket = comment.ticket
    subject = f"New Comment on Ticket: {ticket.subject}"

    # Notify ticket creator if comment is not from them
    if comment.user_id != ticket.user_id and not comment.is_internal:
        body = f"""
Hello {ticket.creator.username},

A new comment has been added to your support ticket.

Ticket: {ticket.subject}
Comment by: {comment.author.username}

Comment:
{comment.content}

You can view the full conversation by logging into QuickDesk.

Best regards,
QuickDesk Support Team
        """
        send_email(ticket.creator.email, subject, body)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
        # Create default categories
        if not Category.query.first():
            default_categories = [
                {'name': 'Technical Support', 'description': 'Hardware and software issues'},
                {'name': 'Account Issues', 'description': 'Login and account related problems'},
                {'name': 'Feature Request', 'description': 'Suggestions for new features'},
                {'name': 'Bug Report', 'description': 'Report software bugs'},
                {'name': 'General Inquiry', 'description': 'General questions and information'}
            ]
            
            for cat_data in default_categories:
                category = Category(**cat_data)
                db.session.add(category)
            
            db.session.commit()
            print("Default categories created")
        
        # Create default admin user if it doesn't exist
        admin = User.query.filter_by(email='admin@quickdesk.com').first()
        if not admin:
            admin = User(
                username='admin',
                email='admin@quickdesk.com',
                password_hash=generate_password_hash('admin123'),
                role='admin'
            )
            db.session.add(admin)
            db.session.commit()
            print("Default admin user created: admin@quickdesk.com / admin123")
    
    app.run(debug=False, port=5000)
