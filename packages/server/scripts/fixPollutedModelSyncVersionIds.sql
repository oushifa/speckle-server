-- ============================================================================
-- 一次性数据订正：修复批量上传并发导致的模型同步数据污染
--
-- 背景：completeRvtConversionJob 曾经在转换成功后，按 streamId 把同项目内所有处于
-- Queued/Converting 且 convertedCommitId 为空的 file_uploads 统一置为 Completed，
-- 并写入当前任务的 versionId。批量上传时多个转换并发执行，先完成的那个文件会把其他
-- 仍在转换的上传一并「标记完成」并写入自己的 commitId，造成：
--   1. file_uploads.convertedCommitId 与 project_model_sync_tasks.versionId 被污染成同一个 commitId；
--   2. taskRunner 依据被污染的 versionId 回写 commit 的 seedId/assetId/assetName，多条任务相互覆盖，
--      最终只有一条 commit 拿到 seedId，其余模型的最新 commit 的 seedId 为空（前端模型列表显示无状态）。
--
-- 订正范围：仅处理「同一项目内多个任务共用同一个 versionId」这种可明确判定的污染分组，
-- 用每个任务自身保存的（正确的）seedId/assetId/assetName，回填到该模型最新 commit 上，
-- 同时修正 task.versionId 与关联 file_uploads.convertedCommitId。对健康数据均为 no-op。
--
-- 适用环境：单库（未开启 multiregion）的 docker 部署。若开启了 multiregion，
--          需要对每个区域库分别执行一次。
--
-- 用法：
--   预览（不修改任何数据，仅打印将受影响的模型）：
--     docker compose exec -T postgres psql -U speckle -d speckle \
--       < packages/server/scripts/fixPollutedModelSyncVersionIds.sql
--
--   正式执行（在事务中提交，失败整体回滚）：
--     docker compose exec -T postgres psql -U speckle -d speckle -v apply=1 \
--       < packages/server/scripts/fixPollutedModelSyncVersionIds.sql
-- ============================================================================

\set ON_ERROR_STOP on

-- 未显式传入 -v apply=1 时，默认为预览模式
\if :{?apply}
\else
  \set apply 0
\endif

-- 1. 污染分组：同一项目内多个任务共用同一个 versionId
DROP TABLE IF EXISTS tmp_polluted_groups;
CREATE TEMP TABLE tmp_polluted_groups AS
SELECT "projectId", "versionId"
FROM project_model_sync_tasks
WHERE "versionId" IS NOT NULL
GROUP BY "projectId", "versionId"
HAVING count(*) > 1;

-- 2. 订正目标：每个 (projectId, modelId) 取最新一条带中海信息的任务，并找到该模型最新 commit
DROP TABLE IF EXISTS tmp_corrections;
CREATE TEMP TABLE tmp_corrections AS
SELECT DISTINCT ON (t."projectId", t."modelId")
  t.id             AS "taskId",
  t."projectId"    AS "projectId",
  t."modelId"      AS "modelId",
  t."fileUploadId" AS "fileUploadId",
  t."versionId"    AS "pollutedVersionId",
  t."seedId"       AS "seedId",
  t."assetId"      AS "assetId",
  t."assetName"    AS "assetName",
  lc.id            AS "latestCommitId"
FROM project_model_sync_tasks t
JOIN tmp_polluted_groups g
  ON g."projectId" = t."projectId"
 AND g."versionId" = t."versionId"
JOIN LATERAL (
  SELECT c.id
  FROM branch_commits bc
  JOIN commits c ON c.id = bc."commitId"
  WHERE bc."branchId" = t."modelId"
  ORDER BY c."createdAt" DESC
  LIMIT 1
) lc ON true
WHERE t."seedId" IS NOT NULL
  AND t."assetId" IS NOT NULL
  AND t."assetName" IS NOT NULL
ORDER BY t."projectId", t."modelId", t."createdAt" DESC;

\echo ''
\echo '=== 受影响的模型（预览）==='
SELECT "projectId", "modelId", "pollutedVersionId", "latestCommitId",
       "seedId", "assetId", "assetName"
FROM tmp_corrections
ORDER BY "projectId", "modelId";

\if :apply

BEGIN;

-- 3. 用任务中正确的中海信息回填该模型最新 commit 的 seedId/assetId/assetName
UPDATE commits c
SET "seedId" = x."seedId",
    "assetId" = x."assetId",
    "assetName" = x."assetName"
FROM tmp_corrections x
WHERE c.id = x."latestCommitId"
  AND (c."seedId" IS DISTINCT FROM x."seedId"
    OR c."assetId" IS DISTINCT FROM x."assetId"
    OR c."assetName" IS DISTINCT FROM x."assetName");

-- 4. 修正任务自身被污染的 versionId
UPDATE project_model_sync_tasks t
SET "versionId" = x."latestCommitId",
    updater = 'datafix',
    "updatedAt" = now()
FROM tmp_corrections x
WHERE t.id = x."taskId"
  AND t."versionId" IS DISTINCT FROM x."latestCommitId";

-- 5. 修正关联上传记录中被污染的 convertedCommitId（仅当其当前值就是污染的 versionId）
UPDATE file_uploads fu
SET "convertedCommitId" = x."latestCommitId",
    "convertedLastUpdate" = now()
FROM tmp_corrections x
WHERE fu.id = x."fileUploadId"
  AND fu."convertedCommitId" = x."pollutedVersionId"
  AND x."latestCommitId" IS DISTINCT FROM x."pollutedVersionId";

COMMIT;

\echo ''
\echo '=== 订正完成 ==='

\else

\echo ''
\echo '=== 当前为预览模式，未修改任何数据。确认无误后加 -v apply=1 正式执行 ==='

\endif
