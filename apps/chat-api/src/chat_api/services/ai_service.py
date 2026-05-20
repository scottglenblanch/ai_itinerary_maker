import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any, TypedDict

from openai import OpenAI
from redis import Redis

from chat_api.services.configuration_service import ConfigurationService


class ChatResult(TypedDict):
    response: str
    ics_payload_json: str | None


class AIService:
    """Service layer for API status-related responses."""

    ai_client = None
    cache_client = None
    env_service = ConfigurationService()
    chat_history: dict[str, list[dict[str, str]]] = {}

    def __init__(self):
        self.init_ai_client()
        self.init_cache_client()

    def get_ai_response(self, username: str, message: str) -> ChatResult:
        system_prompt_request = {
            "role": "system",
            "content": self.env_service.get_ai_system_prompt(),
        }

        user_message_request = {
            "role": "user",
            "content": message,
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
        ics_payload_json: str | None = None

        if choice_message.tool_calls:
            message_content, ics_payload_json = self._process_tool_calls(
                ai_model=ai_model,
                username=username,
                messages_request=messages_request,
                choice_message=choice_message,
            )
        else:
            message_content = choice_message.content or ""
            if self._should_force_calendar_generation(message, message_content):
                forced_content, forced_ics_payload_json = self._force_calendar_generation(
                    ai_model=ai_model,
                    username=username,
                    base_messages=messages_request,
                    assistant_message=message_content,
                )
                if forced_ics_payload_json:
                    ics_payload_json = forced_ics_payload_json
                    message_content = forced_content or message_content

        self._append_chat_history(username, message, message_content)

        return {
            "response": message_content,
            "ics_payload_json": ics_payload_json,
        }

    def _process_tool_calls(
        self,
        ai_model: str,
        username: str,
        messages_request: list[dict[str, Any]],
        choice_message: Any,
    ) -> tuple[str, str | None]:
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

        ics_payload_json: str | None = None
        for tool_call in choice_message.tool_calls:
            tool_result = self._run_tool_call(tool_call, username)
            if isinstance(tool_result, dict) and tool_result.get("ics_payload_json"):
                ics_payload_json = str(tool_result["ics_payload_json"])

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
        return message_content, ics_payload_json

    def _force_calendar_generation(
        self,
        ai_model: str,
        username: str,
        base_messages: list[dict[str, Any]],
        assistant_message: str,
    ) -> tuple[str, str | None]:
        messages_request = [
            *base_messages,
            {"role": "assistant", "content": assistant_message},
            {
                "role": "user",
                "content": "Extract confirmed itinerary events from this conversation and call generate_ics_payload_json now. Include at least one event only if specific details are known.",
            },
        ]

        forced_response = self.ai_client.chat.completions.create(
            model=ai_model,
            messages=messages_request,
            tools=self._get_tool_definitions(),
            tool_choice={"type": "function", "function": {"name": "generate_ics_payload_json"}},
        )

        forced_choice_message = forced_response.choices[0].message
        if not forced_choice_message.tool_calls:
            return assistant_message, None

        return self._process_tool_calls(
            ai_model=ai_model,
            username=username,
            messages_request=messages_request,
            choice_message=forced_choice_message,
        )

    def _should_force_calendar_generation(self, user_message: str, assistant_message: str) -> bool:
        combined = f"{user_message} {assistant_message}".lower()
        calendar_keywords = [
            "add",
            "itinerary",
            "plan",
            "schedule",
            "calendar",
            "event",
            "book",
            "day",
            "trip",
        ]
        return any(keyword in combined for keyword in calendar_keywords)

    def _get_tool_definitions(self) -> list[dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "generate_ics_payload_json",
                    "description": "Generate an ICS-ready JSON string from itinerary events.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "calendar_name": {
                                "type": "string",
                                "description": "Display name for the calendar.",
                            },
                            "filename": {
                                "type": "string",
                                "description": "Base file name to use when creating an ICS file.",
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
                                        "end": {"type": "string"},
                                        "all_day": {"type": "boolean"},
                                        "location": {"type": "string"},
                                        "description": {"type": "string"},
                                        "cost": {
                                            "type": "number",
                                            "description": "Estimated cost in USD for this event (optional).",
                                        },
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

        if function_name == "generate_ics_payload_json":
            return self._tool_generate_ics_payload_json(arguments, username)

        return {"ok": False, "error": f"Unknown tool: {function_name}"}

    def _tool_generate_ics_payload_json(self, arguments: dict[str, Any], username: str) -> dict[str, Any]:
        calendar_name = str(arguments.get("calendar_name") or "Trip Itinerary")
        requested_filename = str(arguments.get("filename") or f"{username}-itinerary")
        events = arguments.get("events")

        if not isinstance(events, list) or len(events) == 0:
            return {"ok": False, "error": "At least one event is required to generate ICS payload JSON."}

        try:
            payload_json = self._create_ics_payload_json(calendar_name, requested_filename, events)
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}
        except Exception:
            return {"ok": False, "error": "Failed to generate ICS payload JSON."}

        file_name = f"{self._sanitize_filename(requested_filename)}.ics"

        return {
            "ok": True,
            "file_name": file_name,
            "ics_payload_json": payload_json,
            "event_count": len(events),
        }

    def _create_ics_payload_json(self, calendar_name: str, requested_filename: str, events: list[Any]) -> str:
        normalized_events: list[dict[str, Any]] = []

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
            cost = raw_event.get("cost")
            if cost is not None:
                cost = float(cost) if isinstance(cost, (int, float)) else 0

            if all_day:
                start_date = self._parse_iso_date(start_raw)
                if isinstance(end_raw, str) and end_raw.strip():
                    end_date = self._parse_iso_date(end_raw)
                else:
                    end_date = start_date

                event_data = {
                    "title": title,
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "all_day": True,
                    "location": location,
                    "description": description,
                }
                if cost is not None:
                    event_data["cost"] = cost
                normalized_events.append(event_data)
                continue

            start_dt = self._parse_iso_datetime(start_raw)
            if isinstance(end_raw, str) and end_raw.strip():
                end_dt = self._parse_iso_datetime(end_raw)
            else:
                end_dt = start_dt + timedelta(hours=1)

            event_data = {
                "title": title,
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "all_day": False,
                "location": location,
                "description": description,
            }
            if cost is not None:
                event_data["cost"] = cost
            normalized_events.append(event_data)

        payload = {
            "calendar_name": calendar_name,
            "filename": f"{self._sanitize_filename(requested_filename)}.ics",
            "events": normalized_events,
        }

        return json.dumps(payload)

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

    def _append_chat_history(self, username: str, question: str, answer: str) -> None:
        chat_object = {
            "username": username.strip(),
            "question": question,
            "answer": answer,
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
