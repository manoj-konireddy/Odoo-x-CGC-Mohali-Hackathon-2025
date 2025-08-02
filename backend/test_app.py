import unittest
import json
import tempfile
import os
from app import app
from models import db, User, Category, Ticket
from test_config import TestConfig
from werkzeug.security import generate_password_hash

class QuickDeskTestCase(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        app.config.from_object(TestConfig)
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        
        # Create all tables
        db.create_all()
        
        # Create test data
        self.create_test_data()
    
    def tearDown(self):
        """Tear down test fixtures after each test method."""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def create_test_data(self):
        """Create test users and categories."""
        # Create test users
        self.admin_user = User(
            username='admin',
            email='admin@test.com',
            password_hash=generate_password_hash('admin123'),
            role='admin'
        )
        
        self.agent_user = User(
            username='agent',
            email='agent@test.com',
            password_hash=generate_password_hash('agent123'),
            role='agent'
        )
        
        self.regular_user = User(
            username='user',
            email='user@test.com',
            password_hash=generate_password_hash('user123'),
            role='user'
        )
        
        # Create test category
        self.test_category = Category(
            name='Test Category',
            description='Test category for testing'
        )
        
        db.session.add_all([self.admin_user, self.agent_user, self.regular_user, self.test_category])
        db.session.commit()
    
    def get_auth_token(self, email, password):
        """Get authentication token for user."""
        response = self.app.post('/api/auth/login',
                               data=json.dumps({'email': email, 'password': password}),
                               content_type='application/json')
        data = json.loads(response.data)
        return data.get('token')
    
    def test_user_registration(self):
        """Test user registration."""
        response = self.app.post('/api/auth/register',
                               data=json.dumps({
                                   'username': 'newuser',
                                   'email': 'newuser@test.com',
                                   'password': 'password123'
                               }),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'User created successfully')
    
    def test_user_login(self):
        """Test user login."""
        response = self.app.post('/api/auth/login',
                               data=json.dumps({
                                   'email': 'user@test.com',
                                   'password': 'user123'
                               }),
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('token', data)
        self.assertIn('user', data)
    
    def test_create_ticket(self):
        """Test ticket creation."""
        token = self.get_auth_token('user@test.com', 'user123')
        
        response = self.app.post('/api/tickets',
                               data=json.dumps({
                                   'subject': 'Test Ticket',
                                   'description': 'This is a test ticket',
                                   'category_id': self.test_category.id,
                                   'priority': 'medium'
                               }),
                               content_type='application/json',
                               headers={'Authorization': f'Bearer {token}'})
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Ticket created successfully')
        self.assertIn('ticket', data)
    
    def test_get_tickets(self):
        """Test getting tickets."""
        token = self.get_auth_token('user@test.com', 'user123')
        
        # First create a ticket
        self.app.post('/api/tickets',
                     data=json.dumps({
                         'subject': 'Test Ticket',
                         'description': 'This is a test ticket',
                         'category_id': self.test_category.id,
                         'priority': 'medium'
                     }),
                     content_type='application/json',
                     headers={'Authorization': f'Bearer {token}'})
        
        # Then get tickets
        response = self.app.get('/api/tickets',
                              headers={'Authorization': f'Bearer {token}'})
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('tickets', data)
        self.assertEqual(len(data['tickets']), 1)
    
    def test_admin_access(self):
        """Test admin-only endpoints."""
        admin_token = self.get_auth_token('admin@test.com', 'admin123')
        user_token = self.get_auth_token('user@test.com', 'user123')
        
        # Test admin can access users endpoint
        response = self.app.get('/api/users',
                              headers={'Authorization': f'Bearer {admin_token}'})
        self.assertEqual(response.status_code, 200)
        
        # Test regular user cannot access users endpoint
        response = self.app.get('/api/users',
                              headers={'Authorization': f'Bearer {user_token}'})
        self.assertEqual(response.status_code, 403)
    
    def test_categories(self):
        """Test category management."""
        admin_token = self.get_auth_token('admin@test.com', 'admin123')
        
        # Test get categories
        response = self.app.get('/api/categories',
                              headers={'Authorization': f'Bearer {admin_token}'})
        self.assertEqual(response.status_code, 200)
        
        # Test create category
        response = self.app.post('/api/categories',
                               data=json.dumps({
                                   'name': 'New Category',
                                   'description': 'A new test category'
                               }),
                               content_type='application/json',
                               headers={'Authorization': f'Bearer {admin_token}'})
        self.assertEqual(response.status_code, 201)

if __name__ == '__main__':
    unittest.main()
