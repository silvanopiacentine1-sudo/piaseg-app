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
ESPECIAIS_FOLDER = Path(os.getenv("ESPECIAIS_FOLDER_PATH", str(DATA_DIR / "especiais")))
PRODUCTS_FOLDER = DATA_DIR / "products_pdfs"
SERVICES_FOLDER = DATA_DIR / "services_pdfs"

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
    result = {}
    # Sistema legado: PDFs em /data/pdfs nomeados pela seguradora
    if PDF_FOLDER.exists():
        try:
            for p in sorted(PDF_FOLDER.glob("*.pdf")):
                result[_nfc(p.name)] = derive_display_name(_nfc(p.name))
        except (PermissionError, OSError):
            manifest = load_manifest()
            result.update({_nfc(name): derive_display_name(_nfc(name)) for name in manifest.keys()})
    # Novo sistema: products.json e services.json mapeiam pdoc_*.pdf → nome da seguradora
    for json_path in (DATA_DIR / "products.json", DATA_DIR / "services.json"):
        if json_path.exists():
            try:
                for cat in json.loads(json_path.read_text(encoding="utf-8")):
                    for doc in cat.get("documents", []):
                        fn = doc.get("filename", "")
                        name = doc.get("name", "").strip()
                        if fn and name:
                            result[_nfc(fn)] = name
            except Exception:
                pass
    return result


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(SEARCH_DB_PATH, timeout=20)
    conn.execute("PRAGMA journal_mode=WAL")
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
    # Prefix matching: "cobertura*" encontra "cobertura", "coberturas", etc.
    raw_terms = [t for t in clean.split() if t not in ('OR', 'AND', 'NOT') and len(t) >= 2]
    fts_query = " OR ".join(f'{t}*' for t in raw_terms) if raw_terms else clean
    conn = get_db()
    try:
        if source_filter:
            sf_nfc = _nfc(source_filter)
            sf_nfd = unicodedata.normalize("NFD", source_filter)
            rows = conn.execute(
                "SELECT source, page, text FROM chunks WHERE text MATCH ? AND (source = ? OR source = ?) ORDER BY rank LIMIT ?",
                (fts_query, sf_nfc, sf_nfd, top_k)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT source, page, text FROM chunks WHERE text MATCH ? ORDER BY rank LIMIT ?",
                (fts_query, top_k)
            ).fetchall()
        return [{"source": r[0], "page": int(r[1]) if r[1] else 0, "text": r[2]} for r in rows]
    except Exception as e:
        print(f"[search_chunks] Erro FTS5 (query={fts_query!r}): {e}")
        return []
    finally:
        conn.close()


def _text_to_chunks(text: str, source: str, page_num: int, chunk_size: int = 800, overlap: int = 100) -> list:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if len(chunk) > 50:
            chunks.append({"text": chunk, "source": source, "page": page_num})
        start += chunk_size - overlap
    return chunks


