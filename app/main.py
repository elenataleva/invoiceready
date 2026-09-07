from fastapi import FastAPI

from app.routers import ask, assess, pages

app = FastAPI(title="InvoiceReady")
app.include_router(ask.router)
app.include_router(assess.router)
app.include_router(pages.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
