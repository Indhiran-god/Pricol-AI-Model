from flask import jsonify, request
from datetime import datetime
import json
from database.db_init import get_history_db_connection, log_admin_action

def register_history_routes(app):
    @app.route("/api/history", methods=["GET"])
    def get_history():
        user_id = request.args.get("user_id", type=int)
        is_admin = request.args.get("is_admin", "false").lower() == "true"
        
        try:
            with get_history_db_connection() as conn:
                cursor = conn.cursor()
                if is_admin:
                    cursor.execute(
                        "SELECT ch.*, u.username FROM chat_history ch "
                        "LEFT JOIN users u ON ch.user_id = u.id "
                        "ORDER BY ch.timestamp DESC LIMIT 100"
                    )
                else:
                    cursor.execute(
                        "SELECT * FROM chat_history WHERE user_id = ? AND is_deleted_by_user = FALSE ORDER BY timestamp DESC LIMIT 50",
                        (user_id,)
                    )
                
                history = cursor.fetchall()
                result = []
                for row in history:
                    history_dict = dict(zip([col[0] for col in cursor.description], row))
                    if history_dict.get('timestamp'):
                        if isinstance(history_dict['timestamp'], str):
                            history_dict['timestamp'] = datetime.fromisoformat(history_dict['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
                        else:
                            history_dict['timestamp'] = history_dict['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
                    if history_dict.get('source_documents'):
                        history_dict['source_documents'] = json.loads(history_dict['source_documents'])
                    result.append(history_dict)
                
                return jsonify({"history": result})
        except Exception as e:
            return jsonify({"error": f"Database error: {str(e)}"}), 500

    @app.route("/api/history/<int:history_id>", methods=["DELETE"])
    def delete_history(history_id):
        user_id = request.args.get("user_id", type=int)
        is_admin = request.args.get("is_admin", "false").lower() == "true"
        
        try:
            with get_history_db_connection() as conn:
                cursor = conn.cursor()
                if is_admin:
                    cursor.execute("DELETE FROM chat_history WHERE id = ?", (history_id,))
                else:
                    cursor.execute(
                        "UPDATE chat_history SET is_deleted_by_user = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                        (history_id, user_id)
                    )
                conn.commit()
                log_admin_action(user_id if is_admin else None, "delete_history", {"history_id": history_id})
                return jsonify({"message": "History deleted successfully"})
        except Exception as e:
            return jsonify({"error": f"Failed to delete history: {str(e)}"}), 400