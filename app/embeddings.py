from fastembed import TextEmbedding

# The same model as before, run through ONNX instead of PyTorch.
#
# Why the swap (docs/04-FRONTEND-DESIGN.md #8.4): sentence-transformers
# pulls in torch, which costs ~340MB resident to do one thing per request -
# embed a single short query string. The whole app measured 463MB against
# Render's 512MB free tier, which OOMs under any real load. ONNX runs the
# identical weights in a fraction of that.
#
# Safe for data already in the database: the two runtimes produce the same
# vectors for the same text (verified at cosine 1.000000), so existing
# `rule_chunks` embeddings stay comparable to queries embedded here and the
# similarity threshold in app/retrieval.py keeps its meaning. Chunks are
# embedded offline by scripts/ingest.py either way; the deployed service
# only ever embeds one short question at a time.
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_model = TextEmbedding(model_name=MODEL_NAME)


def embed(text: str) -> list[float]:
    return embed_batch([text])[0]


def embed_batch(texts: list[str]) -> list[list[float]]:
    # fastembed returns a generator of numpy arrays, one per input, in order.
    return [vector.tolist() for vector in _model.embed(texts)]
