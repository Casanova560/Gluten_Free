"""Application package init.

Loads environment variables from the repository-level .env file so settings.Config
finds DB credentials even when running via `uvicorn` without an explicit --env-file.
"""

from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")
