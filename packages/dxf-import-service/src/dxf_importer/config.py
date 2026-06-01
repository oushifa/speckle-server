"""
Configuration module for the DXF Importer.
"""

import typed_settings as ts
from dotenv import load_dotenv

_ = load_dotenv()


@ts.settings
class Settings:
    fileimport_queue_postgres_url: ts.SecretStr = ts.SecretStr()


settings = ts.load(
    cls=Settings,
    appname="",
    config_files=[],
    env_prefix="",
)

