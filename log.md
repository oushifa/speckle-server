2026-03-03 00:00 - wrap speckleifc.main.open_and_convert_file in ifc_importer/process_job.py to handle missing model_id keyword argument.
2026-03-03 00:01 - update wrapper and process_job to provide model_ingestion_id (mapped from blob_id) and stay backward-compatible with older speckleifc signatures.
2026-03-03 00:03 - simplify process_job: remove local wrapper, import open_and_convert_file directly from speckleifc.main and call it with model_ingestion_id instead of model_id (mapped from job.model_id).
