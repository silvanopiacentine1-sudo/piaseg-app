import json
import os
import re
import uuid
from pathlib import Path
from typing import Optional

import anthropic

from insurers import DATA_DIR, discover_insurers, find_portfolio_source, search_chunks

FAQ_JSON_PATH = DATA_DIR / "faq_data.json"

PORTFOLIO_FILENAME = "Portifólio de Produtos.pdf"

SYSTEM_PROMPT = """Você é o Piazinho, assistente virtual especialista em seguros da Piaseg Seguros Franchising.
Responda as dúvidas dos franqueados com base APENAS no contexto fornecido (Perguntas Frequentes e Condições Gerais).
Se houver uma resposta no bloco "Perguntas Frequentes Piaseg", priorize-a — ela é uma resposta oficial validada pela equipe da Piaseg.
Se não houver, use as Condições Gerais da seguradora.
Seja amigável, acolhedor e use um tom leve e próximo, como um colega de trabalho prestativo — mas sem perder a objetividade e a precisão técnica.
Cite a seguradora quando relevante e use linguagem simples, evitando jargões desnecessários.
Pode usar emojis com moderação para deixar a conversa mais leve.
Se a informação não estiver em nenhum dos dois contextos, informe de forma gentil que não encontrou nos documentos disponíveis e sugira contato com o suporte interno da Piaseg.
Responda sempre em português brasileiro."""

PORTFOLIO_SYSTEM_PROMPT = """Você é o Piazinho, assistente virtual da Piaseg Seguros Franchising.
Com base no Portifólio de Produtos fornecido, responda diretamente quais seguradoras aceitam o produto perguntado.

Regras de formato:
- NÃO use saudação (não escreva "Olá", "Oi", apresentação ou introdução de nenhum tipo)
- Liste cada seguradora em uma linha separada com asterisco: * Nome da Seguradora
- Após a lista, se houver observações ou restrições no portifólio, inclua-as em texto simples
- Não use títulos com # nem linhas horizontais
- Se não encontrar o produto, informe gentilmente sem saudação

Responda sempre em português brasileiro."""

_PORTFOLIO_STOPWORDS = {
    "onde", "quais", "quem", "aceitação", "aceita", "seguradoras", "seguradora",
    "seguro", "seguros", "para", "com", "que", "tem", "uma", "uns", "umas",
    "qual", "trabalha", "trabalham", "faz", "fazem", "sobre", "tipo", "ramo",
    "saber", "lista", "listar", "dizer", "quero", "duvida", "dúvida", "informação",
}

_PORTFOLIO_PATTERNS = [
    r'onde tem aceita',
    r'quais seguradoras',
    r'quem aceita',
    r'aceitação para',
    r'aceita.*seguro',
    r'quem faz seguro',
    r'quais faz',
    r'portif[oó]lio',
    r'quem trabalha com',
    r'quais trabalham',
    r'que seguradoras',
]


def detect_portfolio_query(text: str) -> bool:
    text_lower = text.lower()
    return any(re.search(p, text_lower) for p in _PORTFOLIO_PATTERNS)


def answer_portfolio(question: str) -> dict:
    # Localiza o arquivo de portifólio dinamicamente (ignora variações de nome)
    portfolio_source = find_portfolio_source() or PORTFOLIO_FILENAME

    text_clean = re.sub(r'[^\w\s]', ' ', question.lower(), flags=re.UNICODE)
    terms = [w for w in text_clean.split() if w not in _PORTFOLIO_STOPWORDS and len(w) >= 2]

    chunks = []
    if terms:
        fts_query = " OR ".join(terms)
        chunks = search_chunks(fts_query, source_filter=portfolio_source, top_k=6)

    if not chunks:
        return {
            "answer": "Não encontrei esse produto no Portifólio de Produtos. Verifique se o arquivo foi enviado no painel admin ou entre em contato com o suporte interno da Piaseg. 🙏",
            "sources": [],
        }

    cg_block = "\n\n---\n\n".join([f"[Pág. {c['page']}]\n{c['text']}" for c in chunks])
    context = f"### Portifólio de Produtos Piaseg\n\n{cg_block}"

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=PORTFOLIO_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"{context}\n\nPergunta: {question}"}],
    )
    return {
        "answer": response.content[0].text,
        "sources": [{"source": c["source"], "page": c["page"]} for c in chunks],
    }


def detect_insurer(text: str) -> Optional[str]:
    text_lower = text.lower()
    candidates = []
    for filename, display in discover_insurers().items():
        keywords = {display.lower()}
        keywords.update(w.lower() for w in display.split() if len(w) > 2)
        for kw in keywords:
            if kw in text_lower:
                candidates.append((len(kw), filename))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]


def get_insurer_options() -> list:
    return list(discover_insurers().values())


def get_insurer_display_name(filename: str) -> Optional[str]:
    return discover_insurers().get(filename)


def invalidate_collection_cache():
    pass  # Sem cache de coleção com SQLite FTS5


def load_faq() -> list:
    if not FAQ_JSON_PATH.exists():
        return []
    return json.loads(FAQ_JSON_PATH.read_text(encoding="utf-8"))


def save_faq(data: list) -> None:
    FAQ_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    FAQ_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def add_faq_entry(insurer: str, question: str, answer_text: str) -> dict:
    faq_id = f"faq_{uuid.uuid4().hex[:8]}"
    entry = {"id": faq_id, "insurer": insurer, "question": question, "answer": answer_text}
    data = load_faq()
    data.append(entry)
    save_faq(data)
    return entry


def delete_faq_entry(faq_id: str) -> None:
    data = [e for e in load_faq() if e["id"] != faq_id]
    save_faq(data)


def search_faq(question: str, insurer_display: Optional[str] = None, n: int = 3) -> list:
    data = load_faq()
    if insurer_display:
        data = [e for e in data if e["insurer"] in (insurer_display, "Todas")]
    question_words = set(re.findall(r'\w+', question.lower()))
    scored = []
    for entry in data:
        faq_words = set(re.findall(r'\w+', entry["question"].lower()))
        score = len(question_words & faq_words)
        if score > 0:
            scored.append((score, entry))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [e for _, e in scored[:n]]


def answer(question: str, source_filter: Optional[str] = None, insurer_display: Optional[str] = None) -> dict:
    chunks = search_chunks(question, source_filter=source_filter)
    faqs = search_faq(question, insurer_display=insurer_display)

    faq_block = "\n\n".join([f"P: {f['question']}\nR: {f['answer']}" for f in faqs])
    cg_block = "\n\n---\n\n".join([
        f"[{c['source']} — Pág. {c['page']}]\n{c['text']}"
        for c in chunks
    ])

    context_parts = []
    if faq_block:
        context_parts.append(f"### Perguntas Frequentes Piaseg (respostas oficiais)\n\n{faq_block}")
    context_parts.append(f"### Condições Gerais da Seguradora\n\n{cg_block}")
    context = "\n\n".join(context_parts)

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"{context}\n\nPergunta: {question}"}],
    )
    return {
        "answer": response.content[0].text,
        "sources": [{"source": c["source"], "page": c["page"]} for c in chunks],
    }
