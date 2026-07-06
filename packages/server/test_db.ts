import { db } from '@/db/knex'

async function run() {
  const info = await db('custom_roles').columnInfo()
  console.log("Columns info:", Object.keys(info))
  process.exit(0)
}

run().catch(console.error)
