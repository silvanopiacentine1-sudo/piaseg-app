import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("JWT_SECRET", "piaseg-secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_APP_DIR = Path(__file__).parent
_data_dir = Path(os.getenv("DATA_DIR", str(_APP_DIR)))
USERS_FILE = _data_dir / "users.json"
_BUNDLED_USERS_FILE = _APP_DIR / "users.json"


def load_users() -> list[dict]:
    if USERS_FILE.exists():
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    if _BUNDLED_USERS_FILE.exists():
        return json.loads(_BUNDLED_USERS_FILE.read_text(encoding="utf-8"))
    return []


def save_users(users: list[dict]) -> None:
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    USERS_FILE.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def authenticate(username: str, password: str) -> Optional[dict]:
    users = load_users()
    for u in users:
        if u["username"] == username and verify_password(password, u["password_hash"]):
            return u
    return None


def create_token(username: str, name: str, is_admin: bool = False) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": username, "name": name, "is_admin": is_admin, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def create_user(username: str, name: str, password: str, is_admin: bool = False) -> dict:
    users = load_users()
    if any(u["username"] == username for u in users):
        raise ValueError(f"Usuário '{username}' já existe")
    new_user = {
        "username": username,
        "name": name,
        "password_hash": hash_password(password),
        "is_admin": is_admin,
    }
    users.append(new_user)
    save_users(users)
    return {"username": username, "name": name, "is_admin": is_admin}


def delete_user(username: str) -> bool:
    users = load_users()
    filtered = [u for u in users if u["username"] != username]
    if len(filtered) == len(users):
        return False
    save_users(filtered)
    return True
