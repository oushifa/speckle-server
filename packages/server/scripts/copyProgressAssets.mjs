import { mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')

const assetsToCopy = [
  {
    source: path.join(packageRoot, 'modules/progress/java/ProgressPlanMppExtractor.java'),
    target: path.join(
      packageRoot,
      'dist/modules/progress/java/ProgressPlanMppExtractor.java'
    )
  }
]

for (const asset of assetsToCopy) {
  await mkdir(path.dirname(asset.target), { recursive: true })
  await copyFile(asset.source, asset.target)
}
