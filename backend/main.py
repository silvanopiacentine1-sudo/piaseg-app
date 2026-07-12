from dotenv import load_dotenv
load_dotenv()

import threading
import time

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from auth import authenticate, create_token, decode_token, create_user, delete_user, load_users
import json
import uuid

from insurers import PDF_FOLDER, ESPECIAIS_FOLDER, DATA_DIR, derive_display_name, delete_pdf, delete_especial, sync_index, load_manifest, get_db
from rag import (
    add_faq_entry,
    answer as rag_answer,
    answer_assistance,
    answer_portfolio,
    delete_faq_entry,
    detect_assistance_query,
    detect_insurer,
    detect_portfolio_query,
    get_insurer_display_name,
    get_insurer_options,
    invalidate_collection_cache,
    load_faq,
)

app = FastAPI(title="Piaseg Seguros API")

ASSISTANCE_JSON_PATH = DATA_DIR / "assistance_contacts.json"


def _load_assistance() -> list:
    if not ASSISTANCE_JSON_PATH.exists():
        return []
    return json.loads(ASSISTANCE_JSON_PATH.read_text(encoding="utf-8"))


def _save_assistance(data: list) -> None:
    ASSISTANCE_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    ASSISTANCE_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

PDF_WATCH_INTERVAL_SECONDS = 120


def _watch_pdf_folder():
    # Aguarda 60s antes da primeira verificação para não sobrecarregar a memória no startup
    time.sleep(60)
    while True:
        try:
            updated = sync_index()
            if updated:
                print(f"[auto-index] Novos PDFs indexados: {updated}")
                invalidate_collection_cache()
        except Exception as e:
            print(f"[auto-index] Erro ao verificar pasta de PDFs: {e}")
        time.sleep(PDF_WATCH_INTERVAL_SECONDS)


@app.on_event("startup")
def on_startup():
    for folder in (PDF_FOLDER, ESPECIAIS_FOLDER):
        try:
            folder.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"[startup] Aviso: não foi possível criar pasta ({folder}): {e}")
    # sync_index() removido do startup: evita carregar o modelo ONNX duas vezes (512MB Render)
    # O watcher thread indexa novos PDFs após 60s do startup
    threading.Thread(target=_watch_pdf_folder, daemon=True).start()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")
    return payload


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    return user


class LoginRequest(BaseModel):
    username: str
    password: str


class ChatRequest(BaseModel):
    question: str
    query_type: str = "general"  # "general" | "portfolio" | "assistance"


class FaqEntry(BaseModel):
    insurer: str
    question: str
    answer: str


class UserCreate(BaseModel):
    username: str
    name: str
    password: str
    is_admin: bool = False


class AssistanceContact(BaseModel):
    name: str
    phone: str
    whatsapp: str = ""


