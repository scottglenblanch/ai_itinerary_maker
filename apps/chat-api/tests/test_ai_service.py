import json

from chat_api.services.ai_service import AIService


def build_ai_service_without_clients() -> AIService:
    # Avoid initializing network clients in tests.
    return AIService.__new__(AIService)


def test_create_ics_payload_json_accepts_natural_language_datetimes() -> None:
    service = build_ai_service_without_clients()

    payload_json = service._create_ics_payload_json(
        calendar_name="Personal",
        requested_filename="birthday-party",
        events=[
            {
                "title": "Birthday Party",
                "start": "May 20th 4pm",
                "end": "11pm",
            }
        ],
    )

    payload = json.loads(payload_json)
    assert payload["calendar_name"] == "Personal"
    assert payload["filename"] == "birthday-party.ics"
    assert len(payload["events"]) == 1

    event = payload["events"][0]
    assert event["title"] == "Birthday Party"
    assert event["start"].endswith("+00:00")
    assert event["end"].endswith("+00:00")
    assert "T16:00:00" in event["start"]
    assert "T23:00:00" in event["end"]


def test_create_ics_payload_json_defaults_one_hour_when_end_missing() -> None:
    service = build_ai_service_without_clients()

    payload_json = service._create_ics_payload_json(
        calendar_name="Personal",
        requested_filename="quick-event",
        events=[
            {
                "title": "Quick Event",
                "start": "2026-05-20T09:30:00",
            }
        ],
    )

    payload = json.loads(payload_json)
    event = payload["events"][0]
    assert event["start"] == "2026-05-20T09:30:00+00:00"
    assert event["end"] == "2026-05-20T10:30:00+00:00"
