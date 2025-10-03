import os
import sqlite3
import sys
import bcrypt
import json
from pathlib import Path

# Initialize database directory
try:
    BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    DATABASE_DIR = os.path.join(BASE_DIR, "database")
    Path(DATABASE_DIR).mkdir(parents=True, exist_ok=True)
    
    # Create subdirectories for different database types
    SQLITE_DB_DIR = os.path.join(DATABASE_DIR, "sqlite")
    CHROMA_DB_DIR = os.path.join(DATABASE_DIR, "chroma_db")
    UPLOAD_DIR = os.path.join(DATABASE_DIR, "uploads")
    
    Path(SQLITE_DB_DIR).mkdir(parents=True, exist_ok=True)
    Path(CHROMA_DB_DIR).mkdir(parents=True, exist_ok=True)
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
except OSError as e:
    raise RuntimeError(f"Failed to create database directory: {str(e)}")

def init_databases():
    users_db_path = os.path.join(SQLITE_DB_DIR, 'users.db')
    history_db_path = os.path.join(SQLITE_DB_DIR, 'history.db')

    # Initialize users database
    try:
        with sqlite3.connect(users_db_path) as conn:
            conn.execute('PRAGMA foreign_keys = ON;')  # Enable foreign key support
            cursor = conn.cursor()

            # Create tables in correct order to satisfy foreign key constraints
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS departments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS grades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    level INTEGER NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    UNIQUE(name, level)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'staff',
                    department_id INTEGER,
                    grade_id INTEGER,
                    is_active BOOLEAN DEFAULT TRUE,
                    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE SET NULL
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_collections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    chroma_db_path TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER,
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS model_collection_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    model_id INTEGER NOT NULL,
                    document_collection_id INTEGER NOT NULL,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    assigned_by INTEGER,
                    FOREIGN KEY (model_id) REFERENCES model_configurations(id) ON DELETE CASCADE,
                    FOREIGN KEY (document_collection_id) REFERENCES document_collections(id) ON DELETE CASCADE,
                    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
                    UNIQUE(model_id, document_collection_id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS model_configurations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    model_path TEXT NOT NULL,
                    embed_model_path TEXT NOT NULL,
                    chroma_db_base_path TEXT NOT NULL,
                    max_context_tokens INTEGER NOT NULL,
                    max_new_tokens INTEGER NOT NULL,
                    threads INTEGER DEFAULT 8,
                    temperature REAL DEFAULT 0.7,
                    prompt TEXT,
                    model_type TEXT DEFAULT 'gguf',
                    is_active BOOLEAN DEFAULT FALSE,
                    created_by INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_model_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    model_id INTEGER NOT NULL,
                    is_default BOOLEAN DEFAULT FALSE,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    assigned_by INTEGER,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (model_id) REFERENCES model_configurations(id) ON DELETE CASCADE,
                    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
                    UNIQUE(user_id, model_id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS department_model_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    department_id INTEGER NOT NULL,
                    model_id INTEGER NOT NULL,
                    is_default BOOLEAN DEFAULT FALSE,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    assigned_by INTEGER,
                    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
                    FOREIGN KEY (model_id) REFERENCES model_configurations(id) ON DELETE CASCADE,
                    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
                    UNIQUE(department_id, model_id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS grade_model_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    grade_id INTEGER NOT NULL,
                    model_id INTEGER NOT NULL,
                    is_default BOOLEAN DEFAULT FALSE,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    assigned_by INTEGER,
                    FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE,
                    FOREIGN KEY (model_id) REFERENCES model_configurations(id) ON DELETE CASCADE,
                    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
                    UNIQUE(grade_id, model_id)
                )
            """)

            # Create indexes for better performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_model_collection_model ON model_collection_assignments(model_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_model_collection_collection ON model_collection_assignments(document_collection_id)")
            
            conn.commit()
    except sqlite3.Error as e:
        raise RuntimeError(f"Failed to initialize users database: {str(e)}")

    # Initialize history database
    try:
        with sqlite3.connect(history_db_path) as conn:
            conn.execute('PRAGMA foreign_keys = ON;')  # Enable foreign key support
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    user_message TEXT NOT NULL,
                    ai_response TEXT NOT NULL,
                    document_collection_id INTEGER,
                    document_collection_name TEXT,
                    source_documents TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_deleted_by_user BOOLEAN DEFAULT FALSE,
                    deleted_at DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (document_collection_id) REFERENCES document_collections(id) ON DELETE SET NULL
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS admin_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_id INTEGER,
                    action_type TEXT NOT NULL,
                    action_details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            # Create indexes for better performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_history_admin ON admin_history(admin_id)")
            
            conn.commit()
    except sqlite3.Error as e:
        raise RuntimeError(f"Failed to initialize history database: {str(e)}")

def get_db_connection():
    try:
        users_db_path = os.path.join(SQLITE_DB_DIR, 'users.db')
        conn = sqlite3.connect(users_db_path)
        conn.execute('PRAGMA foreign_keys = ON;')  # Enable foreign key support
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        raise RuntimeError(f"Failed to connect to users database: {str(e)}")

def get_history_db_connection():
    try:
        history_db_path = os.path.join(SQLITE_DB_DIR, 'history.db')
        conn = sqlite3.connect(history_db_path)
        conn.execute('PRAGMA foreign_keys = ON;')  # Enable foreign key support
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        raise RuntimeError(f"Failed to connect to history database: {str(e)}")

def verify_password(password: str, password_hash: bytes) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash)
    except Exception as e:
        print(f"Password verification error: {str(e)}")
        return False

def hash_password(password: str) -> bytes:
    try:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    except Exception as e:
        raise RuntimeError(f"Password hashing error: {str(e)}")

def log_admin_action(admin_id, action_type, action_details):
    """Log admin actions to the admin_history table"""
    try:
        with get_history_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO admin_history (admin_id, action_type, action_details) VALUES (?, ?, ?)",
                (admin_id, action_type, json.dumps(action_details))
            )
            conn.commit()
    except Exception as e:
        print(f"Error logging admin action: {str(e)}")
