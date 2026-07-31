from collections.abc import Generator
from unittest.mock import Mock

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.main import app


def override_get_db() -> Generator[Mock, None, None]:
    session = Mock(spec=Session)
    yield session


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_root_reports_running() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "name": "Al-Baraa Ceramic Management API",
        "status": "running",
    }


def test_health_reports_database_connected() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "database": "connected"}
