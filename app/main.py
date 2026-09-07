from fastapi import FastAPI

from app.routers import ask

app = FastAPI(title="InvoiceReady")
app.include_router(ask.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
