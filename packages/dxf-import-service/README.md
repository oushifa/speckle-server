# DXF Import Service

This package provides a minimal DXF importer worker that consumes `background_jobs` of type `FileImport` (payload `fileType=dxf`), converts DXF geometry into a Speckle object graph, creates a version on the target model and reports the result back to the server.

## How it works

1. Polls the Postgres database specified by `FILEIMPORT_QUEUE_POSTGRES_URL` for eligible jobs.
2. Downloads the DXF blob from the Speckle server using the job payload's `serverUrl/projectId/blobId/token`.
3. Parses DXF entities (MVP: `LINE`, `LWPOLYLINE`, `POLYLINE`) into Speckle geometry objects.
4. Uploads the object graph to the server (gets `objectId`).
5. Creates a Version on the job's `modelId`.
6. Calls `finishFileImport` to update `convertedStatus/convertedVersionId`.

## Dev setup

Copy `.env.example` to `.env` (or use `.env.hc-bim.example` if you're running the hc-bim docker-compose), then:

```bash
./run.sh
```

## Notes

- This is an MVP implementation intended to be iterated on. Geometry coverage is intentionally limited.
- Default ports: `DXF_IMPORTER_HEALTHCHECK_PORT=9081`, `DXF_IMPORTER_METRICS_PORT=9094`.
