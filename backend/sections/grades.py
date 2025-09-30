from flask import jsonify, request
from database.db_init import get_db_connection, log_admin_action

def register_grade_routes(app):
    @app.route("/api/grades", methods=["GET"])
    def get_grades():
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM grades")
                grades = cursor.fetchall()
                return jsonify({"grades": [dict(zip([col[0] for col in cursor.description], row)) for row in grades]})
        except Exception as e:
            return jsonify({"error": f"Database error: {str(e)}"}), 500

    @app.route("/api/grades", methods=["POST"])
    def create_grade():
        data = request.get_json(force=True)
        name = data.get("name", "").strip()
        level = data.get("level")
        description = data.get("description", "")
        
        if not name or level is None:
            return jsonify({"error": "Grade name and level required"}), 400
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO grades (name, level, description) VALUES (?, ?, ?)",
                    (name, level, description)
                )
                conn.commit()
                grade_id = cursor.lastrowid
                log_admin_action(None, "create_grade", {"name": name, "level": level})
                return jsonify({"message": "Grade created successfully", "grade_id": grade_id})
        except Exception as e:
            return jsonify({"error": f"Failed to create grade: {str(e)}"}), 400

    @app.route("/api/grades/<int:grade_id>", methods=["PUT"])
    def update_grade(grade_id):
        data = request.get_json(force=True)
        name = data.get("name", "").strip()
        level = data.get("level")
        description = data.get("description", "")
        
        if not name or level is None:
            return jsonify({"error": "Grade name and level required"}), 400
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE grades SET name = ?, level = ?, description = ? WHERE id = ?",
                    (name, level, description, grade_id)
                )
                conn.commit()
                log_admin_action(None, "update_grade", {"grade_id": grade_id, "name": name})
                return jsonify({"message": "Grade updated successfully"})
        except Exception as e:
            return jsonify({"error": f"Failed to update grade: {str(e)}"}), 400

    @app.route("/api/grades/<int:grade_id>", methods=["DELETE"])
    def delete_grade(grade_id):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM users WHERE grade_id = ?", (grade_id,))
                user_count = cursor.fetchone()[0]
                if user_count > 0:
                    return jsonify({"error": "Cannot delete grade in use by users"}), 400
                cursor.execute("DELETE FROM grades WHERE id = ?", (grade_id,))
                conn.commit()
                log_admin_action(None, "delete_grade", {"grade_id": grade_id})
                return jsonify({"message": "Grade deleted successfully"})
        except Exception as e:
            return jsonify({"error": f"Failed to delete grade: {str(e)}"}), 400