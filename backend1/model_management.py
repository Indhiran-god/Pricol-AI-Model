import os
import sys
import json
from flask import jsonify, request
from sections.db_init import get_db_connection, log_admin_action

def register_model_management_routes(app):
    @app.route("/api/models/create", methods=["POST"])
    def create_model_configuration():
        """Create a new model configuration"""
        try:
            data = request.get_json(force=True)
            user_id = data.get("user_id")
            name = data.get("name", "").strip()
            model_path = data.get("model_path", "").strip()
            embed_model_path = data.get("embed_model_path", "").strip()
            chroma_db_base_path = data.get("chroma_db_base_path", "").strip()
            max_context_tokens = data.get("max_context_tokens", 4096)
            max_new_tokens = data.get("max_new_tokens", 256)
            threads = data.get("threads", 8)
            temperature = data.get("temperature", 0.7)
            prompt = data.get("prompt", "")
            model_type = data.get("model_type", "gguf")
            
            # Validate required fields
            if not name:
                return jsonify({"error": "Model name is required"}), 400
            if not model_path:
                return jsonify({"error": "Model path is required"}), 400
            if not embed_model_path:
                return jsonify({"error": "Embedding model path is required"}), 400
            if not chroma_db_base_path:
                return jsonify({"error": "Chroma DB base path is required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if model name already exists
                cursor.execute("SELECT id FROM model_configurations WHERE name = ?", (name,))
                if cursor.fetchone():
                    return jsonify({"error": "Model name already exists"}), 400
                
                # Insert new model configuration
                cursor.execute("""
                    INSERT INTO model_configurations (
                        name, model_path, embed_model_path, chroma_db_base_path,
                        max_context_tokens, max_new_tokens, threads, temperature,
                        prompt, model_type, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    name, model_path, embed_model_path, chroma_db_base_path,
                    max_context_tokens, max_new_tokens, threads, temperature,
                    prompt, model_type, user_id
                ))
                
                model_id = cursor.lastrowid
                conn.commit()
                
                # Log admin action if user is admin
                if user_id:
                    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                    user = cursor.fetchone()
                    if user and user['role'] == 'admin':
                        log_admin_action(
                            user_id, 
                            "CREATE_MODEL", 
                            {"model_id": model_id, "model_name": name}
                        )
                
                return jsonify({
                    "message": "Model configuration created successfully",
                    "model_id": model_id,
                    "model_name": name
                }), 201
                
        except Exception as e:
            return jsonify({"error": f"Failed to create model configuration: {str(e)}"}), 500

    @app.route("/api/models", methods=["GET"])
    def get_all_models():
        """Get all model configurations"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT mc.*, u.username as created_by_username
                    FROM model_configurations mc
                    LEFT JOIN users u ON mc.created_by = u.id
                    ORDER BY mc.created_at DESC
                """)
                models = [dict(row) for row in cursor.fetchall()]
                
                return jsonify({"models": models}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to fetch models: {str(e)}"}), 500

    @app.route("/api/models/<int:model_id>", methods=["GET"])
    def get_model(model_id):
        """Get specific model configuration"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT mc.*, u.username as created_by_username
                    FROM model_configurations mc
                    LEFT JOIN users u ON mc.created_by = u.id
                    WHERE mc.id = ?
                """, (model_id,))
                
                model = cursor.fetchone()
                if not model:
                    return jsonify({"error": "Model not found"}), 404
                    
                return jsonify({"model": dict(model)}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to fetch model: {str(e)}"}), 500

    @app.route("/api/models/<int:model_id>", methods=["PUT"])
    def update_model(model_id):
        """Update model configuration"""
        try:
            data = request.get_json(force=True)
            user_id = data.get("user_id")
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if model exists
                cursor.execute("SELECT id FROM model_configurations WHERE id = ?", (model_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Model not found"}), 404
                
                # Build update query dynamically
                update_fields = []
                update_values = []
                
                fields = [
                    "name", "model_path", "embed_model_path", "chroma_db_base_path",
                    "max_context_tokens", "max_new_tokens", "threads", "temperature",
                    "prompt", "model_type"
                ]
                
                for field in fields:
                    if field in data:
                        update_fields.append(f"{field} = ?")
                        update_values.append(data[field])
                
                if not update_fields:
                    return jsonify({"error": "No fields to update"}), 400
                
                update_values.append(model_id)
                update_query = f"UPDATE model_configurations SET {', '.join(update_fields)} WHERE id = ?"
                
                cursor.execute(update_query, update_values)
                conn.commit()
                
                # Log admin action
                if user_id:
                    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                    user = cursor.fetchone()
                    if user and user['role'] == 'admin':
                        log_admin_action(
                            user_id, 
                            "UPDATE_MODEL", 
                            {"model_id": model_id}
                        )
                
                return jsonify({"message": "Model configuration updated successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to update model: {str(e)}"}), 500

    @app.route("/api/models/<int:model_id>", methods=["DELETE"])
    def delete_model(model_id):
        """Delete model configuration"""
        try:
            user_id = request.args.get("user_id", type=int)
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if model exists
                cursor.execute("SELECT name FROM model_configurations WHERE id = ?", (model_id,))
                model = cursor.fetchone()
                if not model:
                    return jsonify({"error": "Model not found"}), 404
                
                # Delete model configuration (cascade will handle assignments)
                cursor.execute("DELETE FROM model_configurations WHERE id = ?", (model_id,))
                conn.commit()
                
                # Log admin action
                if user_id:
                    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                    user = cursor.fetchone()
                    if user and user['role'] == 'admin':
                        log_admin_action(
                            user_id, 
                            "DELETE_MODEL", 
                            {"model_id": model_id, "model_name": model['name']}
                        )
                
                return jsonify({"message": "Model configuration deleted successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to delete model: {str(e)}"}), 500

    @app.route("/api/models/assign/user", methods=["POST"])
    def assign_model_to_user():
        """Assign model to user"""
        try:
            data = request.get_json(force=True)
            user_id = data.get("user_id")
            model_id = data.get("model_id")
            assigned_by = data.get("assigned_by")
            is_default = data.get("is_default", False)
            
            if not user_id or not model_id:
                return jsonify({"error": "User ID and Model ID are required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if user exists
                cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "User not found"}), 404
                
                # Check if model exists
                cursor.execute("SELECT id FROM model_configurations WHERE id = ?", (model_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Model not found"}), 404
                
                # If setting as default, remove default from other assignments for this user
                if is_default:
                    cursor.execute("""
                        UPDATE user_model_assignments 
                        SET is_default = FALSE 
                        WHERE user_id = ?
                    """, (user_id,))
                
                # Insert or update assignment
                cursor.execute("""
                    INSERT OR REPLACE INTO user_model_assignments 
                    (user_id, model_id, is_default, assigned_by) 
                    VALUES (?, ?, ?, ?)
                """, (user_id, model_id, is_default, assigned_by))
                
                conn.commit()
                
                return jsonify({"message": "Model assigned to user successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to assign model to user: {str(e)}"}), 500

    @app.route("/api/models/assign/department", methods=["POST"])
    def assign_model_to_department():
        """Assign model to department"""
        try:
            data = request.get_json(force=True)
            department_id = data.get("department_id")
            model_id = data.get("model_id")
            assigned_by = data.get("assigned_by")
            is_default = data.get("is_default", False)
            
            if not department_id or not model_id:
                return jsonify({"error": "Department ID and Model ID are required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if department exists
                cursor.execute("SELECT id FROM departments WHERE id = ?", (department_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Department not found"}), 404
                
                # Check if model exists
                cursor.execute("SELECT id FROM model_configurations WHERE id = ?", (model_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Model not found"}), 404
                
                # If setting as default, remove default from other assignments for this department
                if is_default:
                    cursor.execute("""
                        UPDATE department_model_assignments 
                        SET is_default = FALSE 
                        WHERE department_id = ?
                    """, (department_id,))
                
                # Insert or update assignment
                cursor.execute("""
                    INSERT OR REPLACE INTO department_model_assignments 
                    (department_id, model_id, is_default, assigned_by) 
                    VALUES (?, ?, ?, ?)
                """, (department_id, model_id, is_default, assigned_by))
                
                conn.commit()
                
                return jsonify({"message": "Model assigned to department successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to assign model to department: {str(e)}"}), 500

    @app.route("/api/models/assign/grade", methods=["POST"])
    def assign_model_to_grade():
        """Assign model to grade"""
        try:
            data = request.get_json(force=True)
            grade_id = data.get("grade_id")
            model_id = data.get("model_id")
            assigned_by = data.get("assigned_by")
            is_default = data.get("is_default", False)
            
            if not grade_id or not model_id:
                return jsonify({"error": "Grade ID and Model ID are required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if grade exists
                cursor.execute("SELECT id FROM grades WHERE id = ?", (grade_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Grade not found"}), 404
                
                # Check if model exists
                cursor.execute("SELECT id FROM model_configurations WHERE id = ?", (model_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Model not found"}), 404
                
                # If setting as default, remove default from other assignments for this grade
                if is_default:
                    cursor.execute("""
                        UPDATE grade_model_assignments 
                        SET is_default = FALSE 
                        WHERE grade_id = ?
                    """, (grade_id,))
                
                # Insert or update assignment
                cursor.execute("""
                    INSERT OR REPLACE INTO grade_model_assignments 
                    (grade_id, model_id, is_default, assigned_by) 
                    VALUES (?, ?, ?, ?)
                """, (grade_id, model_id, is_default, assigned_by))
                
                conn.commit()
                
                return jsonify({"message": "Model assigned to grade successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to assign model to grade: {str(e)}"}), 500

    @app.route("/api/models/user/<int:user_id>", methods=["GET"])
    def get_user_models(user_id):
        """Get all models assigned to a user"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get user's department and grade
                cursor.execute("""
                    SELECT department_id, grade_id FROM users WHERE id = ?
                """, (user_id,))
                user = cursor.fetchone()
                if not user:
                    return jsonify({"error": "User not found"}), 404
                
                department_id = user['department_id']
                grade_id = user['grade_id']
                
                # Get models assigned directly to user
                cursor.execute("""
                    SELECT mc.*, uma.is_default
                    FROM model_configurations mc
                    JOIN user_model_assignments uma ON mc.id = uma.model_id
                    WHERE uma.user_id = ?
                    ORDER BY uma.is_default DESC, mc.name ASC
                """, (user_id,))
                user_models = [dict(row) for row in cursor.fetchall()]
                
                # Get models assigned to user's department
                department_models = []
                if department_id:
                    cursor.execute("""
                        SELECT mc.*, dma.is_default
                        FROM model_configurations mc
                        JOIN department_model_assignments dma ON mc.id = dma.model_id
                        WHERE dma.department_id = ?
                        ORDER BY dma.is_default DESC, mc.name ASC
                    """, (department_id,))
                    department_models = [dict(row) for row in cursor.fetchall()]
                
                # Get models assigned to user's grade
                grade_models = []
                if grade_id:
                    cursor.execute("""
                        SELECT mc.*, gma.is_default
                        FROM model_configurations mc
                        JOIN grade_model_assignments gma ON mc.id = gma.model_id
                        WHERE gma.grade_id = ?
                        ORDER BY gma.is_default DESC, mc.name ASC
                    """, (grade_id,))
                    grade_models = [dict(row) for row in cursor.fetchall()]
                
                # Combine all models, removing duplicates
                all_models = {}
                for model in user_models + department_models + grade_models:
                    model_id = model['id']
                    if model_id not in all_models:
                        all_models[model_id] = model
                    elif model.get('is_default') and not all_models[model_id].get('is_default'):
                        all_models[model_id] = model
                
                models_list = list(all_models.values())
                
                return jsonify({
                    "models": models_list,
                    "user_models": user_models,
                    "department_models": department_models,
                    "grade_models": grade_models
                }), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to fetch user models: {str(e)}"}), 500

    @app.route("/api/models/assignments/<int:model_id>", methods=["GET"])
    def get_model_assignments(model_id):
        """Get all assignments for a specific model"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if model exists
                cursor.execute("SELECT name FROM model_configurations WHERE id = ?", (model_id,))
                model = cursor.fetchone()
                if not model:
                    return jsonify({"error": "Model not found"}), 404
                
                # Get user assignments
                cursor.execute("""
                    SELECT u.id, u.username, u.role, uma.is_default, uma.assigned_at
                    FROM user_model_assignments uma
                    JOIN users u ON uma.user_id = u.id
                    WHERE uma.model_id = ?
                    ORDER BY uma.is_default DESC, u.username ASC
                """, (model_id,))
                user_assignments = [dict(row) for row in cursor.fetchall()]
                
                # Get department assignments
                cursor.execute("""
                    SELECT d.id, d.name, dma.is_default, dma.assigned_at
                    FROM department_model_assignments dma
                    JOIN departments d ON dma.department_id = d.id
                    WHERE dma.model_id = ?
                    ORDER BY dma.is_default DESC, d.name ASC
                """, (model_id,))
                department_assignments = [dict(row) for row in cursor.fetchall()]
                
                # Get grade assignments
                cursor.execute("""
                    SELECT g.id, g.name, g.level, gma.is_default, gma.assigned_at
                    FROM grade_model_assignments gma
                    JOIN grades g ON gma.grade_id = g.id
                    WHERE gma.model_id = ?
                    ORDER BY gma.is_default DESC, g.level ASC
                """, (model_id,))
                grade_assignments = [dict(row) for row in cursor.fetchall()]
                
                return jsonify({
                    "model_name": model['name'],
                    "user_assignments": user_assignments,
                    "department_assignments": department_assignments,
                    "grade_assignments": grade_assignments
                }), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to fetch model assignments: {str(e)}"}), 500

    @app.route("/api/models/unassign/user", methods=["DELETE"])
    def unassign_model_from_user():
        """Remove model assignment from user"""
        try:
            data = request.get_json(force=True)
            user_id = data.get("user_id")
            model_id = data.get("model_id")
            
            if not user_id or not model_id:
                return jsonify({"error": "User ID and Model ID are required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    DELETE FROM user_model_assignments 
                    WHERE user_id = ? AND model_id = ?
                """, (user_id, model_id))
                
                conn.commit()
                
                return jsonify({"message": "Model assignment removed from user successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to remove model assignment: {str(e)}"}), 500

    @app.route("/api/models/assign/collection", methods=["POST"])
    def assign_collection_to_model():
        """Assign document collection to model"""
        try:
            data = request.get_json(force=True)
            model_id = data.get("model_id")
            collection_id = data.get("collection_id")
            assigned_by = data.get("assigned_by")
            
            if not model_id or not collection_id:
                return jsonify({"error": "Model ID and Collection ID are required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if model exists
                cursor.execute("SELECT id FROM model_configurations WHERE id = ?", (model_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Model not found"}), 404
                
                # Check if collection exists
                cursor.execute("SELECT id FROM document_collections WHERE id = ?", (collection_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Collection not found"}), 404
                
                # Insert or update assignment
                cursor.execute("""
                    INSERT OR REPLACE INTO model_collection_assignments 
                    (model_id, document_collection_id, assigned_by) 
                    VALUES (?, ?, ?)
                """, (model_id, collection_id, assigned_by))
                
                conn.commit()
                
                return jsonify({"message": "Collection assigned to model successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to assign collection to model: {str(e)}"}), 500

    @app.route("/api/models/unassign/collection", methods=["DELETE"])
    def unassign_collection_from_model():
        """Remove collection assignment from model"""
        try:
            data = request.get_json(force=True)
            model_id = data.get("model_id")
            collection_id = data.get("collection_id")
            
            if not model_id or not collection_id:
                return jsonify({"error": "Model ID and Collection ID are required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    DELETE FROM model_collection_assignments 
                    WHERE model_id = ? AND document_collection_id = ?
                """, (model_id, collection_id))
                
                conn.commit()
                
                return jsonify({"message": "Collection assignment removed from model successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to remove collection assignment: {str(e)}"}), 500

    @app.route("/api/models/<int:model_id>/collections", methods=["GET"])
    def get_model_collections(model_id):
        """Get all collections assigned to a model"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if model exists
                cursor.execute("SELECT name FROM model_configurations WHERE id = ?", (model_id,))
                model = cursor.fetchone()
                if not model:
                    return jsonify({"error": "Model not found"}), 404
                
                # Get collections assigned to model
                cursor.execute("""
                    SELECT dc.*, mca.assigned_at
                    FROM document_collections dc
                    JOIN model_collection_assignments mca ON dc.id = mca.document_collection_id
                    WHERE mca.model_id = ?
                    ORDER BY dc.name ASC
                """, (model_id,))
                
                collections = [dict(row) for row in cursor.fetchall()]
                
                return jsonify({
                    "model_id": model_id,
                    "model_name": model['name'],
                    "collections": collections
                }), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to fetch model collections: {str(e)}"}), 500

    @app.route("/api/collections/<int:collection_id>/models", methods=["GET"])
    def get_collection_models(collection_id):
        """Get all models that have access to a collection"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if collection exists
                cursor.execute("SELECT name FROM document_collections WHERE id = ?", (collection_id,))
                collection = cursor.fetchone()
                if not collection:
                    return jsonify({"error": "Collection not found"}), 404
                
                # Get models assigned to collection
                cursor.execute("""
                    SELECT mc.*, mca.assigned_at
                    FROM model_configurations mc
                    JOIN model_collection_assignments mca ON mc.id = mca.model_id
                    WHERE mca.document_collection_id = ?
                    ORDER BY mc.name ASC
                """, (collection_id,))
                
                models = [dict(row) for row in cursor.fetchall()]
                
                return jsonify({
                    "collection_id": collection_id,
                    "collection_name": collection['name'],
                    "models": models
                }), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to fetch collection models: {str(e)}"}), 500

    @app.route("/api/user/<int:user_id>/accessible-collections", methods=["GET"])
    def get_user_accessible_collections(user_id):
        """Get all collections accessible to a user through their assigned models"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get user's department and grade
                cursor.execute("""
                    SELECT department_id, grade_id FROM users WHERE id = ?
                """, (user_id,))
                user = cursor.fetchone()
                if not user:
                    return jsonify({"error": "User not found"}), 404
                
                department_id = user['department_id']
                grade_id = user['grade_id']
                
                # Get all models assigned to user (directly, via department, or via grade)
                cursor.execute("""
                    SELECT DISTINCT mc.id
                    FROM model_configurations mc
                    LEFT JOIN user_model_assignments uma ON mc.id = uma.model_id
                    LEFT JOIN department_model_assignments dma ON mc.id = dma.model_id
                    LEFT JOIN grade_model_assignments gma ON mc.id = gma.model_id
                    WHERE uma.user_id = ? OR dma.department_id = ? OR gma.grade_id = ?
                """, (user_id, department_id, grade_id))
                
                model_ids = [row['id'] for row in cursor.fetchall()]
                
                if not model_ids:
                    return jsonify({"collections": []}), 200
                
                # Get collections assigned to these models
                placeholders = ','.join(['?'] * len(model_ids))
                cursor.execute(f"""
                    SELECT DISTINCT dc.*
                    FROM document_collections dc
                    JOIN model_collection_assignments mca ON dc.id = mca.document_collection_id
                    WHERE mca.model_id IN ({placeholders})
                    ORDER BY dc.name ASC
                """, model_ids)
                
                collections = [dict(row) for row in cursor.fetchall()]
                
                return jsonify({
                    "user_id": user_id,
                    "collections": collections
                }), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to fetch user accessible collections: {str(e)}"}), 500

    @app.route("/api/models/unassign/department", methods=["DELETE"])
    def unassign_model_from_department():
        """Remove model assignment from department"""
        try:
            data = request.get_json(force=True)
            department_id = data.get("department_id")
            model_id = data.get("model_id")
            
            if not department_id or not model_id:
                return jsonify({"error": "Department ID and Model ID are required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    DELETE FROM department_model_assignments 
                    WHERE department_id = ? AND model_id = ?
                """, (department_id, model_id))
                
                conn.commit()
                
                return jsonify({"message": "Model assignment removed from department successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to remove model assignment: {str(e)}"}), 500

    @app.route("/api/models/unassign/grade", methods=["DELETE"])
    def unassign_model_from_grade():
        """Remove model assignment from grade"""
        try:
            data = request.get_json(force=True)
            grade_id = data.get("grade_id")
            model_id = data.get("model_id")
            
            if not grade_id or not model_id:
                return jsonify({"error": "Grade ID and Model ID are required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    DELETE FROM grade_model_assignments 
                    WHERE grade_id = ? AND model_id = ?
                """, (grade_id, model_id))
                
                conn.commit()
                
                return jsonify({"message": "Model assignment removed from grade successfully"}), 200
                
        except Exception as e:
            return jsonify({"error": f"Failed to remove model assignment: {str(e)}"}), 500
