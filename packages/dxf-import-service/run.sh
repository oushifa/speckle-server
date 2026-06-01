#!/bin/sh
cd "$(dirname "$0")" || exit 1
uv sync --no-dev
uv run main.py
