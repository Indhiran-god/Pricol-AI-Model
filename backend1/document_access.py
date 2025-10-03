import sqlite3
from backend.sections.db_init import get_db_connection

def get_user_access_documents(user_id, department_id, grade_id):
    """
    Get all document collections and files that a user has access to
    based on their user_id, department_id, and grade_id
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get accessible collections for the user
            cursor.execute("""
                SELECT DISTINCT dc.* 
                FROM document_collections dc
                LEFT JOIN document_access da ON dc.id = da.document_collection_id
                WHERE da.user_id = ? OR da.department_id = ? OR da.grade_id = ?
            """, (user_id, department_id, grade_id))
            
            collections = cursor.fetchall()
            
            accessible_collections = []
            for row in collections:
                coll_dict = dict(zip([col[0] for col in cursor.description], row))
                accessible_collections.append(coll_dict)
            
            return accessible_collections
            
    except Exception as e:
        print(f"Error getting user access documents: {str(e)}")
        return []

def get_user_accessible_files(user_id, department_id, grade_id, collection_id=None):
    """
    Get all files that a user has access to within collections
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get accessible collections first
            accessible_collections = get_user_access_documents(user_id, department_id, grade_id)
            if not accessible_collections:
                return []
            
            # Get files from accessible collections
            collection_ids = [coll['id'] for coll in accessible_collections]
            
            if collection_id and collection_id not in collection_ids:
                return []
            
            query = """
                SELECT DISTINCT da.file_name, dc.name as collection_name, dc.id as collection_id
                FROM document_access da
                JOIN document_collections dc ON da.document_collection_id = dc.id
                WHERE dc.id IN ({})
            """.format(','.join(['?'] * len(collection_ids)))
            
            params = collection_ids
            if collection_id:
                query += " AND dc.id = ?"
                params.append(collection_id)
            
            cursor.execute(query, params)
            files = cursor.fetchall()
            
            accessible_files = []
            for row in files:
                file_dict = dict(zip([col[0] for col in cursor.description], row))
                if file_dict['file_name']:  # Only include files with specific file access
                    accessible_files.append(file_dict)
            
            return accessible_files
            
    except Exception as e:
        print(f"Error getting user accessible files: {str(e)}")
        return []

def can_user_access_collection(user_id, department_id, grade_id, collection_id):
    """
    Check if a user has access to a specific collection
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 1 
                FROM document_access da
                WHERE da.document_collection_id = ?
                AND (da.user_id = ? OR da.department_id = ? OR da.grade_id = ?)
                LIMIT 1
            """, (collection_id, user_id, department_id, grade_id))
            
            return cursor.fetchone() is not None
            
    except Exception as e:
        print(f"Error checking collection access: {str(e)}")
        return False

def can_user_access_file(user_id, department_id, grade_id, collection_id, file_name):
    """
    Check if a user has access to a specific file within a collection
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 1 
                FROM document_access da
                WHERE da.document_collection_id = ? 
                AND da.file_name = ?
                AND (da.user_id = ? OR da.department_id = ? OR da.grade_id = ?)
                LIMIT 1
            """, (collection_id, file_name, user_id, department_id, grade_id))
            
            return cursor.fetchone() is not None
            
    except Exception as e:
        print(f"Error checking file access: {str(e)}")
        return False
