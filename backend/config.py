from pydantic_settings import BaseSettings, SettingsConfigDict
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

class Settings(BaseSettings):
    email_user: str
    email_pass: str
    
    # IA
    hf_token: str
    groq_token: str
    
    # Database (Ruta absoluta para evitar errores de "DB not found")
    db_path: str = os.path.join(BASE_DIR, "data", "surtidores.db")
    
    # Seguridad
    max_rows_simulation: int = 3000

    # Forzamos la ruta absoluta al archivo .env
    model_config = SettingsConfigDict(env_file=ENV_PATH)

settings = Settings()