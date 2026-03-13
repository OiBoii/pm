from app.ai_client import AIConfigError, AIRequestError, OpenAIClient


def test_chat_completion_returns_text_from_openai_payload(monkeypatch) -> None:
    class StubResponse:
        status_code = 200
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "choices": [
                    {
                        "message": {
                            "content": "4",
                        }
                    }
                ]
            }

    class StubClient:
        def __init__(self, timeout: float) -> None:
            assert timeout == 20.0

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def post(self, url: str, json: dict, headers: dict) -> StubResponse:
            assert url.endswith("/chat/completions")
            assert json["model"] == "gpt-4.1-mini"
            assert headers["Authorization"] == "Bearer test-key"
            return StubResponse()

    monkeypatch.setattr("app.ai_client.httpx.Client", StubClient)

    client = OpenAIClient(api_key="test-key")
    assert client.chat_completion("2+2") == "4"


def test_chat_completion_raises_config_error_when_key_missing(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    client = OpenAIClient()

    try:
        client.chat_completion("2+2")
        assert False, "Expected AIConfigError"
    except AIConfigError:
        pass


def test_chat_completion_raises_request_error_on_bad_payload(monkeypatch) -> None:
    class StubResponse:
        status_code = 200
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {"choices": []}

    class StubClient:
        def __init__(self, timeout: float) -> None:
            _ = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def post(self, url: str, json: dict, headers: dict) -> StubResponse:
            _ = (url, json, headers)
            return StubResponse()

    monkeypatch.setattr("app.ai_client.httpx.Client", StubClient)

    client = OpenAIClient(api_key="test-key")

    try:
        client.chat_completion("2+2")
        assert False, "Expected AIRequestError"
    except AIRequestError:
        pass
