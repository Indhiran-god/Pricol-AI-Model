import os
import sys
import time
import uuid
import json
from flask import jsonify, request
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from sentence_transformers import SentenceTransformer
import chromadb
from sections.db_init import get_db_connection, get_history_db_connection
# Remove this import - we'll call the API endpoint instead
from sections.model_config import DEFAULT_PROMPT_TEMPLATE, MODEL_PATH, EMBED_MODEL, CHROMA_BASE_DIR

# Store model configurations in memory (or use a database in production)
MODEL_CONFIGS = {}

prompt_template = PromptTemplate(
    input_variables=["query", "context"],
    template=DEFAULT_PROMPT_TEMPLATE
)

def truncate_context(text, max_tokens=2048):
    max_chars = max_tokens * 4
    if len(text) > max_chars:
        return text[-max_chars:]
    return text

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
                return None
            
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
                return []
            
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
            
            return collections
            
    except Exception as e:
        print(f"Error getting accessible collections: {str(e)}")
        return []

def get_all_collections_and_files():
    # Placeholder: Implement or import the actual function
    return []  # Replace with actual implementation

def register_chatbot_routes(app, load_llm, load_sentence_transformer, get_active_model_config):
    @app.route("/api/create-model", methods=["POST"])
    def create_model():
        data = request.get_json(force=True)
        model_id = str(uuid.uuid4())
        model_config = {
            "path": data.get("path", ""),
            "type": data.get("type", "gguf"),
            "context_size": data.get("contextSize", 4096),
            "threads": data.get("threads", 8),
            "temperature": data.get("temperature", 0.7),
            "prompt": data.get("prompt", ""),
            "status": "Not loaded"
        }
        
        if not model_config["path"]:
            return jsonify({"error": "Model path is required"}), 400
        
        MODEL_CONFIGS[model_id] = model_config
        return jsonify({"model_id": model_id, "message": "Model configuration created", "config": model_config})

    @app.route("/api/load-model/<model_id>", methods=["POST"])
    def load_model(model_id):
        if model_id not in MODEL_CONFIGS:
            return jsonify({"error": "Model configuration not found"}), 404
        
        model_config = MODEL_CONFIGS[model_id]
        try:
            llm = load_llm(
                path=model_config["path"],
                model_type=model_config["type"],
                context_size=model_config["context_size"],
                threads=model_config["threads"],
                temperature=model_config["temperature"],
                prompt=model_config["prompt"]
            )
            MODEL_CONFIGS[model_id]["status"] = "Loaded"
            return jsonify({"model_id": model_id, "message": "Model loaded successfully"})
        except Exception as e:
            MODEL_CONFIGS[model_id]["status"] = f"Error: {str(e)}"
            return jsonify({"error": f"Failed to load model: {str(e)}"}), 500

    @app.route("/api/models", methods=["GET"])
    def get_models():
        return jsonify({"models": MODEL_CONFIGS})

    @app.route("/api/search", methods=["POST"])
    def search():
        data = request.get_json(force=True)
        db_names = data.get("db_names", [])
        query = data.get("query", "").strip()
        user_id = data.get("user_id", type=int)
        model_id = data.get("model_id")  # Optional model_id to select specific model
        
        if not query or not user_id:
            return jsonify({"error": "Query and user ID required"}), 400
        if not db_names:
            return jsonify({"error": "At least one database name required"}), 400
        if model_id and model_id not in MODEL_CONFIGS:
            return jsonify({"error": "Invalid model ID"}), 400

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT department_id, grade_id, role FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                if not user_row:
                    return jsonify({"error": "User not found"}), 404
                user = dict(zip([col[0] for col in cursor.description], user_row))
                # Get accessible collections through user's assigned models
                accessible_collections = get_user_accessible_collections(user_id)
                if accessible_collections is None:
                    return jsonify({"error": "Failed to get accessible collections"}), 500
                accessible_collection_names = [coll['name'] for coll in accessible_collections]

            hits = []
            model = load_sentence_transformer()
            q_emb = model.encode([query], convert_to_numpy=True)[0].tolist()

            for db_name in db_names:
                parts = db_name.split("/")
                if len(parts) > 2:
                    db_dir, coll_name, file_name = parts[0], parts[1], "/".join(parts[2:])
                else:
                    db_dir, coll_name, file_name = parts[0], parts[1], None

                if coll_name not in accessible_collection_names and user['role'] != 'admin':
                    return jsonify({"error": f"Access denied to collection: {coll_name}"}), 403

                dir_path = os.path.join(CHROMA_BASE_DIR, db_dir)
                try:
                    client = chromadb.PersistentClient(path=dir_path)
                    collection = client.get_collection(name=coll_name)
                except Exception as e:
                    return jsonify({"error": f"Database or collection not found: {db_name}"}), 404

                query_params = {
                    "query_embeddings": [q_emb],
                    "n_results": 5,
                    "include": ["documents", "metadatas", "distances"]
                }
                if file_name:
                    query_params["where"] = {"source": file_name}

                results = collection.query(**query_params)
                docs = results.get("documents", [[]])[0]
                metas = results.get("metadatas", [[]])[0]
                distances = results.get("distances", [[]])[0]

                for doc, meta, dist in zip(docs, metas, distances):
                    score = 1.0 / (1.0 + dist) if dist is not None else 0.0
                    meta["collection"] = f"{db_dir}/{coll_name}"
                    hits.append({"document": doc, "metadata": meta, "score": score})

            hits = sorted(hits, key=lambda x: x["score"], reverse=True)[:5]
            context = "\n\n".join([hit["document"] for hit in hits]) if hits else "No relevant documents found."
            
            llm = load_llm(model_id=model_id) if model_id else load_llm()
            llm_chain = LLMChain(llm=llm, prompt=prompt_template)
            try:
                answer = llm_chain.invoke({"query": query, "context": context})["text"]
            except Exception as e:
                answer = f"Error generating answer: {str(e)}"

            return jsonify({
                "message": f"Found {len(hits)} results across selected databases/files",
                "results": hits,
                "query": query,
                "answer": answer,
                "collections": get_all_collections_and_files(),
                "model_id": model_id
            })
        except Exception as e:
            return jsonify({"error": f"Search error: {str(e)}"}), 500

    @app.route("/api/chat", methods=["POST"])
    def chat():
        data = request.get_json(force=True)
        query = data.get("query", "").strip()
        user_id = data.get("user_id", type=int)
        collection_id = data.get("collection_id", type=int)
        file_name = data.get("file_name", "")
        model_id = data.get("model_id")  # Optional model_id
        
        if not query or not user_id:
            return jsonify({"error": "Query and user ID required"}), 400
        if model_id and model_id not in MODEL_CONFIGS:
            return jsonify({"error": "Invalid model ID"}), 400
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT u.*, d.name as department_name, g.name as grade_name FROM users u "
                    "LEFT JOIN departments d ON u.department_id = d.id "
                    "LEFT JOIN grades g ON u.grade_id = g.id "
                    "WHERE u.id = ?", (user_id,)
                )
                user_row = cursor.fetchone()
                if not user_row:
                    return jsonify({"error": "User not found"}), 404
                user = dict(zip([col[0] for col in cursor.description], user_row))
                
                # Get accessible collections through user's assigned models
                accessible_collections = get_user_accessible_collections(user_id)
                if accessible_collections is None:
                    return jsonify({"error": "Failed to get accessible collections"}), 500
                if not accessible_collections:
                    return jsonify({"error": "No accessible documents found"}), 403
                
                target_collection = None
                if collection_id:
                    cursor.execute("SELECT * FROM document_collections WHERE id = ?", (collection_id,))
                    coll_row = cursor.fetchone()
                    if not coll_row:
                        return jsonify({"error": "Collection not found"}), 404
                    coll = dict(zip([col[0] for col in cursor.description], coll_row))
                    for c in accessible_collections:
                        if c['id'] == collection_id:
                            target_collection = c
                            break
                    if not target_collection:
                        return jsonify({"error": "Access denied to requested collection"}), 403
                else:
                    target_collection = accessible_collections[0]
            
            embedder = HuggingFaceEmbeddings(model_name=EMBED_MODEL)
            collection_db = Chroma(persist_directory=target_collection['chroma_db_path'], embedding_function=embedder)
            llm = load_llm(model_id=model_id) if model_id else load_llm()
            
            if file_name:
                docs = collection_db.similarity_search(query, k=3, filter={"source": file_name})
            else:
                docs = collection_db.similarity_search(query, k=3)
                
            context_parts = []
            source_documents = []
            
            for doc in docs:
                context_parts.append(doc.page_content)
                source_documents.append({
                    "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
                    "metadata": doc.metadata
                })
            
            context = "\n\n".join(context_parts)
            config = MODEL_CONFIGS.get(model_id, get_active_model_config()) if model_id else get_active_model_config()
            max_ctx = config['context_size'] if model_id else config['max_context_tokens']
            max_new_tokens = config['max_new_tokens']
            context = truncate_context(context, max_tokens=max_ctx // 2)
            
            prompt = prompt_template.format(query=query, context=context)
            prompt = truncate_context(prompt, max_tokens=max_ctx - 100)
            
            llm_chain = LLMChain(llm=llm, prompt=prompt_template)
            answer = llm_chain.invoke({"query": query, "context": context})["text"].strip()
            
            with get_history_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO chat_history (user_id, user_message, ai_response, document_collection_id, document_collection_name, source_documents, model_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (user_id, query, answer, target_collection['id'], target_collection['name'], json.dumps(source_documents), model_id)
                )
                conn.commit()
            
            return jsonify({
                "answer": answer,
                "source_collection": target_collection['name'],
                "source_file": file_name if file_name else None,
                "source_documents": source_documents,
                "model_id": model_id
            })
        except Exception as e:
            return jsonify({"error": f"Chat error: {str(e)}"}), 500
