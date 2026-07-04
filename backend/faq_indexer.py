import csv
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

DB_PATH = str(Path(__file__).parent / "chroma_db")
FAQ_CSV = Path(__file__).parent / "faq.csv"


def run():
    if not FAQ_CSV.exists():
        print(f"Arquivo não encontrado: {FAQ_CSV}")
        return

    client = chromadb.PersistentClient(path=DB_PATH)
    try:
        client.delete_collection("faq")
    except Exception:
        pass

    ef = embedding_functions.DefaultEmbeddingFunction()
    collection = client.create_collection("faq", embedding_function=ef)

    with open(FAQ_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        print("Nenhuma linha encontrada no faq.csv")
        return

    documents = []
    metadatas = []
    ids = []
    for i, row in enumerate(rows):
        seguradora = row["seguradora"].strip()
        pergunta = row["pergunta"].strip()
        resposta = row["resposta"].strip()
        documents.append(f"Pergunta: {pergunta}\nResposta: {resposta}")
        metadatas.append({"insurer": seguradora, "question": pergunta, "answer": resposta})
        ids.append(f"faq_{i}")

    collection.add(documents=documents, metadatas=metadatas, ids=ids)
    print(f"Concluído! {len(rows)} perguntas do FAQ indexadas.")


if __name__ == "__main__":
    run()
