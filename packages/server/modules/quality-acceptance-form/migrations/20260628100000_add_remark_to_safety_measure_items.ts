import type { Knex } from 'knex'

const safetyMeasureItemsTable = 'safety_measure_items'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(safetyMeasureItemsTable))) return
  if (await knex.schema.hasColumn(safetyMeasureItemsTable, 'remark')) return

  await knex.schema.alterTable(safetyMeasureItemsTable, (table) => {
    // 明细行备注：流程结束前由当前节点审批人填写
    table.string('remark').nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(safetyMeasureItemsTable))) return
  if (!(await knex.schema.hasColumn(safetyMeasureItemsTable, 'remark'))) return

  await knex.schema.alterTable(safetyMeasureItemsTable, (table) => {
    table.dropColumn('remark')
  })
}
