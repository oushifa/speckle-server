FROM python:3.13-slim-bookworm AS build
RUN python -m venv /app && /app/bin/pip install --upgrade pip
COPY ./packages/skp-import-service /src
WORKDIR /src
RUN /app/bin/pip install .

FROM python:3.13-slim-bookworm

ENV PATH=/app/bin:$PATH

STOPSIGNAL SIGINT

RUN groupadd -r app && useradd -r -d /app -g app -N app
COPY --from=build --chown=app:app /app /app
COPY --chown=app:app ./packages/skp-import-service/main.py /app
COPY --chown=app:app ./packages/skp-import-service/job_processor.py /app
USER app
WORKDIR /app

ENTRYPOINT []

CMD ["python", "main.py"]
