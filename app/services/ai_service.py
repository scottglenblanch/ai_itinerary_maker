import json
import re
import uuid
from pathlib import Path
from typing import Any, TypedDict
from openai import OpenAI
from redis import Redis
from app.services.configuration_service import ConfigurationService
from datetime import datetime, timedelta, timezone


class ChatResult(TypedDict):
    response: str
    ics_download_url: str | None

class AIService:
    """Service layer for API status-related responses."""

    ai_client = None
    cache_client = None
    env_service = ConfigurationService()
    chat_history: dict[str, list[dict[str, str]]] = {}
    ICS_DIR_NAME = "generated_ics"

    def __init__(self):
        self.init_ai_client()
        self.init_cache_client()


    def get_ai_response(self, username: str, message: str) -> ChatResult:
        system_prompt_request= {
            "role": "system",
            "content": self.env_service.get_ai_system_prompt()
        }

        user_message_request = {
            "role": "user",
            "content": message
        }

        ai_model = self.env_service.get("AI_MODEL")

        previous_history = self.get_chat_history(username)
        history_formatted = [
            history_message
            for history_item in previous_history
            for history_message in [
                {"role": "user", "content": history_item["question"]},
                {"role": "assistant", "content": history_item["answer"]},
            ]
        ]

        messages_request = [system_prompt_request, *history_formatted, user_message_request]

        ai_response = self.ai_client.chat.completions.create(
            model=ai_model,
            messages=messages_request,
            tools=self._get_tool_definitions(),
            tool_choice="auto",
        )

        choice_message = ai_response.choices[0].message
        ics_download_url: str | None = None

        if choice_message.tool_calls:
            assistant_tool_message = {
                "role": "assistant",
                "content": choice_message.content or "",
                "tool_calls": [
                    {
                        "id": tool_call.id,
                        "type": tool_call.type,
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                        },
                    }
                    for tool_call in choice_message.tool_calls
                ],
            }
            messages_request.append(assistant_tool_message)

            for tool_call in choice_message.tool_calls:
                tool_result = self._run_tool_call(tool_call, username)
                if isinstance(tool_result, dict) and tool_result.get("download_url"):
                    ics_download_url = str(tool_result["download_url"])

                messages_request.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(tool_result),
                    }
                )

            follow_up_response = self.ai_client.chat.completions.create(
                model=ai_model,
                messages=messages_request,
            )
            message_content = follow_up_response.choices[0].message.content or ""
        else:
            message_content = choice_message.content or ""

        self._append_chat_history(username, message, message_content)

        return {
            "response": message_content,
            "ics_download_url": ics_download_url,
        }

    def _get_tool_definitions(self) -> list[dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "create_ics_file",
                    "description": "Create an ICS calendar file from itinerary events and return a download URL.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "calendar_name": {
                                "type": "string",
                                "description": "Display name for the calendar.",
                            },
                            "filename": {
                                "type": "string",
                                "description": "Base file name to use for the ICS file.",
                            },
                            "events": {
                                "type": "array",
                                "description": "Calendar events that make up the itinerary.",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "title": {"type": "string"},
                                        "start": {
                                            "type": "string",
                                            "description": "ISO date or datetime (for example 2026-08-01 or 2026-08-01T09:00:00).",
                                        },
                                        "end": {
                                            "type": "string",
                                            "description": "ISO date or datetime.",
                                        },
                                        "all_day": {"type": "boolean"},
                                        "location": {"type": "string"},
                                        "description": {"type": "string"},
                                    },
                                    "required": ["title", "start"],
                                },
                            },
                        },
                        "required": ["calendar_name", "filename", "events"],
                    },
                },
            }
        ]

    def _run_tool_call(self, tool_call: Any, username: str) -> dict[str, Any]:
        if tool_call.type != "function":
            return {"ok": False, "error": "Unsupported tool call type."}

        function_name = tool_call.function.name
        try:
            arguments = json.loads(tool_call.function.arguments or "{}")
        except json.JSONDecodeError:
            return {"ok": False, "error": "Tool arguments were not valid JSON."}

        if function_name == "create_ics_file":
            return self._tool_create_ics_file(arguments, username)

        return {"ok": False, "error": f"Unknown tool: {function_name}"}

    def _tool_create_ics_file(self, arguments: dict[str, Any], username: str) -> dict[str, Any]:
        calendar_name = str(arguments.get("calendar_name") or "Trip Itinerary")
        requested_filename = str(arguments.get("filename") or f"{username}-itinerary")
        events = arguments.get("events")

        if not isinstance(events, list) or len(events) == 0:
            return {"ok": False, "error": "At least one event is required to create an ICS file."}

        try:
            file_id, file_name = self._create_ics_file(calendar_name, requested_filename, events)
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}
        except Exception:
            return {"ok": False, "error": "Failed to create ICS file."}

        return {
            "ok": True,
            "file_id": file_id,
            "file_name": file_name,
            "download_url": f"/api/v1/chat/ics/{file_id}",
            "event_count": len(events),
        }

    @classmethod
    def get_ics_directory(cls) -> Path:
        base_dir = Path(__file__).resolve().parents[2]
        output_dir = base_dir / cls.ICS_DIR_NAME
        output_dir.mkdir(parents=True, exist_ok=True)
        return output_dir

    @classmethod
    def get_ics_file_path(cls, file_id: str) -> Path | None:
        if not re.fullmatch(r"[A-Za-z0-9_-]+\.ics", file_id):
            return None

        candidate = (cls.get_ics_directory() / file_id).resolve()
        if cls.get_ics_directory().resolve() not in candidate.parents:
            return None

        return candidate

    def _create_ics_file(self, calendar_name: str, requested_filename: str, events: list[Any]) -> tuple[str, str]:
        safe_name = self._sanitize_filename(requested_filename)
        unique_suffix = uuid.uuid4().hex[:8]
        file_name = f"{safe_name}-{unique_suffix}.ics"
        output_path = self.get_ics_directory() / file_name

        lines: list[str] = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Itinerary Maker//EN",
            "CALSCALE:GREGORIAN",
            f"X-WR-CALNAME:{self._escape_ics_text(calendar_name)}",
        ]

        for raw_event in events:
            if not isinstance(raw_event, dict):
                raise ValueError("Each event must be an object.")

            title = str(raw_event.get("title") or "Itinerary Item")
            start_raw = raw_event.get("start")
            if not isinstance(start_raw, str) or not start_raw.strip():
                raise ValueError("Each event needs a valid start value.")

            end_raw = raw_event.get("end")
            all_day = bool(raw_event.get("all_day", False))
            location = str(raw_event.get("location") or "")
            description = str(raw_event.get("description") or "")

            lines.extend(
                self._build_ics_event_lines(
                    title=title,
                    start_raw=start_raw,
                    end_raw=end_raw if isinstance(end_raw, str) else None,
                    all_day=all_day,
                    location=location,
                    description=description,
                )
            )

        lines.append("END:VCALENDAR")

        output_path.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
        return file_name, file_name

    def _build_ics_event_lines(
        self,
        title: str,
        start_raw: str,
        end_raw: str | None,
        all_day: bool,
        location: str,
        description: str,
    ) -> list[str]:
        uid = f"{uuid.uuid4()}@itinerary-maker"
        dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

        event_lines = [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{dtstamp}",
            f"SUMMARY:{self._escape_ics_text(title)}",
        ]

        if all_day:
            start_date = self._parse_iso_date(start_raw)
            if end_raw:
                end_date = self._parse_iso_date(end_raw)
            else:
                end_date = start_date

            # ICS all-day DTEND is exclusive, so add one day.
            end_exclusive = end_date + timedelta(days=1)
            event_lines.append(f"DTSTART;VALUE=DATE:{start_date.strftime('%Y%m%d')}")
            event_lines.append(f"DTEND;VALUE=DATE:{end_exclusive.strftime('%Y%m%d')}")
        else:
            start_dt = self._parse_iso_datetime(start_raw)
            if end_raw:
                end_dt = self._parse_iso_datetime(end_raw)
            else:
                end_dt = start_dt + timedelta(hours=1)

            event_lines.append(f"DTSTART:{start_dt.strftime('%Y%m%dT%H%M%SZ')}")
            event_lines.append(f"DTEND:{end_dt.strftime('%Y%m%dT%H%M%SZ')}")

        if location:
            event_lines.append(f"LOCATION:{self._escape_ics_text(location)}")
        if description:
            event_lines.append(f"DESCRIPTION:{self._escape_ics_text(description)}")

        event_lines.append("END:VEVENT")
        return event_lines

    def _sanitize_filename(self, filename: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", filename.strip().lower())
        cleaned = cleaned.strip(".-")
        return cleaned or "itinerary"

    def _parse_iso_date(self, value: str) -> datetime.date:
        date_text = value.strip()
        if "T" in date_text:
            return self._parse_iso_datetime(date_text).date()

        try:
            return datetime.strptime(date_text, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError(f"Invalid date format: {value}") from exc

    def _parse_iso_datetime(self, value: str) -> datetime:
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"

        try:
            parsed = datetime.fromisoformat(text)
        except ValueError as exc:
            raise ValueError(f"Invalid datetime format: {value}") from exc

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            parsed = parsed.astimezone(timezone.utc)

        return parsed

    def _escape_ics_text(self, value: str) -> str:
        escaped = value.replace("\\", "\\\\")
        escaped = escaped.replace(";", "\\;")
        escaped = escaped.replace(",", "\\,")
        escaped = escaped.replace("\n", "\\n")
        return escaped

    def _append_chat_history(self, username: str, question: str, answer: str) -> None:
        chat_object = {
            "username": username.strip(),
            "question": question,
            "answer": answer,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if self.cache_client:
            try:
                history_raw = self.cache_client.hget("chat_history", username.strip())
                history = json.loads(history_raw) if history_raw else []
                if not isinstance(history, list):
                    history = []

                history.append(chat_object)
                self.cache_client.hset("chat_history", username.strip(), json.dumps(history))
                self.cache_client.expire("chat_history", self.cache_ttl_seconds)
                return
            except Exception:
                pass

        self.chat_history.setdefault(username.strip(), []).append(chat_object)

    def get_chat_history(self, username: str) -> list[dict[str, str]]:
        user_key = username.strip()

        if self.cache_client:
            try:
                history_raw = self.cache_client.hget("chat_history", user_key)
                history = json.loads(history_raw) if history_raw else []
                if not isinstance(history, list):
                    return []

                cleaned_history: list[dict[str, str]] = []
                for item in history:
                    if not isinstance(item, dict):
                        continue

                    item_username = item.get("username")
                    question = item.get("question")
                    answer = item.get("answer")

                    if not all(isinstance(value, str) for value in [item_username, question, answer]):
                        continue

                    cleaned_history.append(
                        {
                            "username": item_username,
                            "question": question,
                            "answer": answer,
                        }
                    )

                return cleaned_history
            except Exception:
                pass

        return self.chat_history.get(user_key, [])

    def init_ai_client(self):
        api_key = self.env_service.get("OPENAI_API_KEY")
        self.ai_client = OpenAI(api_key=api_key)

    def init_cache_client(self):
        redis_url = self.env_service.get_optional("REDIS_URL", "redis://localhost:6379/0")

        try:
            self.cache_ttl_seconds = int(self.env_service.get_optional("REDIS_CACHE_TTL_SECONDS", "3600"))
        except ValueError:
            self.cache_ttl_seconds = 3600

        try:
            self.cache_client = Redis.from_url(redis_url, decode_responses=True)
            self.cache_client.ping()
        except Exception:
            self.cache_client = None

    def _build_cache_key(self, username: str) -> str:
        return f"chat:{username.strip().lower()}"

    def _get_cached_response(self, cache_key: str) -> str | None:
        if not self.cache_client:
            return None

        try:
            return self.cache_client.get(cache_key)
        except Exception:
            return None

    def _set_cached_response(self, cache_key: str, response: str) -> None:
        if not self.cache_client:
            return

        try:
            self.cache_client.setex(cache_key, self.cache_ttl_seconds, response)
        except Exception:
            pass

