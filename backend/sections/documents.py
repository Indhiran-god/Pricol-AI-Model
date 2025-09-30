import os
import sys
import uuid
import time
import json
from flask import jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
from database.db_init import get_db_connection, log_admin_action
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import Docx2txtLoader
from pypdf import PdfReader
import chromadb
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
CHROMA_BASE_DIR = os.path.join(BASE_DIR, "database", "chroma_db")
ALLOWED_EXTENSIONS = {"pdf", "txt", "docx"}
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CHROMA_BASE_DIR, exist_ok=True)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def read_pdf_text(path):
    try:
        text_pages = []
        reader = PdfReader(path)
        for page in reader.pages:
            text = page.extract_text() or ""
            text_pages.append(text)
        return text_pages
    except Exception as e:
        logger.error(f"Error reading PDF {path}: {str(e)}")
        return []

def read_txt(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return [f.read()]
    except Exception as e:
        logger.error(f"Error reading TXT {path}: {str(e)}")
        return []

def read_docx(path):
    try:
        loader = Docx2txtLoader(path)
        return [doc.page_content for doc in loader.load()]
    except Exception as e:
        logger.error(f"Error reading DOCX {path}: {str(e)}")
        return []

def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    return [chunk.page_content for chunk in splitter.create_documents([text])]

def get_chroma_collection(db_name=None):
    if db_name:
        db_name = secure_filename(db_name)
    # Use the main ChromaDB directory, not create subdirectories
    client = chromadb.PersistentClient(path=CHROMA_BASE_DIR)
    collection_name = db_name or f"collection_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    return client, client.get_or_create_collection(name=collection_name)

def get_all_collections_and_files():
    collections = []
    try:
        # Connect to the main ChromaDB directory
        client = chromadb.PersistentClient(path=CHROMA_BASE_DIR)
        
        # Get all collections from the main client
        for coll in client.list_collections():
            try:
                results = coll.get(include=["metadatas"])
                files = set(meta.get("source") for meta in results.get("metadatas", []) if meta.get("source"))
                collections.append({
                    "db_dir": CHROMA_BASE_DIR,
                    "name": coll.name,
                    "count": coll.count(),
                    "files": sorted(list(files))
                })
            except Exception as e:
                logger.error(f"Error accessing collection {coll.name}: {e}")
    except Exception as e:
        logger.error(f"Error accessing ChromaDB at {CHROMA_BASE_DIR}: {e}")
    
    # Also check for collections in individual database directories
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT chroma_db_path FROM document_collections")
            db_paths = [row['chroma_db_path'] for row in cursor.fetchall()]
            
            for db_path in db_paths:
                if os.path.exists(db_path):
                    try:
                        client = chromadb.PersistentClient(path=db_path)
                        for coll in client.list_collections():
                            try:
                                results = coll.get(include=["metadatas"])
                                files = set(meta.get("source") for meta in results.get("metadatas", []) if meta.get("source"))
                                collections.append({
                                    "db_dir": db_path,
                                    "name": coll.name,
                                    "count": coll.count(),
                                    "files": sorted(list(files))
                                })
                            except Exception as e:
                                logger.error(f"Error accessing collection {coll.name} in {db_path}: {e}")
                    except Exception as e:
                        logger.error(f"Error accessing ChromaDB at {db_path}: {e}")
    except Exception as e:
        logger.error(f"Error reading database paths: {e}")
    
    return collections

def register_document_routes(app, load_sentence_transformer):
    # CORS is already configured in the main app.py file

    @app.route("/api/documents/collections", methods=["GET"])
    def get_document_collections():
        user_id = request.args.get("user_id", type=int)
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if user_id:
                    cursor.execute("SELECT department_id, grade_id, role FROM users WHERE id = ?", (user_id,))
                    user_row = cursor.fetchone()
                    if user_row:
                        user = dict(zip([col[0] for col in cursor.description], user_row))
                        if user['role'] == 'admin':
                            cursor.execute("SELECT * FROM document_collections")
                        else:
                            cursor.execute(
                                "SELECT DISTINCT dc.* FROM document_collections dc "
                                "LEFT JOIN document_access da ON dc.id = da.document_collection_id "
                                "WHERE da.department_id = ? OR da.grade_id = ? OR da.user_id = ?",
                                (user['department_id'], user['grade_id'], user_id)
                            )
                    else:
                        cursor.execute("SELECT * FROM document_collections")
                else:
                    cursor.execute("SELECT * FROM document_collections")
                
                collections = cursor.fetchall()
                collections_with_files = []
                all_collections = get_all_collections_and_files()
                
                for coll in collections:
                    coll_dict = dict(zip([col[0] for col in cursor.description], coll))
                    # Fix collection matching logic
                    matching_coll = next(
                        (c for c in all_collections if c['name'] == coll_dict['name']),
                        None
                    )
                    coll_dict['files'] = matching_coll['files'] if matching_coll else []
                    collections_with_files.append(coll_dict)
                
                return jsonify({"collections": collections_with_files})
        except Exception as e:
            logger.error(f"Database error in get_document_collections: {str(e)}")
            return jsonify({"error": f"Database error: {str(e)}"}), 500

    @app.route("/api/documents/collections", methods=["POST"])
    def create_document_collection():
        try:
            data = request.get_json(force=True)
            name = data.get("name", "").strip()
            user_id = data.get("user_id")
            if user_id is not None:
                user_id = int(user_id)
            
            if not name or not user_id:
                return jsonify({"error": "Collection name and user ID required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if not user_row or user_row['role'] != 'admin':
                    return jsonify({"error": "Only admins can create collections"}), 403
            
            chroma_dir = os.path.join(CHROMA_BASE_DIR, f"db_{int(time.time())}_{uuid.uuid4().hex[:8]}")
            os.makedirs(chroma_dir, exist_ok=True)
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO document_collections (name, chroma_db_path, created_by) VALUES (?, ?, ?)",
                    (name, chroma_dir, user_id)
                )
                conn.commit()
                collection_id = cursor.lastrowid
                log_admin_action(user_id, "create_collection", {"name": name, "collection_id": collection_id})
                return jsonify({"message": "Collection created successfully", "collection_id": collection_id})
        except Exception as e:
            logger.error(f"Failed to create collection: {str(e)}")
            return jsonify({"error": f"Failed to create collection: {str(e)}"}), 400
    @app.route("/api/documents/files", methods=["DELETE"])
    def delete_file():
        try:
            data = request.get_json(force=True)
            db_name = data.get("db_name")
            filename = data.get("filename")
            user_id = data.get("user_id", type=int)

            if not db_name or not filename or not user_id:
                return jsonify({"error": "Collection name, filename, and user ID required"}), 400

            # Check if user is admin
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if not user_row or user_row['role'] != 'admin':
                    return jsonify({"error": "Only admins can delete files"}), 403

            # Get ChromaDB collection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT chroma_db_path FROM document_collections WHERE name = ?", (db_name,))
                collection_row = cursor.fetchone()
                if not collection_row:
                    return jsonify({"error": f"Collection '{db_name}' not found"}), 404
                chroma_db_path = collection_row['chroma_db_path']

            client = chromadb.PersistentClient(path=chroma_db_path)
            collection = client.get_collection(name=db_name)

            # Delete documents associated with the file
            results = collection.get(where={"source": filename}, include=["metadatas", "ids"])
            ids_to_delete = results.get("ids", [])
            if ids_to_delete:
                collection.delete(ids=ids_to_delete)
                logger.info(f"Deleted {len(ids_to_delete)} chunks for file '{filename}' in collection '{db_name}'")

            # Delete the physical file if it exists
            for f in os.listdir(UPLOAD_FOLDER):
                if secure_filename(f).endswith(filename):
                    os.remove(os.path.join(UPLOAD_FOLDER, f))
                    logger.info(f"Deleted physical file '{filename}' from {UPLOAD_FOLDER}")
                    break

            log_admin_action(user_id, "delete_file", {"collection_name": db_name, "filename": filename})
            return jsonify({"message": f"Successfully deleted file '{filename}' from collection '{db_name}'"})
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return jsonify({"error": f"Error deleting file: {str(e)}"}), 500

    @app.route("/api/documents/collections", methods=["DELETE"])
    def delete_collection():
        try:
            data = request.get_json(force=True)
            db_name = data.get("db_name")
            user_id = data.get("user_id", type=int)

            if not db_name or not user_id:
                return jsonify({"error": "Collection name and user ID required"}), 400

            # Check if user is admin
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if not user_row or user_row['role'] != 'admin':
                    return jsonify({"error": "Only admins can delete collections"}), 403

            # Get ChromaDB collection path and files before deletion
            collection_files = []
            chroma_db_path = None
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT chroma_db_path FROM document_collections WHERE name = ?", (db_name,))
                collection_row = cursor.fetchone()
                if not collection_row:
                    return jsonify({"error": f"Collection '{db_name}' not found"}), 404
                chroma_db_path = collection_row['chroma_db_path']

                # Get collection files before deleting the collection
                try:
                    client_temp = chromadb.PersistentClient(path=chroma_db_path)
                    coll = client_temp.get_collection(name=db_name)
                    results = coll.get(include=["metadatas"])
                    collection_files = set(meta.get("source") for meta in results.get("metadatas", []) if meta.get("source"))
                except Exception as e:
                    logger.warning(f"Could not get files from collection before deletion: {str(e)}")

            # Delete the collection from ChromaDB
            client = chromadb.PersistentClient(path=chroma_db_path)
            client.delete_collection(name=db_name)
            logger.info(f"Deleted collection '{db_name}' from ChromaDB")

            # Delete physical files associated with the collection
            for filename in collection_files:
                for f in os.listdir(UPLOAD_FOLDER):
                    if secure_filename(f).endswith(filename):
                        os.remove(os.path.join(UPLOAD_FOLDER, f))
                        logger.info(f"Deleted physical file '{filename}' from {UPLOAD_FOLDER}")

            # Delete collection record from database
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM document_collections WHERE name = ?", (db_name,))
                conn.commit()

            # Optionally, delete the ChromaDB directory if empty
            if os.path.exists(chroma_db_path) and not os.listdir(chroma_db_path):
                os.rmdir(chroma_db_path)
                logger.info(f"Deleted empty ChromaDB directory '{chroma_db_path}'")

            log_admin_action(user_id, "delete_collection", {"collection_name": db_name})
            return jsonify({"message": f"Successfully deleted collection '{db_name}'"})
        except Exception as e:
            logger.error(f"Error deleting collection: {str(e)}")
            return jsonify({"error": f"Error deleting collection: {str(e)}"}), 500

    @app.route("/api/upload", methods=["POST"])
    def upload():
        try:
            data = request.form
            db_name = data.get("db_name", "").strip()
            user_id = data.get("user_id", type=int)
            
            if not user_id:
                return jsonify({"error": "User ID required"}), 400
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if not user_row or user_row['role'] != 'admin':
                    return jsonify({"error": "Only admins can upload documents"}), 403
            
            if "files" not in request.files:
                return jsonify({"error": "No files provided"}), 400
            
            files = request.files.getlist("files")
            if not files or all(not file.filename for file in files):
                return jsonify({"error": "No valid files provided"}), 400

            # Check if collection exists, if not create it
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT chroma_db_path FROM document_collections WHERE name = ?", (db_name,))
                collection_row = cursor.fetchone()
                
                if not collection_row:
                    # Collection doesn't exist, create it
                    logger.info(f"Collection '{db_name}' not found, creating new collection")
                    chroma_dir = os.path.join(CHROMA_BASE_DIR, f"db_{int(time.time())}_{uuid.uuid4().hex[:8]}")
                    os.makedirs(chroma_dir, exist_ok=True)
                    
                    cursor.execute(
                        "INSERT INTO document_collections (name, chroma_db_path, created_by) VALUES (?, ?, ?)",
                        (db_name, chroma_dir, user_id)
                    )
                    conn.commit()
                    collection_id = cursor.lastrowid
                    log_admin_action(user_id, "create_collection", {"name": db_name, "collection_id": collection_id})
                    
                    chroma_db_path = chroma_dir
                    logger.info(f"Created new collection '{db_name}' with path: {chroma_db_path}")
                else:
                    chroma_db_path = collection_row['chroma_db_path']
            
            # Ensure the ChromaDB directory exists
            os.makedirs(chroma_db_path, exist_ok=True)
            
            # Connect to the ChromaDB collection (create if doesn't exist)
            client = chromadb.PersistentClient(path=chroma_db_path)
            collection = client.get_or_create_collection(name=db_name)
            
            all_texts = []
            all_metadatas = []
            
            model = load_sentence_transformer()
            
            for file in files:
                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    unique_name = f"{uuid.uuid4().hex}_{filename}"
                    save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
                    file.save(save_path)
                    
                    ext = filename.rsplit(".", 1)[1].lower()
                    if ext == "pdf":
                        pages = read_pdf_text(save_path)
                    elif ext == "txt":
                        pages = read_txt(save_path)
                    elif ext == "docx":
                        pages = read_docx(save_path)
                    else:
                        continue

                    for page_i, page_text in enumerate(pages, start=1):
                        if not page_text.strip():
                            continue
                        chunks = chunk_text(page_text)
                        for ci, chunk in enumerate(chunks):
                            all_texts.append(chunk)
                            all_metadatas.append({
                                "source": filename,
                                "page": page_i,
                                "chunk_index": ci,
                                "collection": collection.name
                            })

            if not all_texts:
                return jsonify({"error": "No textual content found in uploaded files"}), 400

            embeddings = model.encode(all_texts, show_progress_bar=True, convert_to_numpy=True)
            ids = [str(uuid.uuid4()) for _ in all_texts]
            collection.add(
                documents=all_texts,
                metadatas=all_metadatas,
                ids=ids,
                embeddings=embeddings.tolist()
            )

            log_admin_action(user_id, "upload_document", {"collection_name": db_name, "files": [f.filename for f in files]})
            return jsonify({
                "message": f"Uploaded and added {len(all_texts)} chunks to Chroma DB: {collection.name}",
                "collection_name": db_name
            })
        except Exception as e:
            logger.error(f"Upload error: {str(e)}")
            return jsonify({"error": f"Upload error: {str(e)}"}), 500
