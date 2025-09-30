from flask import jsonify, request
from database.db_init import get_db_connection, log_admin_action

def register_department_routes(app):
    @app.route("/api/departments", methods=["GET"])
    def get_departments():
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM departments")
                departments = cursor.fetchall()
                return jsonify({"departments": [dict(zip([col[0] for col in cursor.description], row)) for row in departments]})
        except Exception as e:
            return jsonify({"error": f"Database error: {str(e)}"}), 500

    @app.route("/api/departments", methods=["POST"])
    def create_department():
        data = request.get_json(force=True)
        name = data.get("name", "").strip()
        description = data.get("description", "")
        
        if not name:
            return jsonify({"error": "Department name required"}), 400
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO departments (name, description) VALUES (?, ?)",
                    (name, description)
                )
                conn.commit()
                department_id = cursor.lastrowid
                log_admin_action(None, "create_department", {"name": name})
                return jsonify({"message": "Department created successfully", "department_id": department_id})
        except Exception as e:
            return jsonify({"error": f"Failed to create department: {str(e)}"}), 400

    @app.route("/api/departments/<int:department_id>", methods=["PUT"])
    def update_department(department_id):
        data = request.get_json(force=True)
        name = data.get("name", "").strip()
        description = data.get("description", "")
        
        if not name:
            return jsonify({"error": "Department name required"}), 400
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE departments SET name = ?, description = ? WHERE id = ?",
                    (name, description, department_id)
                )
                conn.commit()
                log_admin_action(None, "update_department", {"department_id": department_id, "name": name})
                return jsonify({"message": "Department updated successfully"})
        except Exception as e:
            return jsonify({"error": f"Failed to update department: {str(e)}"}), 400

    @app.route("/api/departments/<int:department_id>", methods=["DELETE"])
    def delete_department(department_id):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM users WHERE department_id = ?", (department_id,))
                user_count = cursor.fetchone()[0]
                if user_count > 0:
                    return jsonify({"error": "Cannot delete department in use by users"}), 400
                cursor.execute("DELETE FROM departments WHERE id = ?", (department_id,))
                conn.commit()
                log_admin_action(None, "delete_department", {"department_id": department_id})
                return jsonify({"message": "Department deleted successfully"})
        except Exception as e:
            return jsonify({"error": f"Failed to delete department: {str(e)}"}), 400