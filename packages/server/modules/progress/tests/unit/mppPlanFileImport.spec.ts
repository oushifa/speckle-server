import { expect } from 'chai'
import { access, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  runProgressPlanExtractorOnFile,
  runProgressPlanFieldProbe,
  runProgressPlanWriterOnFile,
  type ProgressPlanFieldProbeResult
} from '@/modules/progress/services/mppTaskImport'

const currentDir = dirname(fileURLToPath(import.meta.url))
// unit -> tests -> progress -> modules -> server -> packages -> workspace root
const workspaceRoot = resolve(currentDir, '../../../../../../')

/** 标准提取器（ProgressPlanMppExtractor）导入时输出的字段清单 */
const EXTRACTOR_FIELDS = [
  'externalId',
  'sysTaskId',
  'quantity',
  'unit',
  'parentExternalId',
  'wbs',
  'name',
  'level',
  'sortOrder',
  'duration',
  'planStart',
  'planEnd',
  'predecessor',
  'inspectionBatch'
]

const FIELD_CATEGORIES = [
  'textFields',
  'numberFields',
  'costFields',
  'flagFields',
  'dateFields',
  'durationFields',
  'startFields',
  'finishFields'
] as const

async function resolvePlanMppFiles(): Promise<string[]> {
  // 优先使用环境变量指定文件（逗号分隔），其次在工作区根 ignores/ 目录下找所有 *.mpp
  if (process.env.PROGRESS_MPP_TEST_FILE) {
    const candidates = process.env.PROGRESS_MPP_TEST_FILE.split(',')
      .map((name) => name.trim())
      .filter(Boolean)
    const files: string[] = []
    for (const candidate of candidates) {
      const absolute = resolve(candidate)
      try {
        await access(absolute)
        files.push(absolute)
      } catch {
        // skip missing
      }
    }
    if (files.length) return files
  }

  const ignoresDir = join(workspaceRoot, 'ignores')
  try {
    const mppFiles = (await readdir(ignoresDir))
      .filter((name) => name.toLowerCase().endsWith('.mpp'))
      .sort()
    return mppFiles.map((name) => join(ignoresDir, name))
  } catch {
    return []
  }
}

