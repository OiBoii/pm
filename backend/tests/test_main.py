from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_serves_static_html_page() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<html" in response.text.lower()


def test_api_hello_response() -> None:
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {
        "message": "hello from fastapi",
        "status": "ok",
    }
