from pydantic import BaseModel


class AskRequest(BaseModel):
    country: str
    question: str


class AskResponse(BaseModel):
    answer: str
    citations: list[str]
    refused: bool