describe('progress plan .mpp import fields (real plan files)', function () {
  let mppFiles: string[] = []
  let envReady = false

  before(async () => {
    mppFiles = await resolvePlanMppFiles()
    if (!mppFiles.length) return

    // 探测 java / mpxj 运行环境是否可用；不可用则整个 describe 跳过
    try {
      await runProgressPlanExtractorOnFile(mppFiles[0])
      envReady = true
    } catch {
      envReady = false
    }
  })

  it('imports every real plan file with the standard extractor fields', async function () {
    if (!envReady || !mppFiles.length) {
      this.skip()
      return
    }

    for (const mppFile of mppFiles) {
      const tasks = await runProgressPlanExtractorOnFile(mppFile)

      expect(
        tasks.length,
        `${mppFile} should import at least one task`
      ).to.be.greaterThan(0)
      for (const field of EXTRACTOR_FIELDS) {
        expect(
          tasks[0],
          `${mppFile} task record should have field ${field}`
        ).to.have.property(field)
      }

      // 打印摘要，方便直接查看当前导入产出的字段
      console.log(`\n[导入字段确认] 文件: ${mppFile}`)
      console.log(`[导入字段确认] 任务数: ${tasks.length}`)
      console.log(`[导入字段确认] 每个任务包含的字段: ${EXTRACTOR_FIELDS.join(', ')}`)
      console.log('[导入字段确认] 前 5 条任务样本:')
      console.log(JSON.stringify(tasks.slice(0, 5), null, 2))
    }
  })

  it('parses quantity/unit by custom field alias (工程量/单位 columns)', async function () {
    if (!envReady || !mppFiles.length) {
      this.skip()
      return
    }

    for (const mppFile of mppFiles) {
      const tasks = await runProgressPlanExtractorOnFile(mppFile)
      const withQuantity = tasks.filter((t) => t.quantity)

      console.log(`\n[别名解析] 文件: ${mppFile}`)
      console.log(`[别名解析] 有工程量(quantity)的任务: ${withQuantity.length} 个`)
      withQuantity.forEach((t) => {
        console.log(
          `  - wbs=${t.wbs} 名称="${t.name}" quantity=${t.quantity} unit=${t.unit}`
        )
      })

      // 文件里 Text1 列别名是「工程量」，其值应解析为 quantity 而非 sysTaskId
      expect(
        withQuantity.length,
        `${mppFile} should find quantity tasks`
      ).to.be.greaterThan(0)
      const quantityValues = [...new Set(withQuantity.map((t) => t.quantity))].sort()
      expect(quantityValues).to.deep.equal(['123', '16', '26', '47.64'])

      // 2.mpp 中 Text4 别名「单位」有 2 个任务填了根/m；3.10.mpp 未填
      const unitValues = [
        ...new Set(tasks.filter((t) => t.unit).map((t) => t.unit))
      ].sort()
      if (mppFile.includes('2.mpp')) {
        expect(unitValues).to.deep.equal(['m', '根'])
      } else {
        expect(unitValues).to.deep.equal([])
      }

      // 文件里没有「数智南北ID」列，sysTaskId 不应再被 Text1 的工程量误填
      const withSysTaskId = tasks.filter((t) => t.sysTaskId)
      expect(
        withSysTaskId,
        `${mppFile} should not map 工程量 into sysTaskId`
      ).to.have.length(0)
    }
  })

  it('round-trips: writer keeps 工程量 in Text1 and writes sysTaskId into Text5', async function () {
    if (!envReady || !mppFiles.length) {
      this.skip()
      return
    }

    // 用任一真实计划文件做导出-回读闭环
    const mppFile = mppFiles.find((f) => f.includes('2.mpp')) || mppFiles[0]
    const outputFilePath = join(
      tmpdir(),
      `speckle-progress-roundtrip-${Date.now()}.xml`
    )

    try {
      await runProgressPlanWriterOnFile({
        inputFilePath: mppFile,
        outputFilePath,
        mappings: [
          { externalId: '4015', wbs: '1.3.1.2', sysTaskId: 'T-4015' },
          { externalId: '4016', wbs: '1.3.1.3', sysTaskId: 'T-4016' }
        ]
      })

      // 1) 重新导入：工程量/单位仍从 Text1/Text4 解析，sysTaskId 从 Text5 解析
      const tasks = await runProgressPlanExtractorOnFile(outputFilePath)
      const withQuantity = tasks.filter((t) => t.quantity)
      expect(withQuantity.length).to.be.greaterThan(0)
      const quantityValues = [...new Set(withQuantity.map((t) => t.quantity))].sort()
      expect(quantityValues).to.deep.equal(['123', '16', '26', '47.64'])

      const withSysTaskId = tasks.filter((t) => t.sysTaskId)
      console.log(
        `\n[round-trip] 导出后重新导入: quantity 任务 ${withQuantity.length} 个, sysTaskId 任务 ${withSysTaskId.length} 个`
      )
      withSysTaskId.forEach((t) => {
        console.log(`  - wbs=${t.wbs} 名称="${t.name}" sysTaskId=${t.sysTaskId}`)
      })
      expect(withSysTaskId.map((t) => t.sysTaskId)).to.deep.equal(['T-4015', 'T-4016'])

      // 2) 探针确认导出文件的字段别名：
      //    - 存在别名为「数智南北ID」的列（sysTaskId 槽位，动态选择，不固定 Text5）
      //    - 该列不是 Text1-4 业务列；Text1 仍是「工程量」
      const probe = await runProgressPlanFieldProbe(outputFilePath)
      const defs = probe.customFieldDefinitions || []
      const sysTaskIdDef = defs.find((d) => d.alias === '数智南北ID')
      const text1Def = defs.find((d) => d.field === 'Text1')
      console.log(
        `[round-trip] 导出文件字段别名: ${defs
          .map((d) => `${d.field}=「${d.alias || ''}」`)
          .join(', ')}`
      )
      console.log(
        `[round-trip] 「数智南北ID」所在列: ${
          sysTaskIdDef ? sysTaskIdDef.field : '(未找到)'
        }`
      )
      expect(text1Def?.alias).to.equal('工程量')
      expect(sysTaskIdDef, 'should have a 数智南北ID column').to.exist
      expect(sysTaskIdDef!.field).to.not.match(/^Text[1-4]$/)

      // 3) 模拟「别名丢失」：删除 MSPDI 里的 <Alias>数智南北ID</Alias>，
      //    sysTaskId 仍应能按 SYSID: 值前缀兜底解析出来
      const xml = await readFile(outputFilePath, 'utf8')
      const strippedXml = xml.replace(/<Alias>数智南北ID<\/Alias>/g, '')
      expect(strippedXml).to.not.include('数智南北ID')
      const noAliasPath = outputFilePath.replace(/\.xml$/, '-no-alias.xml')
      await writeFile(noAliasPath, strippedXml, 'utf8')
      try {
        const tasksNoAlias = await runProgressPlanExtractorOnFile(noAliasPath)
        const sysTaskIds = tasksNoAlias
          .filter((t) => t.sysTaskId)
          .map((t) => t.sysTaskId)
        console.log(
          `[round-trip] 别名丢失后 sysTaskId 仍解析出: ${JSON.stringify(sysTaskIds)}`
        )
        expect(sysTaskIds).to.deep.equal(['T-4015', 'T-4016'])
      } finally {
        await rm(noAliasPath, { force: true })
      }
    } finally {
      await rm(outputFilePath, { force: true })
    }
  })

  it('probes every task field of each plan file to locate the quantity column', async function () {
    if (!envReady || !mppFiles.length) {
      this.skip()
      return
    }

    for (const mppFile of mppFiles) {
      const probe = await runProgressPlanFieldProbe(mppFile)

      expect(probe.taskCount, `${mppFile} probe taskCount`).to.be.greaterThan(0)
      expect(probe.tasks).to.be.an('array')

      printProbeSummary(probe, mppFile)
    }
  })
})

