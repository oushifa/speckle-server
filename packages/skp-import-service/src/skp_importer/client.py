import requests
from specklepy.core.api.client import (
    SpeckleClient,  # pyright: ignore[reportMissingTypeStubs]
)

from skp_importer.domain import FileimportPayload


def setup_client(job_payload: FileimportPayload) -> SpeckleClient:
    speckle_client = SpeckleClient(
        job_payload.server_url,
        job_payload.server_url.startswith("https"),
    )
    speckle_client.authenticate_with_token(job_payload.token)
    if not speckle_client.account:
        msg = (
            f"Could not authenticate to {job_payload.server_url}",
            "with the provided token",
        )
        raise ValueError(msg)

    if not speckle_client.account.userInfo.email:
        raise ValueError(
            "activeUser.email did not get fetched. Does the token lack profile:email?"
        )

    return speckle_client


def update_progress(
    *,
    server_url: str,
    token: str,
    project_id: str,
    job_id: str,
    progress_percent: int | None,
    progress_phase: str | None,
    progress_message: str | None,
) -> None:
    graphql_url = f"{server_url.rstrip('/')}/graphql"
    query = """
      mutation UpdateFileImportProgress($input: UpdateFileImportProgressInput!) {
        fileUploadMutations {
          updateFileImportProgress(input: $input)
        }
      }
    """
    variables = {
        "input": {
            "projectId": project_id,
            "jobId": job_id,
            "progressPercent": progress_percent,
            "progressPhase": progress_phase,
            "progressMessage": progress_message,
        }
    }
    try:
        res = requests.post(
            graphql_url,
            json={"query": query, "variables": variables},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        res.raise_for_status()
    except Exception as ex:
        # Non-critical, just log to stderr
        print(f"Failed to report progress: {ex}")


def create_version(
    *,
    server_url: str,
    token: str,
    project_id: str,
    model_id: str,
    object_id: str,
    message: str,
    source_application: str = "sketchup",
) -> str:
    graphql_url = f"{server_url.rstrip('/')}/graphql"
    query = """
      mutation CreateVersion($input: CreateVersionInput!) {
        versionMutations {
          create(input: $input) {
            id
          }
        }
      }
    """
    variables = {
        "input": {
            "projectId": project_id,
            "modelId": model_id,
            "objectId": object_id,
            "message": message,
            "sourceApplication": source_application,
        }
    }
    res = requests.post(
        graphql_url,
        json={"query": query, "variables": variables},
        headers={"Authorization": f"Bearer {token}"},
        timeout=300,
    )
    res.raise_for_status()
    payload = res.json()
    errors = payload.get("errors")
    if errors:
        raise ValueError(errors[0].get("message") or "CreateVersion failed")
    version_id = (
        payload.get("data", {}).get("versionMutations", {}).get("create", {}).get("id")
    )
    if not version_id:
        raise ValueError("CreateVersion did not return version id")
    return version_id