@app.post("/auth/login")
def login(body: LoginRequest):
    user = authenticate(body.username, body.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha incorretos")
    token = create_token(user["username"], user["name"], user.get("is_admin", False))
    return {"token": token, "name": user["name"], "is_admin": user.get("is_admin", False)}


@app.post("/chat")
def chat(body: ChatRequest, user: dict = Depends(get_current_user)):
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Pergunta não pode ser vazia")

    if body.query_type == "portfolio":
        result = answer_portfolio(question)
        result["needs_insurer"] = False
        return result

    if body.query_type == "assistance":
        result = answer_assistance(question)
        result["needs_insurer"] = False
        return result

    # Perguntas digitadas: busca sempre nas Condições Gerais + FAQ
    source_filter = detect_insurer(question)
    if not source_filter:
        return {
            "answer": "Boa pergunta! 😊 Antes de responder, me diz: sobre qual seguradora é a sua dúvida?",
            "needs_insurer": True,
            "insurers": get_insurer_options(),
            "sources": [],
        }

    insurer_display = get_insurer_display_name(source_filter)
    result = rag_answer(question, source_filter=source_filter, insurer_display=insurer_display)
    result["needs_insurer"] = False
    return result


@app.get("/insurers")
def list_insurers(user: dict = Depends(get_current_user)):
    return get_insurer_options()


@app.post("/admin/upload-pdf")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos")

    PDF_FOLDER.mkdir(parents=True, exist_ok=True)
    pdf_path = PDF_FOLDER / file.filename
    content = await file.read()
    pdf_path.write_bytes(content)

    background_tasks.add_task(_index_and_invalidate)

    return {
        "filename": file.filename,
        "insurer": derive_display_name(file.filename),
        "message": "PDF salvo. A indexação está sendo processada em background.",
    }


def _index_and_invalidate():
    sync_index()
    invalidate_collection_cache()


@app.delete("/admin/pdf/{filename}")
def remove_pdf(filename: str, user: dict = Depends(require_admin)):
    if not delete_pdf(filename):
        raise HTTPException(status_code=404, detail="PDF não encontrado")
    invalidate_collection_cache()
    return {"ok": True}


@app.get("/admin/pdfs")
def list_pdfs(user: dict = Depends(require_admin)):
    if not PDF_FOLDER.exists():
        return []
    try:
        return sorted([p.name for p in PDF_FOLDER.glob("*.pdf")])
    except (PermissionError, OSError):
        return sorted(load_manifest().keys())


@app.post("/admin/upload-especial")
async def upload_especial(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos")
    ESPECIAIS_FOLDER.mkdir(parents=True, exist_ok=True)
    pdf_path = ESPECIAIS_FOLDER / file.filename
    content = await file.read()
    pdf_path.write_bytes(content)
    background_tasks.add_task(_index_and_invalidate)
    return {
        "filename": file.filename,
        "message": "Arquivo especial salvo. A indexação está sendo processada em background.",
    }


@app.get("/admin/especiais")
def list_especiais(user: dict = Depends(require_admin)):
    if not ESPECIAIS_FOLDER.exists():
        return []
    try:
        return sorted([p.name for p in ESPECIAIS_FOLDER.glob("*.pdf")])
    except (PermissionError, OSError):
        return []


@app.delete("/admin/especial/{filename}")
def remove_especial(filename: str, user: dict = Depends(require_admin)):
    if not delete_especial(filename):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    invalidate_collection_cache()
    return {"ok": True}


@app.get("/admin/index-status")
def index_status(user: dict = Depends(require_admin)):
    """Mostra quantos chunks cada PDF tem no banco, separado por pasta."""
    conn = get_db()
    rows = conn.execute(
        "SELECT source, COUNT(*) as n FROM chunks GROUP BY source ORDER BY source"
    ).fetchall()
    conn.close()
    indexed = {r[0]: r[1] for r in rows}

    cg_pdfs = []
    if PDF_FOLDER.exists():
        for p in sorted(PDF_FOLDER.glob("*.pdf")):
            chunks = indexed.get(p.name, 0)
            cg_pdfs.append({"file": p.name, "chunks": chunks, "indexed": chunks > 0})

    esp_pdfs = []
    if ESPECIAIS_FOLDER.exists():
        for p in sorted(ESPECIAIS_FOLDER.glob("*.pdf")):
            chunks = indexed.get(p.name, 0)
            esp_pdfs.append({"file": p.name, "chunks": chunks, "indexed": chunks > 0})

    return {
        "condicoes_gerais": cg_pdfs,
        "especiais": esp_pdfs,
        "total_chunks": sum(indexed.values()),
    }


@app.post("/admin/reindex")
def force_reindex(background_tasks: BackgroundTasks, user: dict = Depends(require_admin)):
    """Limpa o manifest e força re-indexação de todos os PDFs."""
    from insurers import save_manifest
    save_manifest({})
    background_tasks.add_task(_index_and_invalidate)
    return {"ok": True, "message": "Re-indexação iniciada. Aguarde 30 segundos e tente novamente."}


@app.get("/faq")
def list_faq_entries(user: dict = Depends(require_admin)):
    return load_faq()


@app.post("/faq")
def create_faq_entry(body: FaqEntry, user: dict = Depends(require_admin)):
    if not body.question.strip() or not body.answer.strip():
        raise HTTPException(status_code=400, detail="Pergunta e resposta não podem ser vazias")
    return add_faq_entry(body.insurer, body.question.strip(), body.answer.strip())


@app.delete("/faq/{faq_id}")
def remove_faq_entry(faq_id: str, user: dict = Depends(require_admin)):
    delete_faq_entry(faq_id)
    return {"ok": True}


@app.get("/admin/users")
def list_users_endpoint(user: dict = Depends(require_admin)):
    return [
        {"username": u["username"], "name": u["name"], "is_admin": u.get("is_admin", False)}
        for u in load_users()
    ]


@app.post("/admin/users", status_code=201)
def create_user_endpoint(body: UserCreate, user: dict = Depends(require_admin)):
    if not body.username.strip() or not body.name.strip() or not body.password:
        raise HTTPException(status_code=400, detail="Todos os campos são obrigatórios")
    try:
        return create_user(body.username.strip(), body.name.strip(), body.password, body.is_admin)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.delete("/admin/users/{username}")
def delete_user_endpoint(username: str, current_user: dict = Depends(require_admin)):
    if username == "admin":
        raise HTTPException(status_code=400, detail="Não é possível remover o usuário admin")
    if not delete_user(username):
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"ok": True}


@app.get("/assistance")
def list_assistance(user: dict = Depends(get_current_user)):
    return _load_assistance()


@app.post("/admin/assistance", status_code=201)
def create_assistance(body: AssistanceContact, user: dict = Depends(require_admin)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Nome é obrigatório")
    data = _load_assistance()
    entry = {"id": f"ast_{uuid.uuid4().hex[:8]}", "name": body.name.strip(), "phone": body.phone.strip(), "whatsapp": body.whatsapp.strip()}
    data.append(entry)
    _save_assistance(data)
    return entry


@app.delete("/admin/assistance/{contact_id}")
def delete_assistance(contact_id: str, user: dict = Depends(require_admin)):
    data = _load_assistance()
    new_data = [c for c in data if c["id"] != contact_id]
    if len(new_data) == len(data):
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    _save_assistance(new_data)
    return {"ok": True}


@app.get("/health")
def health():
    return {"status": "ok"}
