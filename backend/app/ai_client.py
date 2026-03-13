import os
from typing import Any

import httpx

DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"


class AIConfigError(RuntimeError):
    pass


class AIRequestError(RuntimeError):
    pass


class OpenAIClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.base_url = (
            base_url or os.getenv("OPENAI_BASE_URL") or DEFAULT_OPENAI_BASE_URL
        ).rstrip("/")
        self.model = model or os.getenv("OPENAI_MODEL") or DEFAULT_OPENAI_MODEL

    def chat_completion(self, prompt: str) -> str:
        if not self.api_key:
            raise AIConfigError("Missing API key for OpenAI. Set OPENAI_API_KEY.")

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=20.0) as client:
                response = client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            raise AIRequestError(f"OpenAI request failed: {exc}") from exc

        if response.status_code >= 400:
            detail = response.text.strip()
            if response.status_code == 400 and "invalid model" in detail.lower():
                raise AIRequestError(
                    f"OpenAI rejected model '{self.model}'. Set OPENAI_MODEL to a valid model "
                    f"(for example: gpt-4.1-mini). Raw response: {detail}"
                )
            raise AIRequestError(f"OpenAI returned HTTP {response.status_code}: {detail}")

        return _extract_response_text(response.json())


def _extract_response_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise AIRequestError("OpenAI response missing choices.")

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise AIRequestError("OpenAI response has invalid choice format.")

    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise AIRequestError("OpenAI response missing message payload.")

    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()

    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    text_parts.append(text.strip())
        if text_parts:
            return " ".join(text_parts)

    raise AIRequestError("OpenAI response missing assistant text content.")
