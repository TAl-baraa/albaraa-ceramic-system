from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.core.config import get_settings
from pwdlib import PasswordHash


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    with session_factory() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    settings = get_settings()
    settings.ADMIN_USERNAME = "test-admin"
    settings.ADMIN_PASSWORD_HASH = PasswordHash.recommended().hash("test-password")
    settings.AUTH_SECRET_KEY = "test-secret-key-that-is-long-enough-for-tests"
    settings.AUTH_COOKIE_SECURE = False
    with TestClient(app) as test_client:
        login = test_client.post("/api/auth/login", json={"username": "test-admin", "password": "test-password"})
        assert login.status_code == 200
        csrf = test_client.get("/api/auth/csrf")
        assert csrf.status_code == 200
        test_client.headers["X-CSRF-Token"] = csrf.json()["csrfToken"]
        yield test_client
    app.dependency_overrides.clear()
