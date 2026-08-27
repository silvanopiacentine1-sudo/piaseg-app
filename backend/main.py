from dotenv import load_dotenv
load_dotenv()

import io
import os
import re
import smtplib
import threading
import time
import urllib.request as _urllib
import zipfile
from datetime import datetime, timezone, timedelta
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from fpdf import FPDF
from pydantic import BaseModel

from auth import authenticate, create_token, decode_token, create_user, delete_user, load_users, update_user
import json
import uuid

from insurers import (
    PDF_FOLDER, ESPECIAIS_FOLDER, DATA_DIR, PRODUCTS_FOLDER, SERVICES_FOLDER,
    OFFICE_EXTENSIONS,
    derive_display_name, delete_pdf, delete_especial, delete_product_pdf, delete_service_pdf,
    sync_index, load_manifest, get_db,
)
from rag import (
    add_faq_entry,
    answer as rag_answer,
    answer_assistance,
    answer_from_faq_if_possible,
    answer_portfolio,
    delete_faq_entry,
    detect_assistance_query,
    detect_insurer,
    detect_portfolio_query,
    get_insurer_display_name,
    get_insurer_options,
    invalidate_collection_cache,
    load_faq,
    update_faq_entry,
)

app = FastAPI(title="Piaseg Seguros API")

ASSISTANCE_JSON_PATH = DATA_DIR / "assistance_contacts.json"
QUIVER_JSON_PATH = DATA_DIR / "quiver_links.json"
PRODUCTS_JSON_PATH = DATA_DIR / "products.json"
SERVICES_JSON_PATH = DATA_DIR / "services.json"
FAQ_CATEGORIES_JSON_PATH = DATA_DIR / "faq_categories.json"


def _load_faq_categories() -> list:
    if not FAQ_CATEGORIES_JSON_PATH.exists():
        return []
    return json.loads(FAQ_CATEGORIES_JSON_PATH.read_text(encoding="utf-8"))


def _save_faq_categories(data: list) -> None:
    FAQ_CATEGORIES_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    FAQ_CATEGORIES_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_assistance() -> list:
    if not ASSISTANCE_JSON_PATH.exists():
        return []
    return json.loads(ASSISTANCE_JSON_PATH.read_text(encoding="utf-8"))


def _save_assistance(data: list) -> None:
    ASSISTANCE_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    ASSISTANCE_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_quiver() -> list:
    if not QUIVER_JSON_PATH.exists():
        return []
    return json.loads(QUIVER_JSON_PATH.read_text(encoding="utf-8"))


def _save_quiver(data: list) -> None:
    QUIVER_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    QUIVER_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _safe_text(text: str) -> str:
    return text.encode("latin-1", "replace").decode("latin-1")


def _strip_md(text: str) -> str:
    import re
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'^#{1,3}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^---+$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[•*-]\s+', '- ', text, flags=re.MULTILINE)
    return text.strip()


