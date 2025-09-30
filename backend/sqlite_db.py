import sqlite3
import bcrypt
import json
import os
from datetime import datetime
from contextlib import contextmanager

# Database file path
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database", "hr_system.db")
HISTORY_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database", "chat_history.db")

def init_databases():
    """Initialize SQLite databases with schema"""
    # Create database directory if it doesn't exist
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    # Initialize main database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON")
    
    # Create tables
    cursor.executescript("""
    -- Departments table
    CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Grades table
    CREATE TABLE IF NOT EXISTS grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        level INTEGER UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Users table with role-based access
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'staff')) NOT NULL DEFAULT 'staff',
        department_id INTEGER,
        grade_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (grade_id) REFERENCES grades(id)
    );

    -- Document collections table
    CREATE TABLE IF NOT EXISTS document_collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        chroma_db_path TEXT NOT NULL,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Document access permissions
    CREATE TABLE IF NOT EXISTS document_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_collection_id INTEGER NOT NULL,
        department_id INTEGER,
        grade_id INTEGER,
        user_id INTEGER,
        access_type TEXT CHECK(access_type IN ('department', 'grade', 'user')) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_collection_id) REFERENCES document_collections(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (grade_id) REFERENCES grades(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Individual documents metadata
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_collection_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        file_type TEXT,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_by INTEGER,
        FOREIGN KEY (document_collection_id) REFERENCES document_collections(id),
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    -- Model configurations table
    CREATE TABLE IF NOT EXISTS model_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        model_path TEXT NOT NULL,
        embed_model_path TEXT NOT NULL,
        chroma_db_base_path TEXT NOT NULL,
        max_context_tokens INTEGER DEFAULT 4096,
        max_new_tokens INTEGER DEFAULT 128,
        temperature REAL DEFAULT 0.7,
        is_active BOOLEAN DEFAULT FALSE,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
    """)
    
    # Initialize history database
    history_conn = sqlite3.connect(HISTORY_DB_PATH)
    history_cursor = history_conn.cursor()
    
    history_cursor.executescript("""
    -- Chat history table (users can delete their own history, but admin can still see it)
    CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        document_collection_id INTEGER,
        document_collection_name TEXT,
        source_documents TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted_by_user BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP NULL
    );

    -- Admin history table (separate from user history)
    CREATE TABLE IF NOT EXISTS admin_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        action_details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Seed default data
    seed_default_data(cursor)
    
    conn.commit()
    conn.close()
    
    history_conn.commit()
    history_conn.close()

def seed_default_data(cursor):
    """Seed default data including admin user"""
    # Insert default admin user (password: admin123)
    admin_password_hash = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    cursor.execute("""
        INSERT OR IGNORE INTO users (username, password_hash, role, is_active) 
        VALUES (?, ?, ?, ?)
    """, ('admin', admin_password_hash, 'admin', True))

    cursor.execute("""
        INSERT OR IGNORE INTO model_configurations 
        (name, model_path, embed_model_path, chroma_db_base_path, is_active, created_by) 
        VALUES (?, ?, ?, ?, ?, ?)
    """, ('Default Configuration', './models/LLM-7B.gguf', './models/all-MiniLM-L6-v2', './database', True, 1))

@contextmanager
def get_db_connection():
    """Context manager for database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def get_history_db_connection():
    """Context manager for history database connection"""
    conn = sqlite3.connect(HISTORY_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def verify_password(password, password_hash):
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def hash_password(password):
    """Hash password"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Initialize databases on import
init_databases()
