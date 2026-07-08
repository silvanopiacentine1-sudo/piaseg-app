from dotenv import load_dotenv
load_dotenv()

import threading
import time

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from auth import authenticate, create_token, decode_token
from insurers import PDF_FOLDER, derive_display_name, delete_pdf, sync_index
from rag import (
    add_faq_entry,
    answer as rag_answer,
    delete_faq_entry,
    detect_insurer,
    get_insurer_display_name,
    get_insurer_options,
    invalidate_collection_cache,
    load_faq,
)

app = FastAPI(title="Piaseg Seguros API")

PDF_WATCH_INTERVAL_SECONDS = 30


def _watch_pdf_folder():
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
    try:
        PDF_FOLDER.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"[startup] Aviso: não foi possível criar pasta de PDFs ({PDF_FOLDER}): {e}")
    try:
        sync_index()
    except Exception as e:
        print(f"[startup] Aviso: sync_index falhou: {e}")
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


class FaqEntry(BaseModel):
    insurer: str
    question: str
    answer: str


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
        from insurers import load_manifest
        return sorted(load_manifest().keys())


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


@app.get("/health")
def health():
    return {"status": "ok"}
