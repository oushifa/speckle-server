import { getProjectDbClient } from './modules/multiregion/utils/dbSelector.js'

async function run() {
  try {
    const projectId = '02237ddbe5'
    const projectDb = await getProjectDbClient({ projectId })

    const measurements = await projectDb('monthly_measurements')
      .where('project_id', projectId)
      .select('id', 'code', 'baseDate', 'approveStatus')
      .orderBy('baseDate', 'asc')
      .orderBy('id', 'asc')

    console.log('=== MONTHLY MEASUREMENTS ===')
    console.log(measurements)

    for (const m of measurements) {
      console.log(`\n--- Measurement: ${m.code} (ID: ${m.id}, Status: ${m.approveStatus}) ---`)
      const items = await projectDb('monthly_measurement_items')
        .where('measurementId', m.id)
      console.log(`Total items count: ${items.length}`)
      const summaryRows = items.filter(it => it.isSummaryRow)
      const leafRows = items.filter(it => !it.isSummaryRow)
      console.log(`Summary rows: ${summaryRows.length}, Leaf rows: ${leafRows.length}`)
    }
  } catch (err) {
    console.error('Error during query:', err)
  } finally {
    process.exit(0)
  }
}

run()
