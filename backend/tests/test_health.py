from fastapi.testclient import TestClient


def test_root_reports_running(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "name": "Al-Baraa Ceramic Management API",
        "status": "running",
    }


def test_health_reports_database_connected(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "database": "connected"}
