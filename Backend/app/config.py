import os

class Settings:
    DB_URL = os.getenv(
        "DB_URL",
        "mysql+pymysql://root:root@localhost:3306/dltaller_app"
    )
    APP_TITLE = os.getenv("APP_TITLE", "GlutenFree API")
    APP_VERSION = os.getenv("APP_VERSION", "0.1.0")

settings = Settings()
