import {
  getProjectFilesFromDb,
  getProjectFileByIdFromDb,
  createProjectFileInDb,
  updateProjectFileInDb,
  deleteProjectFileInDb,
  getProjectModelsFromDb,
  getModelFileMetadataFromDb,
  type ProjectFileRecord
} from '@/modules/file-management/repositories/fileManagement'

export async function getProjectFilesWithModelsService(params: {
  projectId: string
  search?: string
  source?: string
  category?: string
}) {
  const { projectId, search, source, category } = params

  const [dbFiles, dbModels] = await Promise.all([
    getProjectFilesFromDb({ projectId }),
    getProjectModelsFromDb(projectId)
  ])

  // Map models into file format
  const modelFiles: ProjectFileRecord[] = await Promise.all(
    dbModels.map(async (model) => {
      const meta = await getModelFileMetadataFromDb(projectId, model.id)
      const parsedCustomAttrs = meta?.customAttributes
        ? typeof meta.customAttributes === 'string'
          ? JSON.parse(meta.customAttributes)
          : meta.customAttributes
        : null

      return {
        id: meta?.id || `model_${model.id}`,
        projectId,
        modelId: model.id,
        name: meta?.name || model.name,
        blobId: meta?.blobId || null,
        fileSize: meta?.fileSize || null,
        fileType: 'BIM模型',
        source: meta?.source || 'BIM模型',
        category: meta?.category || '模型文件',
        customAttributes: parsedCustomAttrs,
        description: meta?.description || model.description || '',
        uploaderId: meta?.uploaderId || model.authorId,
        uploaderName: meta?.uploaderName || '',
        createdAt: model.createdAt ? new Date(model.createdAt) : new Date(),
        updatedAt: model.updatedAt ? new Date(model.updatedAt) : new Date(),
        isModel: true
      }
    })
  )

  // Map custom dbFiles JSON customAttributes
  const formattedDbFiles: ProjectFileRecord[] = dbFiles.map((file) => ({
    ...file,
    customAttributes: file.customAttributes
      ? typeof file.customAttributes === 'string'
        ? JSON.parse(file.customAttributes)
        : file.customAttributes
      : null,
    isModel: !!file.modelId
  }))

  let combined = [...formattedDbFiles, ...modelFiles]

  // Filter out duplicates if a model has a matching dbFile entry with modelId
  const modelIdsInDbFiles = new Set(
    formattedDbFiles.filter((f) => f.modelId).map((f) => f.modelId)
  )
  combined = combined.filter((f) => {
    if (f.isModel && f.id.startsWith('model_') && modelIdsInDbFiles.has(f.modelId)) {
      return false
    }
    return true
  })

  // Apply search filtering
  if (search && search.trim()) {
    const s = search.trim().toLowerCase()
    combined = combined.filter(
      (f) =>
        f.name.toLowerCase().includes(s) ||
        (f.description && f.description.toLowerCase().includes(s)) ||
        (f.source && f.source.toLowerCase().includes(s)) ||
        (f.category && f.category.toLowerCase().includes(s))
    )
  }

  // Apply source filtering
  if (source && source.trim()) {
    combined = combined.filter((f) => f.source === source)
  }

  // Apply category filtering
  if (category && category.trim()) {
    combined = combined.filter((f) => f.category === category)
  }

  // Sort by createdAt desc
  combined.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return combined
}

export async function upsertFileOrModelMetadataService(
  fileId: string,
  projectId: string,
  updates: Partial<ProjectFileRecord>
) {
  const existing = await getProjectFileByIdFromDb(projectId, fileId)
  if (existing) {
    return await updateProjectFileInDb(projectId, fileId, updates)
  }

  // If fileId is virtual model ID like `model_xxx`
  if (fileId.startsWith('model_')) {
    const realModelId = fileId.replace('model_', '')
    const existingModelMeta = await getModelFileMetadataFromDb(projectId, realModelId)
    if (existingModelMeta) {
      return await updateProjectFileInDb(projectId, existingModelMeta.id, updates)
    } else {
      return await createProjectFileInDb({
        projectId,
        modelId: realModelId,
        name: updates.name || realModelId,
        source: updates.source || 'BIM模型',
        category: updates.category || '模型文件',
        customAttributes: updates.customAttributes || null,
        description: updates.description || null,
        uploaderId: updates.uploaderId || null,
        uploaderName: updates.uploaderName || null
      })
    }
  }

  throw new Error('File not found')
}
