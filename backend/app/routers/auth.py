from fastapi import APIRouter, Depends, HTTPException, status
import secrets

from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBasic()
settings = get_settings()


def admin_auth(credentials: HTTPBasicCredentials = Depends(security)):
    valid_username = secrets.compare_digest(credentials.username, settings.admin_username)
    valid_password = secrets.compare_digest(credentials.password, settings.admin_password)
    if not (valid_username and valid_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


@router.post("/login")
def login(credentials: HTTPBasicCredentials = Depends(security)):
    if not secrets.compare_digest(credentials.username, settings.admin_username) or not secrets.compare_digest(credentials.password, settings.admin_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {"message": "Authenticated", "username": credentials.username}
