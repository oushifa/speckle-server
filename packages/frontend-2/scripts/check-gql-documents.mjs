/* eslint-disable no-console */
/**
 * 校验「源码里的 GraphQL 文档」都能在 codegen 产物 lib/common/generated/gql/gql.ts 的
 * documents 映射表里找到。
 *
 * 背景：`graphql()` 的实现是 `documents[source] ?? {}`，映射表里缺条目时会**静默**返回
 * 空文档，请求体变成空操作，功能只在运行时失败（已踩过一次：新增
 * updateFormAttachments 的 document 时 codegen 与 schema 不同步，产物缺条目，
 * 生成的前端镜像里附件保存一直失败，而类型检查/build 都不报错）。
 *
 * 前端镜像构建不会重跑 codegen（需要连真实服务器 introspection），所以这里在
 * `yarn build` 前做一次静态校验，产物过期就让构建直接失败。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generatedGqlPath = path.join(packageRoot, 'lib/common/generated/gql/gql.ts')

const SKIP_DIRS = new Set([
  'node_modules',
  '.nuxt',
  '.output',
  'dist',
  'dist-esm',
  'generated',
  'coverage'
])

/** gql.ts 里 documents 映射表的 key（即源码模板字面量的原文） */
const collectKnownDocuments = () => {
  const content = fs.readFileSync(generatedGqlPath, 'utf8')
  const known = new Set()
  const keyRe =
    /^\s*"((?:[^"\\]|\\.)*)":\s*(?:typeof\s+)?types\.\w+(?:Document|FragmentDoc),\s*$/gm
  for (const match of content.matchAll(keyRe)) {
    known.add(JSON.parse(`"${match[1]}"`))
  }
  return known
}

/** 收集源码里所有 graphql`...` / gql`...` 文档 */
const collectSourceDocuments = () => {
  const found = []
  const docRe = /(?:^|[^.\w$])(?:graphql|gql)\s*(?:\(\s*)?`([\s\S]*?)`/g

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        walk(full)
        continue
      }
      if (!/\.(ts|vue|js)$/.test(entry.name)) continue
      if (full === generatedGqlPath) continue

      const content = fs.readFileSync(full, 'utf8')
      for (const match of content.matchAll(docRe)) {
        const source = match[1]
        const head = source.trim().split('\n')[0].trim()
        // 只关心真正的 graphql 文档（query/mutation/subscription/fragment）
        if (!/^(query|mutation|subscription|fragment)\b/.test(head)) continue
        found.push({
          file: path.relative(packageRoot, full),
          head,
          source
        })
      }
    }
  }

  walk(packageRoot)
  return found
}

const known = collectKnownDocuments()
const sources = collectSourceDocuments()
const missing = sources.filter((doc) => !known.has(doc.source))

console.log(
  `[check-gql-documents] 产物映射表条目: ${known.size}，源码文档: ${sources.length}，未收录: ${missing.length}`
)

if (missing.length) {
  console.error(
    '\n以下文档不在 lib/common/generated/gql/gql.ts 的映射表里（graphql() 会返回空文档）：\n'
  )
  for (const doc of missing) {
    console.error(`  - ${doc.file}  →  ${doc.head}`)
  }
  console.error(
    '\n请先让后端加载出新 schema，再执行 `yarn workspace @speckle/frontend-2 gqlgen` 重新生成产物后提交。\n'
  )
  process.exit(1)
}
