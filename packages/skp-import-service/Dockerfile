FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /src

COPY ./packages/skp-import-service /src

RUN uv sync --frozen --no-dev --no-install-project

WORKDIR /app

RUN useradd -m app
USER app

COPY --chown=app:app ./packages/skp-import-service/main.py /app
COPY --chown=app:app ./packages/skp-import-service/job_processor.py /app

ENV PATH="/src/.venv/bin:$PATH"

ENTRYPOINT ["python", "main.py"]
