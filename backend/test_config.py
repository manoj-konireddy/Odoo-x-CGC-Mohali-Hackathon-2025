import os
import tempfile

class TestConfig:
    SECRET_KEY = 'test-secret-key'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    TESTING = True
    WTF_CSRF_ENABLED = False
    
    # Create temporary upload folder for tests
    UPLOAD_FOLDER = tempfile.mkdtemp()
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    
    # Disable email for tests
    MAIL_SUPPRESS_SEND = True
    MAIL_DEFAULT_SENDER = 'test@quickdesk.com'
