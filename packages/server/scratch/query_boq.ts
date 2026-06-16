import { db } from '@/db/knex'

async function run() {
  const nonItems = await db('boq_items')
    .whereNot('type', 'ITEM')
    .select('id', 'parentId', 'type', 'code', 'name', 'depth')
  console.log("Non-Item Nodes:", nonItems)
  process.exit(0)
}
run().catch(console.error)