def _generate_pdf(messages: list, user_name: str) -> bytes:
    pdf = FPDF()
    pdf.set_margins(15, 15, 15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(0, 33, 58)
    pdf.cell(0, 8, "Piazinho - Assistente Virtual Piaseg", ln=True, align="C")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(130, 130, 130)
    pdf.cell(0, 5, _safe_text(f"Conversa de {user_name} - {datetime.now().strftime('%d/%m/%Y as %H:%M')}"), ln=True, align="C")
    pdf.ln(3)
    pdf.set_draw_color(184, 151, 92)
    pdf.set_line_width(0.5)
    pdf.line(15, pdf.get_y(), pdf.w - 15, pdf.get_y())
    pdf.ln(5)

    for msg in messages:
        clean = _safe_text(_strip_md(msg.content))
        if not clean:
            continue
        if msg.role == "user":
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(184, 151, 92)
            pdf.cell(0, 4, "VOCE:", ln=True)
            pdf.set_fill_color(240, 237, 230)
        else:
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(0, 33, 58)
            pdf.cell(0, 4, "PIAZINHO:", ln=True)
            pdf.set_fill_color(249, 248, 244)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(17, 17, 17)
        pdf.multi_cell(0, 5, clean, fill=True, border=0)
        pdf.ln(3)

    return bytes(pdf.output())


def _send_email_pdf(to_email: str, user_name: str, pdf_bytes: bytes) -> None:
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    email_from = os.getenv("EMAIL_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_pass:
        raise HTTPException(
            status_code=503,
            detail="Configuracao de e-mail nao definida no servidor. Configure SMTP_HOST, SMTP_USER e SMTP_PASS."
        )

    msg = MIMEMultipart("mixed")
    msg["From"] = f"Piazinho Piaseg <{email_from}>"
    msg["To"] = to_email
    msg["Subject"] = _safe_text(f"Sua conversa com o Piazinho - {datetime.now().strftime('%d/%m/%Y')}")

    html_body = (
        f"<html><body style='font-family:Arial,sans-serif;color:#111;line-height:1.6'>"
        f"<p>Ola, <strong>{user_name}</strong>!</p>"
        f"<p>Segue em anexo o historico da sua conversa com o <strong>Piazinho</strong>, "
        f"assistente virtual da Piaseg Seguros Franchising.</p>"
        f"<p>Qualquer duvida, entre em contato com a equipe Piaseg.</p>"
        f"<br><p>Atenciosamente,<br><strong>Piaseg Seguros Franchising</strong></p>"
        f"</body></html>"
    )
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    att = MIMEBase("application", "pdf")
    att.set_payload(pdf_bytes)
    encoders.encode_base64(att)
    filename = f"conversa-piazinho-{datetime.now().strftime('%Y%m%d')}.pdf"
    att.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(att)

    with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
        server.login(smtp_user, smtp_pass)
        server.sendmail(email_from, to_email, msg.as_string())

def _generate_backup_zip() -> tuple:
    buf = io.BytesIO()
    stats: dict = {"jsons": [], "pdfs": [], "total_mb": 0.0}
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in ["users.json", "faq_data.json", "assistance_contacts.json", "quiver_links.json", "products.json", "services.json"]:
            p = DATA_DIR / fname
            if p.exists():
                zf.write(p, fname)
                stats["jsons"].append(fname)
        for folder, prefix in [(PDF_FOLDER, "pdfs"), (PRODUCTS_FOLDER, "products_pdfs"), (ESPECIAIS_FOLDER, "especiais")]:
            if folder.exists():
                for pdf in sorted(folder.glob("*.pdf")):
                    zf.write(pdf, f"{prefix}/{pdf.name}")
                    stats["pdfs"].append(pdf.name)
    data = buf.getvalue()
    stats["total_mb"] = round(len(data) / 1024 / 1024, 2)
    return data, stats


def _send_backup_email(zip_bytes: bytes, stats: dict) -> None:
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    email_from = os.getenv("EMAIL_FROM", smtp_user)
    backup_to = os.getenv("BACKUP_EMAIL", email_from)

    if not smtp_host or not smtp_user or not smtp_pass:
        print("[backup] SMTP não configurado — backup por e-mail ignorado.")
        return

    msg = MIMEMultipart("mixed")
    msg["From"] = f"Piazinho Backup <{email_from}>"
    msg["To"] = backup_to
    msg["Subject"] = f"Backup Piazinho - {datetime.now().strftime('%d/%m/%Y')}"

    html = (
        f"<html><body style='font-family:Arial,sans-serif;color:#111;line-height:1.6'>"
        f"<h3 style='color:#00213A'>Backup automático do Piazinho</h3>"
        f"<p>Data: <strong>{datetime.now().strftime('%d/%m/%Y às %H:%M')}</strong></p>"
        f"<ul>"
        f"<li>Arquivos de dados (JSON): {len(stats['jsons'])}</li>"
        f"<li>PDFs indexados: {len(stats['pdfs'])}</li>"
        f"<li>Tamanho total: <strong>{stats['total_mb']} MB</strong></li>"
        f"</ul>"
        f"<p>Guarde o arquivo <em>backup-piazinho.zip</em> em local seguro.</p>"
        f"<p style='color:#888;font-size:12px'>Para restaurar, acesse o painel admin e use o botão Restaurar Backup.</p>"
        f"</body></html>"
    )
    msg.attach(MIMEText(html, "html", "utf-8"))

    att = MIMEBase("application", "zip")
    att.set_payload(zip_bytes)
    encoders.encode_base64(att)
    filename = f"backup-piazinho-{datetime.now().strftime('%Y%m%d')}.zip"
    att.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(att)

    with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
        server.login(smtp_user, smtp_pass)
        server.sendmail(email_from, backup_to, msg.as_string())
    print(f"[backup] E-mail enviado para {backup_to} ({stats['total_mb']} MB)")


def _run_daily_backup():
    brt = timezone(timedelta(hours=-3))
    while True:
        try:
            now = datetime.now(brt)
            next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            wait = (next_midnight - now).total_seconds()
            print(f"[backup] Próximo backup em {round(wait / 3600, 1)}h (meia-noite BRT)")
            time.sleep(wait)
            zip_bytes, stats = _generate_backup_zip()
            _send_backup_email(zip_bytes, stats)
        except Exception as e:
            print(f"[backup] Erro: {e}")
            time.sleep(3600)


PDF_WATCH_INTERVAL_SECONDS = 120


def _watch_pdf_folder():
    while True:
        try:
            updated = sync_index()
            if updated:
                print(f"[auto-index] {len(updated)} PDFs indexados: {updated}")
                invalidate_collection_cache()
        except Exception as e:
            print(f"[auto-index] Erro ao verificar pasta de PDFs: {e}")
        time.sleep(PDF_WATCH_INTERVAL_SECONDS)


def _load_products() -> list:
    if not PRODUCTS_JSON_PATH.exists():
        return []
    return json.loads(PRODUCTS_JSON_PATH.read_text(encoding="utf-8"))


def _save_products(data: list) -> None:
    PRODUCTS_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    PRODUCTS_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_services() -> list:
    if not SERVICES_JSON_PATH.exists():
        return []
    return json.loads(SERVICES_JSON_PATH.read_text(encoding="utf-8"))


def _save_services(data: list) -> None:
    SERVICES_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    SERVICES_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _download_pdf(url: str) -> bytes:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/pdf,application/octet-stream,*/*;q=0.9",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    req = _urllib.Request(url, headers=headers)
    try:
        with _urllib.urlopen(req, timeout=30) as resp:
            ct = resp.headers.get("Content-Type", "")
            data = resp.read()
    except Exception as e:
        raise ValueError(f"Falha ao baixar PDF: {e}")
    if "pdf" not in ct.lower() and not url.lower().split("?")[0].endswith(".pdf"):
        if data[:4] != b"%PDF":
            raise ValueError(f"URL não retornou um PDF válido (Content-Type: {ct})")
    return data


def _index_file_background(folder, filename, pdf_bytes):
    folder.mkdir(parents=True, exist_ok=True)
    (folder / filename).write_bytes(pdf_bytes)
    sync_index()
    invalidate_collection_cache()


def _check_disk_health() -> dict:
    from insurers import DATA_DIR
    import shutil
    persistent = str(DATA_DIR) == "/data"
    writable = False
    free_mb = 0
    try:
        test_file = DATA_DIR / ".write_test"
        test_file.write_text("ok")
        test_file.unlink()
        writable = True
    except Exception:
        pass
    try:
        free_mb = round(shutil.disk_usage(str(DATA_DIR)).free / 1024 / 1024)
    except Exception:
        pass
    return {"data_dir": str(DATA_DIR), "persistent": persistent, "writable": writable, "free_mb": free_mb}


def _startup_disk_check():
    health = _check_disk_health()
    if health["persistent"] and health["writable"]:
        print(f"[disco] ✓ Disco persistente em /data — {health['free_mb']} MB livres")
        return
    # Disco não está correto — envia alerta por e-mail
    print(f"[disco] ⚠️  ALERTA: DATA_DIR={health['data_dir']} — dados NÃO persistirão entre deploys!")
    try:
        smtp_host = os.getenv("SMTP_HOST", "")
        smtp_port = int(os.getenv("SMTP_PORT", "465"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASS", "")
        email_from = os.getenv("EMAIL_FROM", smtp_user)
        if not smtp_host or not smtp_user:
            return
        msg = MIMEMultipart("mixed")
        msg["From"] = f"Piazinho Alerta <{email_from}>"
        msg["To"] = email_from
        msg["Subject"] = f"⚠️ ALERTA: Disco Piazinho não configurado — {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        html = (
            f"<html><body style='font-family:Arial,sans-serif;color:#111'>"
            f"<h2 style='color:#dc2626'>⚠️ ATENÇÃO: dados em risco!</h2>"
            f"<p>O serviço Piazinho iniciou sem o disco persistente configurado corretamente.</p>"
            f"<ul>"
            f"<li><strong>DATA_DIR atual:</strong> {health['data_dir']}</li>"
            f"<li><strong>Esperado:</strong> /data</li>"
            f"<li><strong>Gravável:</strong> {'Sim' if health['writable'] else 'Não'}</li>"
            f"</ul>"
            f"<p style='color:#dc2626'><strong>Todos os dados cadastrados serão perdidos no próximo deploy!</strong></p>"
            f"<p>Acesse o Render Dashboard → serviço piaseg-app → Disks e verifique se o disco piaseg-data está montado em /data.</p>"
            f"</body></html>"
        )
        msg.attach(MIMEText(html, "html", "utf-8"))
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(email_from, email_from, msg.as_string())
        print("[disco] Alerta enviado por e-mail.")
    except Exception as e:
        print(f"[disco] Falha ao enviar alerta: {e}")


@app.on_event("startup")
def on_startup():
    for folder in (PDF_FOLDER, ESPECIAIS_FOLDER, PRODUCTS_FOLDER, SERVICES_FOLDER):
        try:
            folder.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"[startup] Aviso: não foi possível criar pasta ({folder}): {e}")
    _startup_disk_check()
    # Se o banco está vazio, limpa o manifest para forçar re-indexação completa
    try:
        conn = get_db()
        count = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        conn.close()
        if count == 0:
            print("[startup] Banco vazio detectado — forçando re-indexação completa.")
            from insurers import save_manifest
            save_manifest({})
    except Exception as e:
        print(f"[startup] Erro ao checar banco: {e}")
    # Watcher começa imediatamente (primeira indexação ocorre assim que o serviço sobe)
    threading.Thread(target=_watch_pdf_folder, daemon=True).start()
    threading.Thread(target=_run_daily_backup, daemon=True).start()


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
    source_filter: str = ""  # filename direto (pdoc_*.pdf) — quando o frontend já sabe qual doc usar
    category: str = ""  # categoria FAQ selecionada pelo usuário no chat


class FaqEntry(BaseModel):
    insurer: str
    question: str
    answer: str
    category: str = ""


class UserCreate(BaseModel):
    username: str
    name: str
    password: str
    is_admin: bool = False


class AssistanceContact(BaseModel):
    name: str
    phone: str
    whatsapp: str = ""


class QuiverLink(BaseModel):
    name: str
    url: str


class ConversationMessage(BaseModel):
    role: str
    content: str


class SendEmailRequest(BaseModel):
    messages: List[ConversationMessage]


@app.post("/auth/login")
def login(body: LoginRequest):
    user = authenticate(body.username, body.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha incorretos")
    token = create_token(user["username"], user["name"], user.get("is_admin", False))
    return {"token": token, "name": user["name"], "is_admin": user.get("is_admin", False), "username": user["username"]}


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

    # Usa source_filter passado diretamente pelo frontend OU detecta pelo texto
    source_filter = body.source_filter.strip() or detect_insurer(question)

    # 3. Sempre responde — com ou sem filtro de seguradora
    # (rag_answer já faz fallback global se source_filter não tiver chunks)
    insurer_display = get_insurer_display_name(source_filter) if source_filter else None
    faq_category = body.category.strip() or None
    try:
        result = rag_answer(question, source_filter=source_filter or None, insurer_display=insurer_display, category=faq_category)
    except Exception as e:
        print(f"[chat] Erro no rag_answer: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {type(e).__name__}: {str(e)[:200]}")
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
    safe_name = os.path.basename(file.filename or "")
    ext = os.path.splitext(safe_name)[1].lower()
    if not safe_name or ext not in OFFICE_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Formato não suportado. Use PDF, Word, Excel ou PowerPoint.")
    ESPECIAIS_FOLDER.mkdir(parents=True, exist_ok=True)
    dest = os.path.join(str(ESPECIAIS_FOLDER), safe_name)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    print(f"[especiais] arquivo salvo: {dest} ({len(content)} bytes)")
    background_tasks.add_task(_index_and_invalidate)
    return {
        "filename": safe_name,
        "message": "Arquivo especial salvo. A indexação está sendo processada em background.",
    }


@app.get("/admin/especiais")
def list_especiais(user: dict = Depends(require_admin)):
    folder = str(ESPECIAIS_FOLDER)
    if not os.path.isdir(folder):
        print(f"[especiais] pasta não existe: {folder}")
        return []
    try:
        all_entries = os.listdir(folder)
        print(f"[especiais] conteúdo da pasta: {all_entries}")
        result = [
            name for name in all_entries
            if os.path.isfile(os.path.join(folder, name))
            and os.path.splitext(name)[1].lower() in OFFICE_EXTENSIONS
        ]
        print(f"[especiais] arquivos filtrados: {result}")
        return sorted(result)
    except Exception as e:
        print(f"[especiais] erro ao listar: {e}")
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
    from insurers import _nfc as _nfc_fn
    conn = get_db()
    rows = conn.execute(
        "SELECT source, COUNT(*) as n FROM chunks GROUP BY source ORDER BY source"
    ).fetchall()
    conn.close()
    indexed = {r[0]: r[1] for r in rows}

    def _chunks_for(filename: str) -> int:
        return indexed.get(filename, 0) or indexed.get(_nfc_fn(filename), 0)

    cg_pdfs = []
    if PDF_FOLDER.exists():
        for p in sorted(PDF_FOLDER.glob("*.pdf")):
            c = _chunks_for(p.name)
            cg_pdfs.append({"file": p.name, "chunks": c, "indexed": c > 0})

    esp_pdfs = []
    if ESPECIAIS_FOLDER.exists():
        for p in sorted(
            f for f in ESPECIAIS_FOLDER.iterdir()
            if f.is_file() and f.suffix.lower() in OFFICE_EXTENSIONS
        ):
            c = _chunks_for(p.name)
            esp_pdfs.append({"file": p.name, "chunks": c, "indexed": c > 0})

    # Condições gerais de produtos e serviços (pdoc_*.pdf / sdoc_*.pdf)
    prod_docs = []
    for source_list, folder, doc_type in (
        (_load_products(), PRODUCTS_FOLDER, "Condição Geral"),
        (_load_services(), SERVICES_FOLDER, "Assistência"),
    ):
        for cat in source_list:
            for doc in cat.get("documents", []):
                fn = doc.get("filename", "")
                c = _chunks_for(fn)
                fpath = folder / fn if fn else None
                exists = fpath.exists() if fpath else False
                size_kb = round(fpath.stat().st_size / 1024) if exists else 0
                prod_docs.append({
                    "file": fn, "category": cat["name"],
                    "insurer": doc.get("name", ""), "chunks": c, "indexed": c > 0,
                    "file_exists": exists, "size_kb": size_kb,
                    "type": doc_type,
                })

    return {
        "condicoes_gerais": cg_pdfs,
        "especiais": esp_pdfs,
        "products": prod_docs,
        "total_chunks": sum(indexed.values()),
    }


@app.post("/admin/reindex")
def force_reindex(background_tasks: BackgroundTasks, user: dict = Depends(require_admin)):
    """Limpa o manifest e inicia re-indexação em background (evita timeout do Render)."""
    from insurers import save_manifest
    save_manifest({})
    background_tasks.add_task(_index_and_invalidate)
    return {"ok": True, "message": "iniciado"}


@app.get("/faq")
def list_faq_entries(user: dict = Depends(require_admin)):
    return load_faq()


@app.post("/faq")
def create_faq_entry(body: FaqEntry, user: dict = Depends(require_admin)):
    if not body.question.strip() or not body.answer.strip():
        raise HTTPException(status_code=400, detail="Pergunta e resposta não podem ser vazias")
    return add_faq_entry(body.insurer, body.question.strip(), body.answer.strip(), body.category)


@app.put("/faq/{faq_id}")
def edit_faq_entry(faq_id: str, body: FaqEntry, user: dict = Depends(require_admin)):
    updated = update_faq_entry(faq_id, body.insurer, body.question.strip(), body.answer.strip(), body.category)
    if not updated:
        raise HTTPException(status_code=404, detail="FAQ não encontrado")
    return updated


@app.delete("/faq/{faq_id}")
def remove_faq_entry(faq_id: str, user: dict = Depends(require_admin)):
    delete_faq_entry(faq_id)
    return {"ok": True}


class FaqCategory(BaseModel):
    name: str


@app.get("/admin/faq-categories")
def list_faq_categories(user: dict = Depends(require_admin)):
    return _load_faq_categories()


@app.post("/admin/faq-categories", status_code=201)
def create_faq_category(body: FaqCategory, user: dict = Depends(require_admin)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Nome não pode ser vazio")
    data = _load_faq_categories()
    cat_id = f"fcat_{uuid.uuid4().hex[:8]}"
    cat = {"id": cat_id, "name": body.name.strip()}
    data.append(cat)
    _save_faq_categories(data)
    return cat


@app.put("/admin/faq-categories/{cat_id}")
def rename_faq_category(cat_id: str, body: FaqCategory, user: dict = Depends(require_admin)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Nome não pode ser vazio")
    data = _load_faq_categories()
    for cat in data:
        if cat["id"] == cat_id:
            cat["name"] = body.name.strip()
            _save_faq_categories(data)
            return cat
    raise HTTPException(status_code=404, detail="Categoria não encontrada")


@app.delete("/admin/faq-categories/{cat_id}")
def delete_faq_category(cat_id: str, user: dict = Depends(require_admin)):
    data = _load_faq_categories()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    data = [c for c in data if c["id"] != cat_id]
    _save_faq_categories(data)
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


class UserUpdate(BaseModel):
    name: str
    password: str = ""
    is_admin: bool = False


@app.put("/admin/users/{username}")
def update_user_endpoint(username: str, body: UserUpdate, current_user: dict = Depends(require_admin)):
    if username == "admin" and not body.is_admin:
        raise HTTPException(status_code=400, detail="Não é possível remover permissão admin do usuário admin")
    updated = update_user(
        username,
        name=body.name.strip() or None,
        password=body.password or None,
        is_admin=body.is_admin,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return updated


@app.delete("/admin/users/{username}")
def delete_user_endpoint(username: str, current_user: dict = Depends(require_admin)):
    if username == "admin":
        raise HTTPException(status_code=400, detail="Não é possível remover o usuário admin")
    if not delete_user(username):
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"ok": True}


@app.get("/portfolio/items")
def portfolio_items(user: dict = Depends(get_current_user)):
    """Retorna os itens do portifólio extraídos dinamicamente do arquivo indexado."""
    from rag import find_portfolio_source
    from insurers import get_all_chunks
    source = find_portfolio_source()
    if not source:
        return {"items": [], "source": None}
    chunks = get_all_chunks(source)
    print(f"[portfolio/items] source={source!r} chunks={len(chunks)}")
    if not chunks:
        return {"items": [], "source": source}
    full_text = "\n".join(c["text"] for c in chunks)
    sample = [l.strip() for l in full_text.splitlines() if l.strip()][:5]
    print(f"[portfolio/items] primeiras linhas: {sample}")
    items = []
    seen = set()
    # Padrões aceitos (ordem de preferência):
    # "1. Ramo", "1) Ramo", "1: Ramo", "1 - Ramo", "1 – Ramo"  (separador obrigatório)
    # "(1) Ramo", "[1] Ramo"  (número entre parênteses/colchetes)
    # "001 | Ramo" (formato de tabela extraída)
    # "RAMO 001 - Texto"  (prefixo RAMO)
    _re_items = [
        re.compile(r'^[(\[]?(\d{1,4})[)\]]?\s*[.):\-–|]\s*(.+)'),    # formatos principais
        re.compile(r'^ramo\s+(\d{1,6})\s*[.\-–:]?\s*(.+)', re.IGNORECASE),  # "RAMO 001 Texto"
    ]
    for line in full_text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = None
        for pat in _re_items:
            m = pat.match(line)
            if m:
                break
        if m:
            label = m.group(2).strip()
            # Remove sufixos gerados pela extração de tabelas (ex: " | info extra")
            label = label.split(" | ")[0].strip()
            if not label:
                continue
            try:
                num = int(m.group(1))
            except ValueError:
                continue
            key = label.lower()[:30]
            if key not in seen:
                seen.add(key)
                items.append({"num": num, "label": label})
    items.sort(key=lambda x: x["num"])
    print(f"[portfolio/items] itens encontrados: {len(items)} | primeiros: {[i['label'] for i in items[:3]]}")
    return {"items": items, "source": source}


@app.get("/admin/portfolio-preview")
def portfolio_preview(user: dict = Depends(require_admin)):
    """Retorna diagnóstico completo: linhas brutas + itens que seriam exibidos no chat."""
    from rag import find_portfolio_source
    from insurers import get_all_chunks
    source = find_portfolio_source()
    if not source:
        return {"source": None, "lines": [], "items_found": 0, "items_preview": []}
    chunks = get_all_chunks(source)
    full_text = "\n".join(c["text"] for c in chunks)
    lines = [l for l in full_text.splitlines() if l.strip()][:80]

    # Roda o mesmo regex do /portfolio/items para mostrar o que está sendo capturado
    _re_diag = [
        re.compile(r'^[(\[]?(\d{1,4})[)\]]?\s*[.):\-–|]\s*(.+)'),
        re.compile(r'^ramo\s+(\d{1,6})\s*[.\-–:]?\s*(.+)', re.IGNORECASE),
    ]
    items_d, seen_d = [], set()
    for raw in full_text.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        for pat in _re_diag:
            m = pat.match(raw)
            if m:
                lbl = m.group(2).strip().split(" | ")[0].strip()
                if lbl and lbl.lower()[:30] not in seen_d:
                    seen_d.add(lbl.lower()[:30])
                    try:
                        items_d.append({"num": int(m.group(1)), "label": lbl})
                    except ValueError:
                        pass
                break
    items_d.sort(key=lambda x: x["num"])
    return {
        "source": source,
        "total_chunks": len(chunks),
        "lines": lines,
        "items_found": len(items_d),
        "items_preview": items_d[:10],
    }


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


@app.put("/admin/assistance/{contact_id}")
def update_assistance(contact_id: str, body: AssistanceContact, user: dict = Depends(require_admin)):
    data = _load_assistance()
    for i, c in enumerate(data):
        if c["id"] == contact_id:
            data[i] = {**c, "name": body.name.strip(), "phone": body.phone.strip(), "whatsapp": body.whatsapp.strip()}
            _save_assistance(data)
            return data[i]
    raise HTTPException(status_code=404, detail="Contato não encontrado")


@app.delete("/admin/assistance/{contact_id}")
def delete_assistance(contact_id: str, user: dict = Depends(require_admin)):
    data = _load_assistance()
    new_data = [c for c in data if c["id"] != contact_id]
    if len(new_data) == len(data):
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    _save_assistance(new_data)
    return {"ok": True}


@app.get("/quiver")
def list_quiver(user: dict = Depends(get_current_user)):
    return _load_quiver()


@app.post("/admin/quiver", status_code=201)
def create_quiver(body: QuiverLink, user: dict = Depends(require_admin)):
    if not body.name.strip() or not body.url.strip():
        raise HTTPException(status_code=400, detail="Nome e URL são obrigatórios")
    data = _load_quiver()
    entry = {"id": f"qvr_{uuid.uuid4().hex[:8]}", "name": body.name.strip(), "url": body.url.strip()}
    data.append(entry)
    _save_quiver(data)
    return entry


@app.put("/admin/quiver/{link_id}")
def update_quiver(link_id: str, body: QuiverLink, user: dict = Depends(require_admin)):
    data = _load_quiver()
    for i, lnk in enumerate(data):
        if lnk["id"] == link_id:
            data[i] = {**lnk, "name": body.name.strip(), "url": body.url.strip()}
            _save_quiver(data)
            return data[i]
    raise HTTPException(status_code=404, detail="Link não encontrado")


@app.delete("/admin/quiver/{link_id}")
def delete_quiver(link_id: str, user: dict = Depends(require_admin)):
    data = _load_quiver()
    new_data = [lnk for lnk in data if lnk["id"] != link_id]
    if len(new_data) == len(data):
        raise HTTPException(status_code=404, detail="Link não encontrado")
    _save_quiver(new_data)
    return {"ok": True}


@app.post("/chat/send-email")
def send_conversation_email(body: SendEmailRequest, user: dict = Depends(get_current_user)):
    user_email = user["sub"]
    user_name = user["name"]
    if "@" not in user_email:
        raise HTTPException(status_code=400, detail="Este usuário não tem e-mail cadastrado.")
    try:
        pdf_bytes = _generate_pdf(body.messages, user_name)
        _send_email_pdf(user_email, user_name, pdf_bytes)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar e-mail: {str(e)}")


class CategoryCreate(BaseModel):
    name: str


class DocumentFromUrl(BaseModel):
    name: str
    url: str


class DocumentUpdate(BaseModel):
    name: str
    url: str


# ── PRODUTOS ──────────────────────────────────────────────────────────────────

@app.get("/products")
def list_products(user: dict = Depends(get_current_user)):
    return _load_products()


@app.post("/admin/products/categories", status_code=201)
def create_product_category(body: CategoryCreate, user: dict = Depends(require_admin)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Nome é obrigatório")
    data = _load_products()
    entry = {"id": f"pcat_{uuid.uuid4().hex[:8]}", "name": body.name.strip(), "documents": []}
    data.append(entry)
    _save_products(data)
    return entry


@app.put("/admin/products/categories/{cat_id}")
def rename_product_category(cat_id: str, body: CategoryCreate, user: dict = Depends(require_admin)):
    data = _load_products()
    for cat in data:
        if cat["id"] == cat_id:
            cat["name"] = body.name.strip()
            _save_products(data)
            return cat
    raise HTTPException(status_code=404, detail="Categoria não encontrada")


@app.delete("/admin/products/categories/{cat_id}")
def delete_product_category(cat_id: str, bg: BackgroundTasks, user: dict = Depends(require_admin)):
    data = _load_products()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    for doc in cat.get("documents", []):
        bg.add_task(delete_product_pdf, doc["filename"])
    _save_products([c for c in data if c["id"] != cat_id])
    return {"ok": True}


@app.post("/admin/products/{cat_id}/documents", status_code=201)
def add_product_document(cat_id: str, body: DocumentFromUrl, bg: BackgroundTasks, user: dict = Depends(require_admin)):
    data = _load_products()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    try:
        pdf_bytes = _download_pdf(body.url.strip())
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Falha ao baixar PDF: {e}")
    doc_id = f"pdoc_{uuid.uuid4().hex[:8]}"
    filename = f"{doc_id}.pdf"
    bg.add_task(_index_file_background, PRODUCTS_FOLDER, filename, pdf_bytes)
    doc = {"id": doc_id, "name": body.name.strip(), "source_url": body.url.strip(), "filename": filename, "status": "ok"}
    cat["documents"].append(doc)
    _save_products(data)
    return doc


@app.post("/admin/products/{cat_id}/documents/upload", status_code=201)
async def upload_product_document(cat_id: str, name: str, bg: BackgroundTasks, file: UploadFile = File(...), user: dict = Depends(require_admin)):
    data = _load_products()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in OFFICE_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Formato não suportado. Use PDF, Word, Excel ou PowerPoint.")
    file_bytes = await file.read()
    if ext == ".pdf" and file_bytes[:4] != b"%PDF":
        raise HTTPException(status_code=422, detail="Arquivo não é um PDF válido")
    doc_id = f"pdoc_{uuid.uuid4().hex[:8]}"
    filename = f"{doc_id}{ext}"
    PRODUCTS_FOLDER.mkdir(parents=True, exist_ok=True)
    (PRODUCTS_FOLDER / filename).write_bytes(file_bytes)
    doc = {"id": doc_id, "name": name.strip(), "source_url": "", "filename": filename, "status": "ok"}
    cat["documents"].append(doc)
    _save_products(data)
    bg.add_task(_index_file_background, PRODUCTS_FOLDER, filename, file_bytes)
    return doc


@app.put("/admin/products/{cat_id}/documents/{doc_id}")
def update_product_document(cat_id: str, doc_id: str, body: DocumentUpdate, user: dict = Depends(require_admin)):
    data = _load_products()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    for doc in cat["documents"]:
        if doc["id"] == doc_id:
            doc["name"] = body.name.strip()
            doc["source_url"] = body.url.strip()
            _save_products(data)
            return doc
    raise HTTPException(status_code=404, detail="Documento não encontrado")


@app.delete("/admin/products/{cat_id}/documents/{doc_id}")
def delete_product_document(cat_id: str, doc_id: str, bg: BackgroundTasks, user: dict = Depends(require_admin)):
    data = _load_products()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    doc = next((d for d in cat["documents"] if d["id"] == doc_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    bg.add_task(delete_product_pdf, doc["filename"])
    cat["documents"] = [d for d in cat["documents"] if d["id"] != doc_id]
    _save_products(data)
    return {"ok": True}


# ── SERVIÇOS 24HS ─────────────────────────────────────────────────────────────

@app.get("/services")
def list_services(user: dict = Depends(get_current_user)):
    return _load_services()


@app.post("/admin/services/categories", status_code=201)
def create_service_category(body: CategoryCreate, user: dict = Depends(require_admin)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Nome é obrigatório")
    data = _load_services()
    entry = {"id": f"scat_{uuid.uuid4().hex[:8]}", "name": body.name.strip(), "documents": []}
    data.append(entry)
    _save_services(data)
    return entry


@app.put("/admin/services/categories/{cat_id}")
def rename_service_category(cat_id: str, body: CategoryCreate, user: dict = Depends(require_admin)):
    data = _load_services()
    for cat in data:
        if cat["id"] == cat_id:
            cat["name"] = body.name.strip()
            _save_services(data)
            return cat
    raise HTTPException(status_code=404, detail="Categoria não encontrada")


@app.delete("/admin/services/categories/{cat_id}")
def delete_service_category(cat_id: str, bg: BackgroundTasks, user: dict = Depends(require_admin)):
    data = _load_services()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    for doc in cat.get("documents", []):
        bg.add_task(delete_service_pdf, doc["filename"])
    _save_services([c for c in data if c["id"] != cat_id])
    return {"ok": True}


@app.post("/admin/services/{cat_id}/documents/upload", status_code=201)
async def upload_service_document(cat_id: str, name: str, bg: BackgroundTasks, file: UploadFile = File(...), user: dict = Depends(require_admin)):
    data = _load_services()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in OFFICE_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Formato não suportado. Use PDF, Word, Excel ou PowerPoint.")
    file_bytes = await file.read()
    if ext == ".pdf" and file_bytes[:4] != b"%PDF":
        raise HTTPException(status_code=422, detail="Arquivo não é um PDF válido")
    doc_id = f"sdoc_{uuid.uuid4().hex[:8]}"
    filename = f"{doc_id}{ext}"
    SERVICES_FOLDER.mkdir(parents=True, exist_ok=True)
    (SERVICES_FOLDER / filename).write_bytes(file_bytes)
    doc = {"id": doc_id, "name": name.strip(), "source_url": "", "filename": filename, "status": "ok"}
    cat["documents"].append(doc)
    _save_services(data)
    bg.add_task(_index_file_background, SERVICES_FOLDER, filename, file_bytes)
    return doc


@app.post("/admin/services/{cat_id}/documents", status_code=201)
def add_service_document(cat_id: str, body: DocumentFromUrl, bg: BackgroundTasks, user: dict = Depends(require_admin)):
    data = _load_services()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    try:
        pdf_bytes = _download_pdf(body.url.strip())
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Falha ao baixar PDF: {e}")
    doc_id = f"sdoc_{uuid.uuid4().hex[:8]}"
    filename = f"{doc_id}.pdf"
    bg.add_task(_index_file_background, SERVICES_FOLDER, filename, pdf_bytes)
    doc = {"id": doc_id, "name": body.name.strip(), "source_url": body.url.strip(), "filename": filename, "status": "ok"}
    cat["documents"].append(doc)
    _save_services(data)
    return doc


@app.put("/admin/services/{cat_id}/documents/{doc_id}")
def update_service_document(cat_id: str, doc_id: str, body: DocumentUpdate, user: dict = Depends(require_admin)):
    data = _load_services()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    for doc in cat["documents"]:
        if doc["id"] == doc_id:
            doc["name"] = body.name.strip()
            doc["source_url"] = body.url.strip()
            _save_services(data)
            return doc
    raise HTTPException(status_code=404, detail="Documento não encontrado")


@app.delete("/admin/services/{cat_id}/documents/{doc_id}")
def delete_service_document(cat_id: str, doc_id: str, bg: BackgroundTasks, user: dict = Depends(require_admin)):
    data = _load_services()
    cat = next((c for c in data if c["id"] == cat_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    doc = next((d for d in cat["documents"] if d["id"] == doc_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    bg.add_task(delete_service_pdf, doc["filename"])
    cat["documents"] = [d for d in cat["documents"] if d["id"] != doc_id]
    _save_services(data)
    return {"ok": True}


@app.get("/admin/disk-status")
def disk_status(user: dict = Depends(require_admin)):
    return _check_disk_health()


@app.get("/admin/backup")
def download_backup(user: dict = Depends(require_admin)):
    zip_bytes, stats = _generate_backup_zip()
    filename = f"backup-piazinho-{datetime.now().strftime('%Y%m%d-%H%M')}.zip"
    print(f"[backup] Download manual: {stats['total_mb']} MB por {user.get('sub')}")
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/admin/diag")
def diag(user: dict = Depends(require_admin)):
    import os
    from insurers import DATA_DIR, PDF_FOLDER, PRODUCTS_FOLDER, ESPECIAIS_FOLDER
    files_in_data = []
    try:
        files_in_data = os.listdir(str(DATA_DIR))
    except Exception as e:
        files_in_data = [f"ERRO: {e}"]
    products_json_exists = (DATA_DIR / "products.json").exists()
    products_json_content = ""
    if products_json_exists:
        try:
            products_json_content = (DATA_DIR / "products.json").read_text()[:200]
        except Exception as e:
            products_json_content = f"ERRO: {e}"
    return {
        "data_dir": str(DATA_DIR),
        "pdf_folder": str(PDF_FOLDER),
        "products_folder": str(PRODUCTS_FOLDER),
        "especiais_folder": str(ESPECIAIS_FOLDER),
        "files_in_data": files_in_data,
        "products_json_exists": products_json_exists,
        "products_json_preview": products_json_content,
    }


@app.get("/health")
def health():
    return {"status": "ok", "version": "backup-automatico"}

@app.get("/admin/db-sources")
def db_sources(user: dict = Depends(require_admin)):
    conn = get_db()
    rows = conn.execute("SELECT source, COUNT(*) as n FROM chunks GROUP BY source ORDER BY n DESC LIMIT 50").fetchall()
    conn.close()
    return [{"source": r[0], "chunks": r[1]} for r in rows]

@app.get("/test-html", response_class=Response)
def test_html():
    return Response(content="<html><body><h1>HTML funcionando!</h1><p>Se você ver isso, HTML carrega normalmente.</p></body></html>", media_type="text/html")


# Servir o frontend Next.js estático em /piazinho/
_STATIC_PIAZINHO = os.path.join(os.path.dirname(__file__), "static_piazinho")
if os.path.isdir(_STATIC_PIAZINHO):
    app.mount("/piazinho", StaticFiles(directory=_STATIC_PIAZINHO, html=True), name="piazinho")

