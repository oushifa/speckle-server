# Debug Session: preview-token-401
- **Status**: [OPEN]
- **Issue**: preview-service loads object previews with a token that reaches `/objects/:streamId/:objectId/single` and gets `401 Unauthorized` for private projects such as `models_lib`.
- **Debug Server**: not started
- **Log File**: not started

## Reproduction Steps
1. Trigger a preview job for a private project object, e.g. `models_lib/03219cd6f9625dea3136f4e1766b384c`.
2. preview-service opens `/streams/:streamId/objects/:objectId` in preview-frontend.
3. Viewer requests `/objects/:streamId/:objectId/single`.
4. Server returns `401 Unauthorized`, and preview result is written back as `error`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Preview token uses server admin, but admin override is disabled so private project access still requires project ACL | High | Low | Confirmed by `authorizeResolverFactory()` gating admin bypass on `adminOverrideEnabled()` |
| B | `models_lib` upload flow grants uploader access, but preview execution flow does not grant access to the chosen preview user | High | Low | Confirmed by comparing `modelLibrary.ts`/`modelLibraryUploads.ts` with preview services |
| C | Token scope is valid; failure happens specifically at stream role authorization on `/objects/:streamId/:objectId/single` | High | Low | Confirmed by preview-service log + `validatePermissionsReadStream()` |
| D | Preview execution user selection always prefers server admin and never falls back to a collaborator who already has access | High | Low | Confirmed by previous `createObjectPreview.ts`/`retryErrors.ts` logic |

## Log Evidence
- User-provided preview-service log shows `Failed to load resource: the server responded with a status of 401 (Unauthorized)` for `/objects/models_lib/03219cd6f9625dea3136f4e1766b384c/single`.
- `packages/server/modules/core/services/streams/auth.ts` requires both `Scopes.Streams.Read` and `authorizeResolver(... Roles.Stream.Reviewer ...)`.
- `packages/server/modules/shared/services/auth.ts` only grants blanket server-admin access when `ADMIN_OVERRIDE_ENABLED=true`.
- `packages/server/modules/previews/services/createObjectPreview.ts` and `retryErrors.ts` previously always chose the first server admin when present.

## Verification Conclusion
- Root cause: preview token selection preferred server admin unconditionally, but private project reads still require project ACL when admin override is disabled. This caused preview-service object downloads to fail with `401`.
- Fix in progress: select server admin only when that user can actually read the target stream; otherwise fall back to an existing project owner/collaborator.
