import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// 显式载入 packages/server 下的 .env
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { db } from '@/db/knex'

async function main() {
  console.log('DB Host:', process.env.POSTGRES_URL)
  console.log('DB User:', process.env.POSTGRES_USER)
  console.log('Starting migrations via script...')
  const [batchNo, log] = await db.migrate.latest()
  if (log.length === 0) {
    console.log('Already up to date.')
  } else {
    console.log(`Batch ${batchNo} run: ${log.length} migrations`)
    console.log(log.join('\n'))
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
