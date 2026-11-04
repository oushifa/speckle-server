/**
 * 订正历史上「从模型库导入」产生的残缺模型。
 *
 * 背景：早期导入走 /objects 列表接口逐页拷贝，受 depth 过滤影响只写入了几十个对象，
 * 但 root 对象的 __closure 依然声明了全部子孙对象。viewer 用 objectloader2 严格校验，
 * 缺对象就直接抛错，表现为模型一直加载不出来。
 *
 * 本脚本：
 *  1. 扫描所有模型（branch 的最新 commit 引用的 root 对象）；
 *  2. 对比 root.__closure 声明的对象数 与 目标项目里实际存在的对象数；
 *  3. 对缺失的模型，从「同 root 的完整副本」（优先模型库 models_lib）把缺的对象补齐。
 *
 * 用法（在 packages/server 下）：
 *   # 只扫描并打印报告，不写数据
 *   yarn tsx --import ./esmLoader.js ./scripts/backfillImportedModelObjects.ts --dry-run
 *   # 真正执行订正
 *   yarn tsx --import ./esmLoader.js ./scripts/backfillImportedModelObjects.ts
 *   # 可选：只处理某个项目 / 限制模型数量
 *   yarn tsx --import ./esmLoader.js ./scripts/backfillImportedModelObjects.ts --project=9721ad370f
 *   yarn tsx --import ./esmLoader.js ./scripts/backfillImportedModelObjects.ts --limit=50
 *
 * 说明：脚本基于「所有项目共用同一个数据库」的部署（单 region）。
 */
import type { Knex } from 'knex'
import { knex } from '@/db/knex'
import { Objects } from '@/modules/core/dbSchema'
import { logger } from '@/observability/logging'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import { copyObjectsBetweenProjectsFactory } from '@/modules/core/services/streams/modelLibraryImport'
import { MODEL_LIBRARY_PROJECT_ID } from '@/modules/core/constants/modelLibrary'

type ModelRow = {
  streamId: string
  modelId: string
  name: string
  referencedObject: string
}

const getArgValue = (name: string) => {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}
const hasFlag = (flag: string) => process.argv.includes(flag)

/**
 * root 声明的子对象数 vs. 目标项目里实际存在的子对象数。
 * hasRoot 为 false 表示 root 对象本身在目标项目里就缺失。
 */
const getClosureStats = async (
  db: Knex,
  streamId: string,
  rootObjectId: string
): Promise<{ hasRoot: boolean; expected: number; actual: number }> => {
  const { rows } = await db.raw<{
    rows: Array<{ hasRoot: boolean; expected: number; actual: number }>
  }>(
    `
    WITH closure AS (
      SELECT d.key AS id
      FROM objects r
      JOIN jsonb_each_text(r.data->'__closure') d ON true
      WHERE r."streamId" = ? AND r.id = ?
    )
    SELECT
      EXISTS(SELECT 1 FROM objects r WHERE r."streamId" = ? AND r.id = ?) AS "hasRoot",
      (SELECT count(*)::int FROM closure) AS expected,
      (SELECT count(*)::int FROM objects o JOIN closure k ON o.id = k.id WHERE o."streamId" = ?) AS actual
    `,
    [streamId, rootObjectId, streamId, rootObjectId, streamId]
  )
  return rows[0] ?? { hasRoot: false, expected: 0, actual: 0 }
}

/** 目标项目里缺失的子对象 id */
const getMissingObjectIds = async (
  db: Knex,
  streamId: string,
  rootObjectId: string
): Promise<string[]> => {
  const { rows } = await db.raw<{ rows: Array<{ id: string }> }>(
    `
    WITH closure AS (
      SELECT d.key AS id
      FROM objects r
      JOIN jsonb_each_text(r.data->'__closure') d ON true
      WHERE r."streamId" = ? AND r.id = ?
    )
    SELECT k.id FROM closure k
    WHERE NOT EXISTS (
      SELECT 1 FROM objects o WHERE o."streamId" = ? AND o.id = k.id
    )
    `,
    [streamId, rootObjectId, streamId]
  )
  return rows.map((row) => row.id)
}

/** 某个候选项目里已存在的 id（用于判断它能补多少） */
const getExistingIds = async (
  db: Knex,
  streamId: string,
  objectIds: string[]
): Promise<string[]> => {
  if (!objectIds.length) return []
  // 分批查询，避免超过 Postgres 单条语句的参数上限
  const chunkSize = 5000
  const existing: string[] = []
  for (let start = 0; start < objectIds.length; start += chunkSize) {
    const batch = objectIds.slice(start, start + chunkSize)
    const rows = await db(Objects.name)
      .where(Objects.col.streamId, streamId)
      .whereIn(Objects.col.id, batch)
      .select(Objects.col.id)
    rows.forEach((row) => existing.push((row as { id: string }).id))
  }
  return existing
}

