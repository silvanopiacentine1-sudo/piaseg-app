import json
import os
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Optional

import anthropic
import chromadb
from chromadb.utils import embedding_functions

from insurers import DATA_DIR, DB_PATH, discover_insurers

FAQ_JSON_PATH = DATA_DIR / "faq_data.json"

SYSTEM_PROMPT = """Você é o Piazinho, assistente virtual especialista em seguros de automóvel da Piaseg Seguros Franchising.
Responda as dúvidas dos franqueados com base APENAS no contexto fornecido (Perguntas Frequentes e Condições Gerais).
Se houver uma resposta no bloco "Perguntas Frequentes Piaseg", priorize-a — ela é uma resposta oficial validada pela equipe da Piaseg.
Se não houver, use as Condições Gerais da seguradora.
Seja amigável, acolhedor e use um tom leve e próximo, como um colega de trabalho prestativo — mas sem perder a objetividade e a precisão técnica.
Cite a seguradora quando relevante e use linguagem simples, evitando jargões desnecessários.
Pode usar emojis com moderação para deixar a conversa mais leve.
Se a informação não estiver em nenhum dos dois contextos, informe de forma gentil que não encontrou nos documentos disponíveis e sugira contato com o suporte interno da Piaseg.
Responda sempre em português brasileiro."""


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


@lru_cache(maxsize=1)
def get_collection():
    client = chromadb.PersistentClient(path=DB_PATH)
    ef = embedding_functions.DefaultEmbeddingFunction()
    return client.get_collection("seguros", embedding_function=ef)


@lru_cache(maxsize=1)
def get_faq_collection():
    client = chromadb.PersistentClient(path=DB_PATH)
    ef = embedding_functions.DefaultEmbeddingFunction()
    return client.get_or_create_collection("faq", embedding_function=ef)


def invalidate_collection_cache():
    get_collection.cache_clear()
    get_faq_collection.cache_clear()


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

    collection = get_faq_collection()
    collection.add(
        documents=[f"Pergunta: {question}\nResposta: {answer_text}"],
        metadatas=[{"insurer": insurer, "question": question, "answer": answer_text}],
        ids=[faq_id],
    )
    return entry


def delete_faq_entry(faq_id: str) -> None:
    data = [e for e in load_faq() if e["id"] != faq_id]
    save_faq(data)
    collection = get_faq_collection()
    try:
        collection.delete(ids=[faq_id])
    except Exception:
        pass


def search(question: str, n: int = 5, source_filter: Optional[str] = None) -> list:
    collection = get_collection()
    query_kwargs = {"query_texts": [question], "n_results": n}
    if source_filter:
        query_kwargs["where"] = {"source": source_filter}
    results = collection.query(**query_kwargs)
    chunks = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        chunks.append({
            "text": doc,
            "source": meta.get("source", "?"),
            "page": meta.get("page", "?"),
        })
    return chunks


def search_faq(question: str, insurer_display: Optional[str] = None, n: int = 3) -> list:
    collection = get_faq_collection()
    if collection is None or collection.count() == 0:
        return []
    query_kwargs = {"query_texts": [question], "n_results": min(n, collection.count())}
    if insurer_display:
        query_kwargs["where"] = {"insurer": {"$in": [insurer_display, "Todas"]}}
    results = collection.query(**query_kwargs)
    faqs = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        faqs.append({
            "question": meta.get("question", "?"),
            "answer": meta.get("answer", "?"),
            "insurer": meta.get("insurer", "?"),
        })
    return faqs


def answer(question: str, source_filter: Optional[str] = None, insurer_display: Optional[str] = None) -> dict:
    chunks = search(question, source_filter=source_filter)
    faqs = search_faq(question, insurer_display=insurer_display)

    faq_block = "\n\n".join([
        f"P: {f['question']}\nR: {f['answer']}"
        for f in faqs
    ])
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
        messages=[{
            "role": "user",
            "content": f"{context}\n\nPergunta: {question}",
        }],
    )
    return {
        "answer": response.content[0].text,
        "sources": [{"source": c["source"], "page": c["page"]} for c in chunks],
    }
