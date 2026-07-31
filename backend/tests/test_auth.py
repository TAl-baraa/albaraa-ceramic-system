from fastapi.testclient import TestClient
from app.main import app

def test_health_and_root_are_public():
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
        assert client.get("/api/health").status_code == 200

def test_business_api_requires_authentication():
    with TestClient(app) as client:
        response=client.get("/api/products")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "not_authenticated"

def test_login_session_csrf_and_logout(client:TestClient):
    assert client.get("/api/auth/me").json()=={"username":"test-admin"}
    assert client.get("/api/products").status_code==200
    token=client.headers.pop("X-CSRF-Token")
    assert client.post("/api/products",json={}).status_code==403
    client.headers["X-CSRF-Token"]=token
    response=client.post("/api/auth/logout")
    assert response.status_code==204
    assert client.get("/api/auth/me").status_code==401

def test_invalid_credentials_are_generic():
    with TestClient(app) as client:
        first=client.post("/api/auth/login",json={"username":"wrong","password":"wrong"})
        assert first.status_code==401
        assert first.json()["error"]["message"]=="Invalid username or password"
