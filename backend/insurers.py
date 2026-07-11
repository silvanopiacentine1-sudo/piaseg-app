import json
import os
import re
import sqlite3
import threading
import unicodedata
from pathlib import Path
from typing import Optional

import pypdf


def _nfc(text: str) -> str:
    """Normaliza para NFC — evita mismatch entre macOS (NFD) e constantes Python (NFC)."""
    return unicodedata.normalize("NFC", text)

_sync_lock = threading.Lock()

_DEFAULT_PDF_FOLDER = "/Users/silvanopiacentine/Desktop/trabalho/Cond Gerais"
PDF_FOLDER = Path(os.getenv("PDF_FOLDER_PATH", _DEFAULT_PDF_FOLDER))

_APP_DIR = Path(__file__).parent
_requested = Path(os.getenv("DATA_DIR", str(_APP_DIR)))
try:
    _requested.mkdir(parents=True, exist_ok=True)
    DATA_DIR = _requested
except Exception:
    DATA_DIR = _APP_DIR

SEARCH_DB_PATH = str(DATA_DIR / "search.db")
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


def _nfd(text: str) -> str:
    return unicodedata.normalize("NFD", text)


def discover_insurers() -> dict:
    if not PDF_FOLDER.exists():
        return {}
    try:
        return {_nfc(p.name): derive_display_name(_nfc(p.name)) for p in sorted(PDF_FOLDER.glob("*.pdf"))}
    except (PermissionError, OSError):
        manifest = load_manifest()
        return {_nfc(name): derive_display_name(_nfc(name)) for name in manifest.keys()}


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(SEARCH_DB_PATH)
    conn.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks
        USING fts5(source UNINDEXED, page UNINDEXED, text, tokenize='unicode61')
    """)
    conn.commit()
    return conn


def search_chunks(query: str, source_filter: Optional[str] = None, top_k: int = 6) -> list:
    clean = re.sub(r'[^\w\s]', ' ', query, flags=re.UNICODE).strip()
    if not clean:
        return []
    conn = get_db()
    try:
        if source_filter:
            # Testa NFC e NFD: macOS salva nomes de arquivo em NFD,
            # mas constantes Python são NFC — comparação direta falharia.
            sf_nfc = _nfc(source_filter)
            sf_nfd = unicodedata.normalize("NFD", source_filter)
            rows = conn.execute(
                "SELECT source, page, text FROM chunks WHERE text MATCH ? AND (source = ? OR source = ?) ORDER BY rank LIMIT ?",
                (clean, sf_nfc, sf_nfd, top_k)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT source, page, text FROM chunks WHERE text MATCH ? ORDER BY rank LIMIT ?",
                (clean, top_k)
            ).fetchall()
        return [{"source": r[0], "page": int(r[1]) if r[1] else 0, "text": r[2]} for r in rows]
    except Exception:
        return []
    finally:
        conn.close()


def extract_chunks(pdf_path: Path, chunk_size: int = 800, overlap: int = 100) -> list:
    chunks = []
    with open(pdf_path, "rb") as f:
        reader = pypdf.PdfReader(f)
        for page_num, page in enumerate(reader.pages, start=1):
            try:
                text = (page.extract_text() or "").strip()
            except Exception:
                continue
            if not text:
                continue
            start = 0
            while start < len(text):
                end = min(start + chunk_size, len(text))
                chunk = text[start:end].strip()
                if len(chunk) > 50:
                    chunks.append({"text": chunk, "source": _nfc(pdf_path.name), "page": page_num})
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
    if not _sync_lock.acquire(blocking=False):
        return []  # Outra indexação já está em andamento
    try:
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

        # Se o banco está vazio mas o manifest tem entradas, força re-indexação
        conn = get_db()
        count = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        conn.close()
        if count == 0 and manifest:
            manifest = {}

        # Usa NFC como chave canônica; ignora entradas NFD antigas no manifest
        needs_update = [
            p for p in pdf_files
            if manifest.get(_nfc(p.name)) != p.stat().st_mtime
            and manifest.get(_nfd(p.name)) != p.stat().st_mtime
        ]
        if not needs_update:
            return []

        conn = get_db()
        updated = []
        for pdf_path in needs_update:
            key = _nfc(pdf_path.name)   # sempre NFC no banco e no manifest
            mtime = pdf_path.stat().st_mtime

            # Remove chunks pela chave NFC e NFD (limpeza de dados antigos)
            conn.execute("DELETE FROM chunks WHERE source = ? OR source = ?", (key, _nfd(key)))
            chunks = extract_chunks(pdf_path)
            if chunks:
                conn.executemany(
                    "INSERT INTO chunks (source, page, text) VALUES (?, ?, ?)",
                    [(c["source"], str(c["page"]), c["text"]) for c in chunks],
                )

            # Remove entradas antigas NFD do manifest e salva NFC
            manifest.pop(_nfd(key), None)
            manifest[key] = mtime
            updated.append(key)

        conn.commit()
        conn.close()
        save_manifest(manifest)
        return updated
    finally:
        _sync_lock.release()


def delete_pdf(filename: str) -> bool:
    # Tenta NFC primeiro; depois NFD (nome real no filesystem pode ser NFD)
    pdf_path = PDF_FOLDER / _nfc(filename)
    if not pdf_path.exists():
        pdf_path = PDF_FOLDER / _nfd(filename)
        if not pdf_path.exists():
            return False

    conn = get_db()
    nfc_name = _nfc(filename)
    nfd_name = _nfd(filename)
    conn.execute("DELETE FROM chunks WHERE source = ? OR source = ?", (nfc_name, nfd_name))
    conn.commit()
    conn.close()

    manifest = load_manifest()
    manifest.pop(nfc_name, None)
    manifest.pop(nfd_name, None)
    save_manifest(manifest)

    pdf_path.unlink()
    return True
