from flask import jsonify, request
from sections.db_init import get_db_connection, verify_password, hash_password, log_admin_action

def register_user_routes(app):
    @app.route("/api/login", methods=["POST"])
    def login():
        data = request.get_json(force=True)
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        role = data.get("role", "staff")
        
        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT u.*, d.name as department_name, g.name as grade_name FROM users u "
                    "LEFT JOIN departments d ON u.department_id = d.id "
                    "LEFT JOIN grades g ON u.grade_id = g.id "
                    "WHERE u.username = ? AND u.is_active = TRUE",
                    (username,)
                )
                user_row = cursor.fetchone()
                
                if not user_row:
                    return jsonify({"error": "Invalid credentials"}), 401
                
                user = dict(zip([col[0] for col in cursor.description], user_row))
                
                # Check role if specified
                if role and user['role'] != role:
                    return jsonify({"error": "Invalid role for this user"}), 401
                
                if not verify_password(password, user['password_hash']):
                    return jsonify({"error": "Invalid credentials"}), 401
                
                user.pop('password_hash', None)
                return jsonify({"message": "Login successful", "user": user})
        except Exception as e:
            return jsonify({"error": f"Database error: {str(e)}"}), 500

    @app.route("/api/logout", methods=["POST"])
    def logout():
        return jsonify({"message": "Logout successful"})

    @app.route("/api/users", methods=["GET"])
    def get_users():
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT u.*, d.name as department_name, g.name as grade_name FROM users u "
                    "LEFT JOIN departments d ON u.department_id = d.id "
                    "LEFT JOIN grades g ON u.grade_id = g.id "
                    "WHERE u.is_active = TRUE"
                )
                users = cursor.fetchall()
                # Convert SQLite rows to JSON-serializable dictionaries
                users_list = []
                for row in users:
                    user_dict = {}
                    for i, col in enumerate(cursor.description):
                        col_name = col[0]
                        value = row[i]
                        # Convert bytes to string for JSON serialization
                        if isinstance(value, bytes):
                            value = value.decode('utf-8', errors='ignore')
                        user_dict[col_name] = value
                    # Remove password_hash from response for security
                    user_dict.pop('password_hash', None)
                    users_list.append(user_dict)
                return jsonify({"users": users_list})
        except Exception as e:
            return jsonify({"error": f"Database error: {str(e)}"}), 500

    @app.route("/api/users", methods=["POST"])
    def create_user():
        data = request.get_json(force=True)
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        role = data.get("role", "staff")
        department_id = data.get("department_id")
        grade_id = data.get("grade_id")
        
        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400
        if not department_id or not grade_id:
            return jsonify({"error": "Department and grade required"}), 400
        if role not in ["staff", "admin"]:
            return jsonify({"error": "Invalid role"}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if username already exists
                cursor.execute("SELECT id FROM users WHERE username = ? AND is_active = TRUE", (username,))
                if cursor.fetchone():
                    return jsonify({"error": "Username already exists"}), 400
                
                # Verify department_id and grade_id exist
                cursor.execute("SELECT id FROM departments WHERE id = ? AND is_active = TRUE", (department_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Invalid department_id"}), 400
                cursor.execute("SELECT id FROM grades WHERE id = ? AND is_active = TRUE", (grade_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Invalid grade_id"}), 400
                
                password_hash = hash_password(password)
                cursor.execute(
                    "INSERT INTO users (username, password_hash, role, department_id, grade_id, is_active) VALUES (?, ?, ?, ?, ?, TRUE)",
                    (username, password_hash, role, department_id, grade_id)
                )
                conn.commit()
                user_id = cursor.lastrowid
                log_admin_action(user_id, "create_user", {"username": username, "role": role})
                return jsonify({"message": "User created successfully", "user_id": user_id})
        except Exception as e:
            return jsonify({"error": f"Failed to create user: {str(e)}"}), 400

    @app.route("/api/users/<int:user_id>", methods=["PUT"])
    def update_user(user_id):
        data = request.get_json(force=True)
        username = data.get("username", "").strip()
        role = data.get("role")
        department_id = data.get("department_id")
        grade_id = data.get("grade_id")
        
        if not username:
            return jsonify({"error": "Username required"}), 400
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT is_active, role, department_id, grade_id FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if not user_row or not user_row['is_active']:
                    return jsonify({"error": "User not found or inactive"}), 404
                
                # Check if username already exists (excluding current user)
                cursor.execute("SELECT id FROM users WHERE username = ? AND id != ? AND is_active = TRUE", (username, user_id))
                if cursor.fetchone():
                    return jsonify({"error": "Username already exists"}), 400
                
                # Use existing values if not provided
                role = role or user_row['role']
                department_id = department_id or user_row['department_id']
                grade_id = grade_id or user_row['grade_id']
                
                # Validate department_id and grade_id if provided
                if department_id:
                    cursor.execute("SELECT id FROM departments WHERE id = ? AND is_active = TRUE", (department_id,))
                    if not cursor.fetchone():
                        return jsonify({"error": "Invalid department_id"}), 400
                if grade_id:
                    cursor.execute("SELECT id FROM grades WHERE id = ? AND is_active = TRUE", (grade_id,))
                    if not cursor.fetchone():
                        return jsonify({"error": "Invalid grade_id"}), 400
                
                cursor.execute(
                    "UPDATE users SET username = ?, role = ?, department_id = ?, grade_id = ? WHERE id = ?",
                    (username, role, department_id, grade_id, user_id)
                )
                conn.commit()
                log_admin_action(user_id, "update_user", {"username": username, "role": role})
                return jsonify({"message": "User updated successfully"})
        except Exception as e:
            return jsonify({"error": f"Failed to update user: {str(e)}"}), 400

    @app.route("/api/users/<int:user_id>/password", methods=["PUT"])
    def update_user_password(user_id):
        data = request.get_json(force=True)
        current_password = data.get("current_password", "").strip()
        new_password = data.get("new_password", "").strip()
        
        if not current_password or not new_password:
            return jsonify({"error": "Current password and new password required"}), 400
        if len(new_password) < 6:
            return jsonify({"error": "New password must be at least 6 characters"}), 400
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT is_active, password_hash FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if not user_row or not user_row['is_active']:
                    return jsonify({"error": "User not found or inactive"}), 404
                
                if not verify_password(current_password, user_row['password_hash']):
                    return jsonify({"error": "Current password is incorrect"}), 401
                
                new_password_hash = hash_password(new_password)
                cursor.execute(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    (new_password_hash, user_id)
                )
                conn.commit()
                log_admin_action(user_id, "update_user_password", {"user_id": user_id})
                return jsonify({"message": "Password updated successfully"})
        except Exception as e:
            return jsonify({"error": f"Failed to update password: {str(e)}"}), 400

    @app.route("/api/users/<int:user_id>", methods=["DELETE"])
    def delete_user(user_id):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT is_active FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if not user_row or not user_row['is_active']:
                    return jsonify({"error": "User not found or already inactive"}), 404
                cursor.execute("UPDATE users SET is_active = FALSE WHERE id = ?", (user_id,))
                conn.commit()
                log_admin_action(user_id, "delete_user", {"user_id": user_id})
                return jsonify({"message": "User deleted successfully"})
        except Exception as e:
            return jsonify({"error": f"Failed to delete user: {str(e)}"}), 400