/** 包含该 root 对象的项目（候选完整副本来源） */
const getCandidateSourceStreams = async (
  db: Knex,
  rootObjectId: string
): Promise<string[]> => {
  const { rows } = await db.raw<{ rows: Array<{ streamId: string }> }>(
    `SELECT DISTINCT "streamId" FROM objects WHERE id = ?`,
    [rootObjectId]
  )
  return rows.map((row) => row.streamId)
}

const listModelsWithVersion = async (params: {
  projectId?: string
  limit?: number
}): Promise<ModelRow[]> => {
  const { rows } = await knex.raw<{ rows: ModelRow[] }>(
    `
    SELECT b."streamId" AS "streamId", b.id AS "modelId", b.name AS "name",
           c."referencedObject" AS "referencedObject"
    FROM branches b
    JOIN LATERAL (
      SELECT bc."commitId" AS "commitId"
      FROM branch_commits bc
      JOIN commits c2 ON c2.id = bc."commitId"
      WHERE bc."branchId" = b.id
      ORDER BY c2."createdAt" DESC
      LIMIT 1
    ) latest ON true
    JOIN commits c ON c.id = latest."commitId"
    WHERE b.name <> 'globals'
      AND c."referencedObject" IS NOT NULL
      ${params.projectId ? 'AND b."streamId" = ?' : ''}
    ORDER BY b."updatedAt" DESC
    ${params.limit ? 'LIMIT ?' : ''}
    `,
    [
      ...(params.projectId ? [params.projectId] : []),
      ...(params.limit ? [params.limit] : [])
    ]
  )
  return rows
}

const main = async () => {
  const dryRun = hasFlag('--dry-run')
  const projectId = getArgValue('project')
  const limitRaw = getArgValue('limit')
  const limit = limitRaw ? Math.max(1, parseInt(limitRaw)) : undefined
  const copyObjects = copyObjectsBetweenProjectsFactory()

  const models = await listModelsWithVersion({ projectId, limit })
  logger.info({ count: models.length, dryRun, projectId, limit }, '待检查模型数')

  let checked = 0
  let broken = 0
  let repaired = 0
  let unresolved = 0
  let copiedObjects = 0

  for (const model of models) {
    checked++
    const db = await getProjectDbClient({ projectId: model.streamId })

    const { hasRoot, expected, actual } = await getClosureStats(
      db,
      model.streamId,
      model.referencedObject
    )

    // root 对象本身缺失：无法按 closure 判断，单独报出来
    if (!hasRoot) {
      broken++
      logger.error(
        {
          projectId: model.streamId,
          modelId: model.modelId,
          name: model.name,
          rootObjectId: model.referencedObject
        },
        'root 对象在目标项目中缺失，未处理'
      )
      continue
    }

    if (!expected || actual >= expected) continue

    broken++
    logger.warn(
      {
        projectId: model.streamId,
        modelId: model.modelId,
        name: model.name,
        expected,
        actual,
        missing: expected - actual
      },
      '发现残缺模型'
    )

    if (dryRun) continue

    const missingIds = await getMissingObjectIds(
      db,
      model.streamId,
      model.referencedObject
    )
    const remaining = new Set(missingIds)

    const candidates = (await getCandidateSourceStreams(db, model.referencedObject))
      .filter((candidate) => candidate !== model.streamId)
      // 优先从模型库取
      .sort((a, b) =>
        a === MODEL_LIBRARY_PROJECT_ID ? -1 : b === MODEL_LIBRARY_PROJECT_ID ? 1 : 0
      )

    for (const candidate of candidates) {
      if (!remaining.size) break
      const available = await getExistingIds(db, candidate, [...remaining])
      if (!available.length) continue

      const { objectCount } = await copyObjects({
        sourceProjectId: candidate,
        targetProjectId: model.streamId,
        objectIds: available
      })
      available.forEach((id) => remaining.delete(id))
      copiedObjects += objectCount
      logger.info(
        {
          projectId: model.streamId,
          modelId: model.modelId,
          from: candidate,
          copied: objectCount,
          remaining: remaining.size
        },
        '已从候选源补齐对象'
      )
    }

    if (remaining.size) {
      unresolved++
      logger.error(
        {
          projectId: model.streamId,
          modelId: model.modelId,
          remaining: remaining.size
        },
        '仍有对象找不到完整来源，未完全补齐'
      )
    } else {
      repaired++
    }
  }

  logger.info(
    { checked, broken, repaired, unresolved, copiedObjects, dryRun },
    '订正完成'
  )
}

void main()
  .catch((err) => {
    logger.error(err, '订正脚本执行失败')
    process.exitCode = 1
  })
  .finally(async () => {
    await knex.destroy()
  })
