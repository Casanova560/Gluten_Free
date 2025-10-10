
import os
from urllib.parse import quote_plus


class Settings:
    """Centraliza configuración de la aplicación."""

    # Default to PyMySQL, which is present in requirements.txt
    DB_DRIVER = os.getenv("DB_DRIVER", "mysql+pymysql")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "dltaller_app")
    DB_USER = os.getenv("DB_USER")
    DB_PASS = os.getenv("DB_PASS")

    def _build_db_url(self) -> str:
        # Permite sobrescribir con DB_URL directamente.
        explicit_url = os.getenv("DB_URL")
        if explicit_url:
            return explicit_url

        if self.DB_USER is None:
            raise RuntimeError("DB_USER environment variable is required when DB_URL is not set.")
        if self.DB_PASS is None:
            raise RuntimeError("DB_PASS environment variable is required when DB_URL is not set.")

        user = quote_plus(self.DB_USER or "")
        password = quote_plus(self.DB_PASS or "")
        host = self.DB_HOST
        port = self.DB_PORT
        name = self.DB_NAME

        auth = f"{user}" if password == "" else f"{user}:{password}"
        return f"{self.DB_DRIVER}://{auth}@{host}:{port}/{name}"

    DB_URL = property(lambda self: self._build_db_url())

    APP_TITLE = os.getenv("APP_TITLE", "GlutenFree API")
    APP_VERSION = os.getenv("APP_VERSION", "0.1.0")


settings = Settings()
