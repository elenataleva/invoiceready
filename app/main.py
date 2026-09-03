from fastapi import FastAPI

app = FastAPI(title="InvoiceReady")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
