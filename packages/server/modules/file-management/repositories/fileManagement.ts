import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import crs from 'crypto-random-string'

export interface ProjectFileRecord {
  id: string
  projectId: string
  modelId?: string | null
  name: string
  blobId?: string | null
  fileSize?: number | null
  fileType?: string | null
  source: string
  category?: string | null
  customAttributes?: Record<string, any> | null
  description?: string | null
  uploaderId?: string | null
  uploaderName?: string | null
  createdAt: Date
  updatedAt: Date
  isModel?: boolean
}

export const ProjectFilesTable = 'project_files'

export async function getProjectFilesFromDb(params: {
  projectId: string
  search?: string
  source?: string
  category?: string
}): Promise<ProjectFileRecord[]> {
  const { projectId, search, source, category } = params
  const projectDb = await getProjectDbClient({ projectId })

  let query = projectDb<ProjectFileRecord>(ProjectFilesTable)
    .where('projectId', projectId)
    .orderBy('createdAt', 'desc')

  if (search) {
    query = query.andWhere('name', 'ilike', `%${search}%`)
  }
  if (source) {
    query = query.andWhere('source', source)
  }
  if (category) {
    query = query.andWhere('category', category)
  }

  const records = await query
  return records
}

export async function getProjectFileByIdFromDb(
  projectId: string,
  id: string
): Promise<ProjectFileRecord | undefined> {
  const projectDb = await getProjectDbClient({ projectId })
  const record = await projectDb<ProjectFileRecord>(ProjectFilesTable)
    .where('id', id)
    .andWhere('projectId', projectId)
    .first()
  return record
}

export async function createProjectFileInDb(
  file: Omit<ProjectFileRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ProjectFileRecord> {
  const { projectId } = file
  const projectDb = await getProjectDbClient({ projectId })
  const id = crs({ length: 20 })
  const now = new Date()

  const newRecord: ProjectFileRecord = {
    ...file,
    id,
    createdAt: now,
    updatedAt: now
  }

  await projectDb<ProjectFileRecord>(ProjectFilesTable).insert({
    ...newRecord,
    customAttributes: newRecord.customAttributes
      ? JSON.stringify(newRecord.customAttributes)
      : null
  } as any)

  return newRecord
}

export async function updateProjectFileInDb(
  projectId: string,
  id: string,
  updates: Partial<Omit<ProjectFileRecord, 'id' | 'projectId' | 'createdAt'>>
): Promise<ProjectFileRecord | undefined> {
  const projectDb = await getProjectDbClient({ projectId })
  const now = new Date()
  const payload: any = {
    ...updates,
    updatedAt: now
  }

  if (updates.customAttributes !== undefined) {
    payload.customAttributes = updates.customAttributes
      ? JSON.stringify(updates.customAttributes)
      : null
  }

  await projectDb<ProjectFileRecord>(ProjectFilesTable)
    .where('id', id)
    .andWhere('projectId', projectId)
    .update(payload)

  return getProjectFileByIdFromDb(projectId, id)
}

export async function deleteProjectFileInDb(
  projectId: string,
  id: string
): Promise<boolean> {
  const projectDb = await getProjectDbClient({ projectId })
  const count = await projectDb<ProjectFileRecord>(ProjectFilesTable)
    .where('id', id)
    .andWhere('projectId', projectId)
    .del()
  return count > 0
}

export async function getProjectModelsFromDb(projectId: string): Promise<any[]> {
  const projectDb = await getProjectDbClient({ projectId })

  const branches = await projectDb('branches')
    .where('streamId', projectId)
    .andWhere('name', '!=', 'globals')
    .select('id', 'name', 'description', 'createdAt', 'updatedAt', 'authorId')

  return branches
}

export async function getModelFileMetadataFromDb(
  projectId: string,
  modelId: string
): Promise<ProjectFileRecord | undefined> {
  const projectDb = await getProjectDbClient({ projectId })
  return await projectDb<ProjectFileRecord>(ProjectFilesTable)
    .where('projectId', projectId)
    .andWhere('modelId', modelId)
    .first()
}
