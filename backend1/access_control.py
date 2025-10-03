import json
from flask import jsonify, request
from backend.sections.db_init import get_db_connection, log_admin_action

def register_access_control_routes(app):
    """
    Routes for managing document access control
    """
    
    @app.route("/api/access/assign", methods=["POST"])
    def assign_document_access():
        """Assign document access to user, department, or grade"""
        try:
            data = request.get_json(force=True)
            user_id = data.get("user_id")
            collection_id = data.get("collection_id")
            department_id = data.get("department_id")
            grade_id = data.get("grade_id")
            file_name = data.get("file_name", "")
            
            if not collection_id:
                return jsonify({"error": "Collection ID is required"}), 400
            
            # At least one of user_id, department_id, or grade_id must be provided
            if not user_id and not department_id and not grade_id:
                return jsonify({"error": "At least one of user_id, department_id, or grade_id is required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if collection exists
                cursor.execute("SELECT id FROM document_collections WHERE id = ?", (collection_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Collection not found"}), 404
                
                # Check if user exists (if provided)
                if user_id:
                    cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
                    if not cursor.fetchone():
                        return jsonify({"error": "User not found"}), 404
                
                # Check if department exists (if provided)
                if department_id:
                    cursor.execute("SELECT id FROM departments WHERE id = ?", (department_id,))
                    if not cursor.fetchone():
                        return jsonify({"error": "Department not found"}), 404
                
                # Check if grade exists (if provided)
                if grade_id:
                    cursor.execute("SELECT id FROM grades WHERE id = ?", (grade_id,))
                    if not cursor.fetchone():
                        return jsonify({"error": "Grade not found"}), 404
                
                # Insert access record
                cursor.execute("""
                    INSERT INTO document_access 
                    (document_collection_id, user_id, department_id, grade_id, file_name)
                    VALUES (?, ?, ?, ?, ?)
                """, (collection_id, user_id, department_id, grade_id, file_name))
                
                conn.commit()
                
                # Log admin action
                if user_id:
                    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                    user = cursor.fetchone()
                    if user and user['role'] == 'admin':
                        log_admin_action(
                            user_id,
                            "ASSIGN_DOCUMENT_ACCESS",
                            {
                                "collection_id": collection_id,
                                "user_id": user_id,
                                "department_id": department_id,
                                "grade_id": grade_id,
                                "file_name": file_name
                            }
                        )
                
                return jsonify({"message": "Document access assigned successfully"}), 201
                
        except Exception as e:
            return jsonify({"error": f"Failed to assign document access: {str(e)}"}), 500

    @app.route("/api/access/assignments", methods=["GET"])
    def get_document_access_assignments():
        """Get all document access assignments"""
        try:
            collection_id = request.args.get("collection_id", type=int)
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                query = """
                    SELECT 
                        da.*,
                        dc.name as collection_name,
                        u.username as user_name,
                        d.name as department_name,
                        g.name as grade_name
                    FROM document_access da
                    LEFT JOIN document_collections dc ON da.document_collection_id = dc.id
                    LEFT JOIN users u ON da.user_id = u.id
                    LEFT JOIN departments d ON da.department_id = d.id
                    LEFT JOIN grades g ON da.grade_id = g.id
                """
                
                params = []
                if collection_id:
                    query += " WHERE da.document_collection_id = ?"
                    params.append(collection_id)
                
                query += " ORDER BY dc.name, da.file_name"
                
                cursor.execute(query, params)
                assignments = [dict(row) for row in cursor.fetchall()]
                
                return jsonify({"assignments": assignments}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to fetch document access assignments: {str(e)}"}), 500

    @app.route("/api/access/assignments/<int:assignment_id>", methods=["DELETE"])
    def remove_document_access(assignment_id):
        """Remove document access assignment"""
        try:
            user_id = request.args.get("user_id", type=int)
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get assignment details before deletion for logging
                cursor.execute("""
                    SELECT da.*, dc.name as collection_name
                    FROM document_access da
                    LEFT JOIN document_collections dc ON da.document_collection_id = dc.id
                    WHERE da.id = ?
                """, (assignment_id,))
                
                assignment = cursor.fetchone()
                if not assignment:
                    return jsonify({"error": "Access assignment not found"}), 404
                
                # Delete the assignment
                cursor.execute("DELETE FROM document_access WHERE id = ?", (assignment_id,))
                conn.commit()
                
                # Log admin action
                if user_id:
                    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                    user = cursor.fetchone()
                    if user and user['role'] == 'admin':
                        log_admin_action(
                            user_id,
                            "REMOVE_DOCUMENT_ACCESS",
                            {
                                "assignment_id": assignment_id,
                                "collection_name": assignment['collection_name'],
                                "user_id": assignment['user_id'],
                                "department_id": assignment['department_id'],
                                "grade_id": assignment['grade_id'],
                                "file_name": assignment['file_name']
                            }
                        )
                
                return jsonify({"message": "Document access removed successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to remove document access: {str(e)}"}), 500

    @app.route("/api/access/user/<int:user_id>", methods=["GET"])
    def get_user_document_access(user_id):
        """Get all document collections and files that a user has access to"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get user's department and grade
                cursor.execute("""
                    SELECT department_id, grade_id, role FROM users WHERE id = ?
                """, (user_id,))
                user = cursor.fetchone()
                if not user:
                    return jsonify({"error": "User not found"}), 404
                
                department_id = user['department_id']
                grade_id = user['grade_id']
                
                # Get accessible collections
                cursor.execute("""
                    SELECT DISTINCT dc.*
                    FROM document_collections dc
                    LEFT JOIN document_access da ON dc.id = da.document_collection_id
                    WHERE da.user_id = ? OR da.department_id = ? OR da.grade_id = ?
                """, (user_id, department_id, grade_id))
                
                collections = [dict(row) for row in cursor.fetchall()]
                
                # Get accessible files for each collection
                for collection in collections:
                    cursor.execute("""
                        SELECT DISTINCT da.file_name
                        FROM document_access da
                        WHERE da.document_collection_id = ?
                        AND (da.user_id = ? OR da.department_id = ? OR da.grade_id = ?)
                        AND da.file_name IS NOT NULL
                    """, (collection['id'], user_id, department_id, grade_id))
                    
                    files = [row['file_name'] for row in cursor.fetchall()]
                    collection['accessible_files'] = files
                
                return jsonify({
                    "user_id": user_id,
                    "collections": collections
                }), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to fetch user document access: {str(e)}"}), 500
