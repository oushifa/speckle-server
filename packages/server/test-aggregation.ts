import { getProjectDbClient } from './modules/multiregion/utils/dbSelector.js'

async function run() {
  try {
    const projectId = '02237ddbe5'
    const id = 'c6f95acf0a' // Monthly measurement ID
    const projectDb = await getProjectDbClient({ projectId })

    const summaryItemsWithPrice = await projectDb('monthly_measurement_items')
      .where('measurementId', id)
      .andWhere('isSummaryRow', true)
      .andWhere(function() {
        this.whereNotNull('price').andWhere('price', '>', 0)
      })

    console.log(`Summary items with price > 0: ${summaryItemsWithPrice.length}`)
    for (const it of summaryItemsWithPrice) {
      console.log(`- Item: Name="${it.boqName}", Code="${it.boqCode}", price=${it.price}`)
    }

  } catch (err) {
    console.error('Error during query:', err)
  } finally {
    process.exit(0)
  }
}

run()
