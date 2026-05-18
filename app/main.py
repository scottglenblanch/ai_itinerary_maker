from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
from typing import TypedDict
from app.services.ai_service import AIService

class ChatRequest(BaseModel):
    username: str
    message: str

class ChatResponse(BaseModel):
    response: str
    ics_download_url: str | None = None

class ChatHistoryRequest(BaseModel):
    username: str

class ChatHistoryItem(TypedDict):
    question: str
    answer: str

class ChatHistoryResponse(BaseModel):
    history: list[ChatHistoryItem]

app = FastAPI(title="Itinerary Maker API")

@app.get("/")
def chat_page() -> FileResponse:
    CHAT_PAGE_PATH = Path(__file__).with_name("chat.html")
    return FileResponse(CHAT_PAGE_PATH)


@app.post("/api/v1/chat/ask", response_model=ChatResponse, status_code=200)
def make_chat_call(body: ChatRequest) -> ChatResponse:
    username = body.username
    message = body.message
    ai_result = AIService().get_ai_response(username, message)
    return ChatResponse(response=ai_result["response"], ics_download_url=ai_result["ics_download_url"])


@app.get("/api/v1/chat/ics/{file_id}")
def download_ics_file(file_id: str) -> FileResponse:
    file_path = AIService.get_ics_file_path(file_id)
    if file_path is None or not file_path.exists():
        raise HTTPException(status_code=404, detail="ICS file not found")

    return FileResponse(file_path, media_type="text/calendar", filename=file_path.name)

@app.post("/api/v1/chat/history", response_model=ChatHistoryResponse, status_code=200)
def get_chat_history(body: ChatHistoryRequest) -> ChatHistoryResponse:
    username = body.username
    ai_service = AIService()
    chat_history = ai_service.get_chat_history(username)
    return ChatHistoryResponse(history=chat_history)


@app.get("/api/v1/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
