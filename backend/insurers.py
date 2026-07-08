import json
import os
import re
from pathlib import Path
from typing import Optional

import chromadb
import pdfplumber
from chromadb.utils import embedding_functions

_DEFAULT_PDF_FOLDER = "/Users/silvanopiacentine/Desktop/trabalho/Cond Gerais"
PDF_FOLDER = Path(os.getenv("PDF_FOLDER_PATH", _DEFAULT_PDF_FOLDER))

_APP_DIR = Path(__file__).parent
_requested = Path(os.getenv("DATA_DIR", str(_APP_DIR)))
# Valida se o DATA_DIR configurado é acessível; senão, usa o diretório do app
try:
    _requested.mkdir(parents=True, exist_ok=True)
    DATA_DIR = _requested
except Exception:
    DATA_DIR = _APP_DIR

DB_PATH = str(DATA_DIR / "chroma_db")
MANIFEST_PATH = DATA_DIR / "indexed_manifest.json"

KNOWN_DISPLAY_NAMES = {
    "HDI Auto perfil 2026.pdf": "HDI",
    "Mapfre 2026.pdf": "Mapfre",
    "Yelum Auto Perfil 2026.pdf": "Yelum",
    "porto seguro .pdf": "Porto Seguro",
}

STOPWORDS = {"auto", "perfil", "seguro", "seguros", "condicoes", "condições", "gerais", "geral"}
YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


def derive_display_name(filename: str) -> str:
    if filename in KNOWN_DISPLAY_NAMES:
        return KNOWN_DISPLAY_NAMES[filename]
    name = YEAR_RE.sub("", Path(filename).stem)
    words = [w for w in name.split() if w.lower() not in STOPWORDS]
    words = [w if w.isupper() else w.capitalize() for w in words]
    cleaned = " ".join(words).strip()
    return cleaned or Path(filename).stem.strip()


def discover_insurers() -> dict:
    """Retorna {nome_do_arquivo: nome_de_exibicao} para todos os PDFs na pasta."""
    if not PDF_FOLDER.exists():
        return {}
    try:
        return {p.name: derive_display_name(p.name) for p in sorted(PDF_FOLDER.glob("*.pdf"))}
    except (PermissionError, OSError):
        manifest = load_manifest()
        return {name: derive_display_name(name) for name in manifest.keys()}


def extract_chunks(pdf_path: Path, chunk_size: int = 800, overlap: int = 100) -> list:
    chunks = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = (page.extract_text() or "").strip()
            if not text:
                continue
            start = 0
            while start < len(text):
                end = min(start + chunk_size, len(text))
                chunk = text[start:end].strip()
                if len(chunk) > 50:
                    chunks.append({"text": chunk, "source": pdf_path.name, "page": page_num})
                start += chunk_size - overlap
    return chunks


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def save_manifest(data: dict) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def sync_index() -> list:
    """Verifica a pasta de PDFs e indexa arquivos novos ou alterados."""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"[sync_index] Não foi possível criar DATA_DIR ({DATA_DIR}): {e}")
        return []

    if not PDF_FOLDER.exists():
        return []

    try:
        pdf_files = sorted(PDF_FOLDER.glob("*.pdf"))
    except (PermissionError, OSError):
        return []

    manifest = load_manifest()
    client = chromadb.PersistentClient(path=DB_PATH)
    ef = embedding_functions.DefaultEmbeddingFunction()
    collection = client.get_or_create_collection("seguros", embedding_function=ef)

    updated = []
    for pdf_path in pdf_files:
        key = pdf_path.name
        mtime = pdf_path.stat().st_mtime
        if manifest.get(key) == mtime:
            continue

        try:
            collection.delete(where={"source": key})
        except Exception:
            pass

        chunks = extract_chunks(pdf_path)
        if chunks:
            collection.add(
                documents=[c["text"] for c in chunks],
                metadatas=[{"source": c["source"], "page": c["page"]} for c in chunks],
                ids=[f"{key}_{i}" for i in range(len(chunks))],
            )

        manifest[key] = mtime
        updated.append(key)

    save_manifest(manifest)
    return updated


def delete_pdf(filename: str) -> bool:
    """Remove um PDF da pasta e desindexar do ChromaDB."""
    pdf_path = PDF_FOLDER / filename
    if not pdf_path.exists():
        return False

    client = chromadb.PersistentClient(path=DB_PATH)
    ef = embedding_functions.DefaultEmbeddingFunction()
    collection = client.get_or_create_collection("seguros", embedding_function=ef)
    try:
        collection.delete(where={"source": filename})
    except Exception:
        pass

    manifest = load_manifest()
    manifest.pop(filename, None)
    save_manifest(manifest)

    pdf_path.unlink()
    return True