/** 打印字段探针摘要：哪个字段有真实数据（用于定位工程量字段） */
function printProbeSummary(probe: ProgressPlanFieldProbeResult, mppFile: string) {
  const { tasks } = probe

  console.log(`\n[字段探针] 文件: ${mppFile}`)
  console.log(`[字段探针] 项目标题: ${probe.projectTitle}`)
  console.log(`[字段探针] 任务总数: ${probe.taskCount}`)

  // 0. 自定义字段定义（别名/显示名）——直接回答「哪个 TEXT 叫工程量」
  if (probe.customFieldDefinitions && probe.customFieldDefinitions.length) {
    console.log('[字段探针] 自定义字段定义（MS Project 列显示名/别名）:')
    for (const def of probe.customFieldDefinitions) {
      console.log(`  ${def.field} -> 别名「${def.alias || ''}」`)
    }
  }
  if (probe.aliasLookup && Object.keys(probe.aliasLookup).length) {
    console.log('[字段探针] 按别名反查字段:')
    for (const [alias, field] of Object.entries(probe.aliasLookup)) {
      console.log(`  「${alias}」 -> ${field}`)
    }
  }

  // 1. 各字段类别「有真实值」的任务数（NUMBER/COST 的默认 0.0 不计入）
  const categoryCounts: Record<string, number> = {}
  for (const category of FIELD_CATEGORIES) {
    let count = 0
    for (const task of tasks) {
      const value = task[category]
      if (!value || typeof value !== 'object') continue
      const entries = Object.entries(value as Record<string, unknown>)
      if (category === 'numberFields' || category === 'costFields') {
        if (entries.some(([, v]) => Number(v) !== 0)) count++
      } else if (entries.length > 0) {
        count++
      }
    }
    categoryCounts[category] = count
  }
  console.log('[字段探针] 各字段类别有真实值的任务数:')
  for (const category of FIELD_CATEGORIES) {
    console.log(`  ${category}: ${categoryCounts[category]}`)
  }

  // 2. 自定义字段里非空/非零的值
  const nonZeroNumberFields = new Map<
    string,
    Array<{ wbs: string; name: string; value: unknown }>
  >()
  const textFieldValues = new Map<
    string,
    Array<{ wbs: string; name: string; value: unknown }>
  >()
  const otherFieldValues = new Map<
    string,
    Array<{ wbs: string; name: string; value: unknown }>
  >()

  for (const task of tasks) {
    const wbs = String(task.wbs ?? '')
    const name = String(task.name ?? '')
    for (const [fieldKey, value] of Object.entries(task)) {
      if (!value || typeof value !== 'object') continue
      for (const [subKey, subValue] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (subValue === null || subValue === undefined || subValue === '') continue
        if (fieldKey === 'numberFields' || fieldKey === 'costFields') {
          const num = Number(subValue)
          if (!Number.isFinite(num) || num === 0) continue
          const entry = { wbs, name, value: subValue }
          nonZeroNumberFields.set(subKey, [
            ...(nonZeroNumberFields.get(subKey) || []),
            entry
          ])
          continue
        }
        if (fieldKey === 'textFields') {
          const entry = { wbs, name, value: subValue }
          textFieldValues.set(subKey, [...(textFieldValues.get(subKey) || []), entry])
          continue
        }
        if (
          fieldKey === 'flagFields' ||
          fieldKey === 'dateFields' ||
          fieldKey === 'durationFields' ||
          fieldKey === 'startFields' ||
          fieldKey === 'finishFields'
        ) {
          const entry = { wbs, name, value: subValue }
          otherFieldValues.set(subKey, [...(otherFieldValues.get(subKey) || []), entry])
        }
      }
    }
  }

  console.log('\n[字段探针] 非零 NUMBER/COST 自定义字段（有真实数值的）:')
  if (nonZeroNumberFields.size === 0) {
    console.log('  （无，NUMBER1-20 / COST1-10 均为默认 0.0，未存放数据）')
  } else {
    for (const [field, entries] of nonZeroNumberFields) {
      console.log(
        `  ${field}: ${entries.length} 个任务, 样例 ${JSON.stringify(
          entries.slice(0, 3)
        )}`
      )
    }
  }

  console.log('\n[字段探针] TEXT 自定义字段（有值的）:')
  if (textFieldValues.size === 0) {
    console.log('  （无）')
  } else {
    for (const [field, entries] of textFieldValues) {
      console.log(`  ${field}: ${entries.length} 个任务`)
      entries.slice(0, 8).forEach((e) => {
        console.log(
          `    - wbs=${e.wbs} 名称="${e.name}" ${field}=${JSON.stringify(e.value)}`
        )
      })
    }
  }

  if (otherFieldValues.size > 0) {
    console.log(
      '\n[字段探针] 其他自定义字段（FLAG/DATE/DURATION/START/FINISH，有值的）:'
    )
    for (const [field, entries] of otherFieldValues) {
      console.log(
        `  ${field}: ${entries.length} 个任务, 样例 ${JSON.stringify(
          entries.slice(0, 2)
        )}`
      )
    }
  }

  // 3. 抽样叶子任务完整字段（前 2 个非汇总任务）
  const leafTasks = tasks.filter((t) => t.summary !== true && t.name)
  console.log('\n[字段探针] 抽样叶子任务完整字段（前 2 个）:')
  leafTasks.slice(0, 2).forEach((task) => {
    console.log(JSON.stringify(task, null, 2))
  })

  // 4. 任务名中「(数量+单位)」模式的覆盖情况
  const quantityInNameCount = leafTasks.filter((t) => {
    const name = String(t.name || '')
    return /[（(]\s*[\d.]+\s*[^\s，,）)]+[）)]/.test(name)
  }).length
  console.log(
    `[字段探针] 统计: 任务名中含「(数量+单位)」模式的任务数: ${quantityInNameCount} / ${leafTasks.length}`
  )
}
