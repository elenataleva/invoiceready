from sentence_transformers import SentenceTransformer

_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


def embed(text: str) -> list[float]:
    return _model.encode(text).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    return _model.encode(texts).tolist()
