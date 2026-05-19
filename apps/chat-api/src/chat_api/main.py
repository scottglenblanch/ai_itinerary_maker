from typing import TypedDict

from fastapi import FastAPI
from pydantic import BaseModel

from chat_api.services.ai_service import AIService


class ChatRequest(BaseModel):
    username: str
    message: str


class ChatResponse(BaseModel):
    response: str
    ics_payload_json: str | None = None


class ChatHistoryRequest(BaseModel):
    username: str


class ChatHistoryItem(TypedDict):
    question: str
    answer: str


class ChatHistoryResponse(BaseModel):
    history: list[ChatHistoryItem]


app = FastAPI(title="chat-api")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "chat-api is running"}


@app.post("/api/v1/chat/ask", response_model=ChatResponse, status_code=200)
def make_chat_call(body: ChatRequest) -> ChatResponse:
    ai_result = AIService().get_ai_response(body.username, body.message)
    return ChatResponse(
        response=ai_result["response"],
        ics_payload_json=ai_result["ics_payload_json"],
    )


@app.post("/api/v1/chat/history", response_model=ChatHistoryResponse, status_code=200)
def get_chat_history(body: ChatHistoryRequest) -> ChatHistoryResponse:
    chat_history = AIService().get_chat_history(body.username)
    return ChatHistoryResponse(history=chat_history)


@app.get("/api/v1/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
