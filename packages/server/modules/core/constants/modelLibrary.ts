export const PROJECT_USAGES = {
  Normal: 'normal',
  StorageOnly: 'storage_only'
} as const

export type ProjectUsage = (typeof PROJECT_USAGES)[keyof typeof PROJECT_USAGES]

export const MODEL_LIBRARY_PROJECT_ID = 'models_lib'
export const MODEL_LIBRARY_PROJECT_NAME = '模型库'
