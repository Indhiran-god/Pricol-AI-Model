import os
import sys
from flask import Flask, send_from_directory, abort
from flask_cors import CORS
from werkzeug.utils import secure_filename
from database.db_init import init_databases
from sections.grades import register_grade_routes
from sections.departments import register_department_routes
from sections.users import register_user_routes
from sections.documents import register_document_routes
from sections.chatbot import register_chatbot_routes
from sections.model_config import register_model_config_routes, load_llm, load_sentence_transformer, get_active_model_config
from sections.model_management import register_model_management_routes
from sections.history import register_history_routes
from sections.document_access import register_document_access_routes

# Initialize Flask app
BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
MAX_CONTENT_LENGTH = 200 * 1024 * 1024  # 200 MB

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", os.urandom(24).hex())
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
CORS(app, origins=os.getenv("CORS_ORIGINS", "*").split(","))

# Register routes from all sections
register_grade_routes(app)
register_department_routes(app)
register_user_routes(app)
register_document_routes(app, load_sentence_transformer)
register_chatbot_routes(app, load_llm, load_sentence_transformer, get_active_model_config)
register_model_config_routes(app)
register_model_management_routes(app)
register_history_routes(app)
register_document_access_routes(app)

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    filename = secure_filename(filename)
    if not os.path.isfile(os.path.join(app.config["UPLOAD_FOLDER"], filename)):
        abort(404)
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

if __name__ == "__main__":
    init_databases()  # Initialize databases before starting the app
    print("Starting Flask API on http://0.0.0.0:8000")
    app.run(host="0.0.0.0", port=8000, debug=False)
