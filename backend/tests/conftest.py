import pytest
from fastapi.testclient import TestClient

from app.core.db import SessionLocal
from app.main import app

ADMIN_EMAIL = "paarth.sahni@infobeans.com"
APPROVER_EMAIL = "siddharth.sethi@infobeans.com"
EMPLOYEE_EMAIL = "test.@infobeans.com"


def headers(email: str) -> dict[str, str]:
    return {"X-Dev-User-Email": email}


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
