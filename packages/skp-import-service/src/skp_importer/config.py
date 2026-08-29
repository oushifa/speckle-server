"""
Configuration module for the SketchUp (SKP) Importer.
"""

import typed_settings as ts
from dotenv import load_dotenv

_ = load_dotenv()


@ts.settings
class Settings:
    fileimport_queue_postgres_url: ts.SecretStr = ts.SecretStr()
    skp_importer_healthcheck_port: int = 9082
    skp_importer_metrics_port: int = 9095


settings = ts.load(
    cls=Settings,
    appname="",
    config_files=[],
    env_prefix="",
)
