import os
import sys
import json
from flask import jsonify  # Added import for jsonify
from ctransformers import AutoModelForCausalLM
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from sentence_transformers import SentenceTransformer
from sections.db_init import get_db_connection

BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "LLM-7B.gguf")
EMBED_MODEL = os.path.join(BASE_DIR, "models", "all-MiniLM-L6-v2")
CHROMA_BASE_DIR = os.path.join(BASE_DIR, "database", "chroma_db")
LLM_THREADS = int(os.getenv("LLM_THREADS", "8"))
LLM_CTX = int(os.getenv("LLM_CTX", "8192"))

# Default prompt template
DEFAULT_PROMPT_TEMPLATE = """
You are an HR assistant answering questions based on provided HR policy documents.
Use ONLY the context below to answer the query concisely and accurately.
If the context doesn't contain relevant information, respond: "This policy is not available in the documents."

Context: {context}

Query: {query}

Answer:
"""

_db = None
_llm = None
_embedder = None
_active_model_config = None
_sentence_transformer = None

def get_active_model_config():
    global _active_model_config
    if _active_model_config is None:
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM model_configurations WHERE is_active = TRUE LIMIT 1")
                result = cursor.fetchone()
                if result:
                    _active_model_config = dict(zip([col[0] for col in cursor.description], result))
                else:
                    _active_model_config = {
                        'model_path': MODEL_PATH,
                        'embed_model_path': EMBED_MODEL,
                        'chroma_db_base_path': CHROMA_BASE_DIR,
                        'max_context_tokens': LLM_CTX,
                        'max_new_tokens': 256,
                        'llm_type': 'ctransformers'
                    }
        except Exception as e:
            print(f"Error fetching model configuration: {str(e)}")
            _active_model_config = {
                'model_path': MODEL_PATH,
                'embed_model_path': EMBED_MODEL,
                'chroma_db_base_path': CHROMA_BASE_DIR,
                'max_context_tokens': LLM_CTX,
                'max_new_tokens': 256,
                'llm_type': 'ctransformers'
            }
    return _active_model_config

def load_db(collection_path=None):
    global _db, _embedder
    if _db is None or collection_path:
        config = get_active_model_config()
        chroma_dir = collection_path or config['chroma_db_base_path']
        embed_model = config['embed_model_path']
        if not os.path.isdir(chroma_dir):
            raise RuntimeError(f"Chroma directory not found: {chroma_dir}")
        _embedder = HuggingFaceEmbeddings(model_name=embed_model)
        _db = Chroma(persist_directory=chroma_dir, embedding_function=_embedder)
    return _db

def load_llm():
    global _llm
    if _llm is None:
        config = get_active_model_config()
        model_path = config['model_path']
        max_context = config['max_context_tokens']
        max_new_tokens = config['max_new_tokens']
        llm_type = config.get('llm_type', 'ctransformers')

        if not os.path.isfile(model_path):
            raise RuntimeError(f"LLM model file not found: {model_path}")

        if llm_type == 'ctransformers':
            _llm = AutoModelForCausalLM.from_pretrained(
                model_path,
                model_type="llama",
                gpu_layers=0,
                threads=LLM_THREADS,
                context_length=max_context,
                max_new_tokens=max_new_tokens,
                temperature=0.7
            )
        else:
            _llm = AutoModelForCausalLM.from_pretrained(
                model_path,
                model_type="llama",
                gpu_layers=0,
                threads=LLM_THREADS,
                context_length=max_context
            )
    return _llm

def load_sentence_transformer():
    global _sentence_transformer
    if _sentence_transformer is None:
        config = get_active_model_config()
        embed_model = config['embed_model_path']
        _sentence_transformer = SentenceTransformer(embed_model)
    return _sentence_transformer

def register_model_config_routes(app):
    @app.route("/api/status", methods=["GET"])
    def status():
        model_loaded = False
        db_ready = False
        ready = False
        
        try:
            load_db()
            db_ready = True
        except Exception as e:
            print(f"DB load error: {str(e)}")
        
        try:
            load_llm()
            model_loaded = True
        except Exception as e:
            print(f"LLM load error: {str(e)}")
        
        ready = model_loaded and db_ready
        config = get_active_model_config()
        
        return jsonify({
            "model_loaded": model_loaded,
            "db_ready": db_ready,
            "ready": ready,
            "active_config": dict(config) if isinstance(config, dict) else str(config),
            "config": {
                "chroma_dir": CHROMA_BASE_DIR,
                "embed_model": EMBED_MODEL,
                "model_path": MODEL_PATH
            }
        })
