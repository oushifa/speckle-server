## Migrations, and how to create them

First, make a new migration file in the appropriate migrations folder. To do this use `./bin/cli`.

Next, write your migration! Here's an example below that adds a new column to a table.

```js
/* istanbul ignore file */
const up = async (knex) => {
  await knex.schema.alterTable('scopes', (table) => {
    table.boolean('public').defaultTo(true)
  })
}

const down = async (knex) => {
  let hasColumn = await knex.schema.hasColumn('scopes', 'public')
  if (hasColumn) {
    await knex.schema.alterTable('scopes', (table) => {
      table.dropColumn('public')
    })
  }
}

export { up, down }
```

Notes:

- Do not delete or edit existing migration files
- To edit an existing table, use alter table in a new migration file.
- Always prefix your migration file with the date that you authored it in.

## Project/Stream 新增字段参考流程（以 `address` 为例）

下面这份清单适合你之后再加任意字段时直接复用。

### 1) 先定数据模型

- 字段名、类型、可空性（`null` 还是必填）
- 写入入口（create/update）要不要支持
- 输出接口（`Project`/`Stream` query）要不要暴露
- 是否需要索引、唯一约束、默认值

### 2) 数据库迁移（必须）

1. 在 `packages/server/modules/core/migrations/` 新建 migration 文件（时间戳前缀）
2. 在 `up` 里 `alterTable('streams', ...)` 新增列
3. 在 `down` 里回滚 `dropColumn(...)`

`address` 示例：`20260403103000_add_streams_address_col.ts`

### 3) 后端表结构/类型同步

1. `packages/server/modules/core/dbSchema.ts`
   - `Streams` 的字段列表补上新字段
2. `packages/server/modules/core/helpers/types.ts`
   - `StreamRecord` 增加字段定义
3. 若创建逻辑需要写入，更新 service/repository
   - 例如 `packages/server/modules/core/services/projects.ts` 的创建对象

### 4) GraphQL schema 同步

按你的需求选择：

- 仅输入：在 `ProjectCreateInput` / `ProjectUpdateInput` 增加字段
- 需要前端查询到：在输出 type 增加字段
  - `packages/server/assets/core/typedefs/projects.graphql` 的 `type Project`
  - `packages/server/assets/core/typedefs/streams.graphql` 的 `type Stream`（若老接口也要支持）

### 5) 前端 gqlgen 更新

1. 确保后端 schema 已包含新字段，且服务可访问
2. 在仓库根目录运行：

```bash
yarn workspace @speckle/frontend-2 gqlgen
```

如果要监听模式：

```bash
yarn workspace @speckle/frontend-2 gqlgen:watch
```

### 6) 测试与类型修复

新增字段后，常见失败点是手写测试对象缺字段。需要补齐测试 fixture。

`address` 这次补过的典型位置：

- `packages/server/modules/core/tests/helpers/creation.ts`
- `packages/server/modules/core/tests/integration/projectRepositories.spec.ts`
- `packages/server/modules/notifications/tests/activityDigest.spec.ts`

### 7) 最后验证（提交前）

在仓库根目录至少执行：

```bash
yarn workspace @speckle/server lint
```

如果改了前端查询或类型，再执行：

```bash
yarn workspace @speckle/frontend-2 lint
```

并确认 migration 已在目标环境执行：

```bash
yarn workspace @speckle/server migrate
```

## 快速检查清单（可复制）

- [ ] 新 migration 已创建（含 up/down）
- [ ] `dbSchema.ts` 已同步
- [ ] `StreamRecord/Project` 类型已同步
- [ ] create/update/repository 写入逻辑已同步
- [ ] GraphQL input/output 已按需求同步
- [ ] 前端 gqlgen 已更新
- [ ] 测试 fixtures 已补齐
- [ ] `@speckle/server` lint 通过
- [ ] 目标环境已执行 migrate
