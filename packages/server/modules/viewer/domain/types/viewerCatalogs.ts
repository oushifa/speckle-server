export type ViewerCatalogNode = {
  id: string
  title: string
  isolatedApplicationIds?: string[]
  hiddenApplicationIds?: string[]
  childrens?: ViewerCatalogNode[]
}

export type ViewerCatalog = {
  id: string
  projectId: string
  modelId: string | null
  authorId: string | null
  title: string
  treeData: ViewerCatalogNode[]
  createdAt: Date
  updatedAt: Date
}