def extract_chunks(pdf_path: Path, chunk_size: int = 800, overlap: int = 100) -> list:
    source = _nfc(pdf_path.name)
    chunks = []

    # Tentativa 1: pypdf
    try:
        with open(pdf_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            for page_num, page in enumerate(reader.pages, start=1):
                try:
                    text = (page.extract_text() or "").strip()
                except Exception:
                    continue
                if text:
                    chunks.extend(_text_to_chunks(text, source, page_num, chunk_size, overlap))
    except Exception as e:
        print(f"[extract] pypdf falhou em {pdf_path.name}: {e}")

    if chunks:
        print(f"[extract] pypdf: {len(chunks)} chunks de {pdf_path.name}")
        return chunks

    # Tentativa 2: pdfplumber (melhor com PDFs de codificação diferente)
    try:
        import pdfplumber
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                try:
                    text = (page.extract_text() or "").strip()
                except Exception:
                    continue
                if text:
                    chunks.extend(_text_to_chunks(text, source, page_num, chunk_size, overlap))
        if chunks:
            print(f"[extract] pdfplumber: {len(chunks)} chunks de {pdf_path.name}")
            return chunks
    except ImportError:
        pass
    except Exception as e:
        print(f"[extract] pdfplumber falhou em {pdf_path.name}: {e}")

    print(f"[extract] AVISO: nenhum texto extraído de {pdf_path.name} — PDF pode ser imagem digitalizada")
    return []


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def save_manifest(data: dict) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def sync_index() -> list:
    # Bloqueia até o lock estar disponível (não pula — garante que toda adição/remoção seja processada)
    _sync_lock.acquire(blocking=True)
    try:
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"[sync_index] Não foi possível criar DATA_DIR ({DATA_DIR}): {e}")
            return []

        pdf_files = []
        for folder in (PDF_FOLDER, ESPECIAIS_FOLDER, PRODUCTS_FOLDER, SERVICES_FOLDER):
            if not folder.exists():
                continue
            try:
                pdf_files += sorted(folder.glob("*.pdf"))
            except (PermissionError, OSError):
                pass

        if not pdf_files:
            return []

        manifest = load_manifest()
        conn = get_db()

        # 1. Remove chunks de arquivos que não existem mais no disco
        # (só faz isso quando há pelo menos um PDF em disco — evita limpar tudo se o disco não estiver montado)
        all_pdf_names_nfc = {_nfc(p.name) for p in pdf_files}
        stale = conn.execute("SELECT DISTINCT source FROM chunks").fetchall()
        for (src,) in stale:
            if _nfc(src) not in all_pdf_names_nfc:
                conn.execute("DELETE FROM chunks WHERE source = ? OR source = ?", (src, _nfc(src)))
                manifest.pop(src, None)
                manifest.pop(_nfc(src), None)
                manifest.pop(_nfd(src), None)
                print(f"[sync_index] Chunks removidos para arquivo deletado: {src}")

        # 2. Determina quais arquivos precisam ser (re-)indexados:
        #    - mtime diferente do manifest (arquivo novo ou modificado)
        #    - OU chunks ausentes do banco (manifest mentindo — ex: banco foi resetado)
        needs_update = []
        for p in pdf_files:
            key = _nfc(p.name)
            mtime_ok = (
                manifest.get(key) == p.stat().st_mtime
                or manifest.get(_nfd(key)) == p.stat().st_mtime
            )
            if not mtime_ok:
                needs_update.append(p)
                continue
            # Mesmo que o manifest diga "ok", verifica se chunks existem no banco
            row = conn.execute("SELECT COUNT(*) FROM chunks WHERE source = ? OR source = ?", (key, _nfd(key))).fetchone()
            if row[0] == 0:
                print(f"[sync_index] Arquivo no manifest mas sem chunks no banco — re-indexando: {key}")
                needs_update.append(p)

        updated = []
        for pdf_path in needs_update:
            key = _nfc(pdf_path.name)
            mtime = pdf_path.stat().st_mtime
            conn.execute("DELETE FROM chunks WHERE source = ? OR source = ?", (key, _nfd(key)))
            chunks = extract_chunks(pdf_path)
            if chunks:
                conn.executemany(
                    "INSERT INTO chunks (source, page, text) VALUES (?, ?, ?)",
                    [(c["source"], str(c["page"]), c["text"]) for c in chunks],
                )
            manifest.pop(_nfd(key), None)
            manifest[key] = mtime
            updated.append(key)
            print(f"[sync_index] Indexado: {key} ({len(chunks)} chunks)")

        conn.commit()
        conn.close()
        save_manifest(manifest)
        return updated
    finally:
        _sync_lock.release()


def find_portfolio_source() -> Optional[str]:
    """Retorna o source exato do portifólio no banco, buscando por 'ortif' no nome."""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT DISTINCT source FROM chunks WHERE source LIKE ? LIMIT 1",
            ("%ortif%",)
        ).fetchone()
        return row[0] if row else None
    except Exception:
        return None
    finally:
        conn.close()


def find_assistance_source() -> Optional[str]:
    """Retorna o source exato do documento de assistências no banco."""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT DISTINCT source FROM chunks WHERE source LIKE ? OR source LIKE ? LIMIT 1",
            ("%ssistên%", "%24h%")
        ).fetchone()
        return row[0] if row else None
    except Exception:
        return None
    finally:
        conn.close()


def _delete_chunks_and_manifest(filename: str) -> None:
    """Remove chunks do FTS5 e entradas do manifest para um arquivo."""
    nfc_name = _nfc(filename)
    nfd_name = _nfd(filename)
    conn = get_db()
    conn.execute("DELETE FROM chunks WHERE source = ? OR source = ?", (nfc_name, nfd_name))
    conn.commit()
    conn.close()
    manifest = load_manifest()
    manifest.pop(nfc_name, None)
    manifest.pop(nfd_name, None)
    save_manifest(manifest)


def delete_pdf(filename: str) -> bool:
    pdf_path = PDF_FOLDER / _nfc(filename)
    if not pdf_path.exists():
        pdf_path = PDF_FOLDER / _nfd(filename)
        if not pdf_path.exists():
            return False
    _delete_chunks_and_manifest(filename)
    pdf_path.unlink()
    return True


def delete_especial(filename: str) -> bool:
    """Remove arquivo da pasta especiais e desvincula do índice."""
    pdf_path = ESPECIAIS_FOLDER / _nfc(filename)
    if not pdf_path.exists():
        pdf_path = ESPECIAIS_FOLDER / _nfd(filename)
        if not pdf_path.exists():
            return False
    _delete_chunks_and_manifest(filename)
    pdf_path.unlink()
    return True


def delete_product_pdf(filename: str) -> bool:
    for name in (_nfc(filename), _nfd(filename)):
        pdf_path = PRODUCTS_FOLDER / name
        if pdf_path.exists():
            _delete_chunks_and_manifest(filename)
            pdf_path.unlink()
            return True
    return False


def delete_service_pdf(filename: str) -> bool:
    for name in (_nfc(filename), _nfd(filename)):
        pdf_path = SERVICES_FOLDER / name
        if pdf_path.exists():
            _delete_chunks_and_manifest(filename)
            pdf_path.unlink()
            return True
    return False
