# SketchUp (SKP) Import Service

This package provides a SketchUp (`.skp`) importer worker that consumes `background_jobs` of type `FileImport` (payload `fileType=skp`), converts SketchUp geometry, groups, components and materials into a Speckle object graph, creates a version on the target model and reports the result and progress back to the server.

## How it works

1. Polls the Postgres database specified by `FILEIMPORT_QUEUE_POSTGRES_URL` for eligible `skp` jobs.
2. Downloads the SKP blob from the Speckle server using the job payload's `serverUrl/projectId/blobId/token`.
3. Parses SKP entities, faces/meshes, component instances, groups, and layers/tags into Speckle objects.
4. Uploads the Speckle object tree to the server.
5. Creates a Version on the job's `modelId`.
6. Reports multi-phase progress to `updateFileImportProgress` and completes via `finishFileImport`.

## Dev setup

Copy `.env.example` to `.env` (or use `.env.hc-bim.example` if running against `speckle_hc_bim`), then:

```bash
./run.sh
```

## Configuration

- `FILEIMPORT_QUEUE_POSTGRES_URL`: PostgreSQL connection string for background jobs queue.
- `SKP_IMPORTER_HEALTHCHECK_PORT`: Healthcheck HTTP server port (default: 9082).
- `SKP_IMPORTER_METRICS_PORT`: Prometheus metrics port (default: 9095).
