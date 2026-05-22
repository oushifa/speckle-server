import type { ProjectPageLatestItemsModelItemFragment } from '~/lib/common/generated/gql/graphql'
import { useCreateNewModel } from '~/lib/projects/composables/modelManagement'
import {
  type RvtConversionJob,
  useRvtConversion
} from '~/lib/projects/composables/useRvtConversion'
import { sanitizeModelName } from '~/lib/projects/helpers/models'

type RvtTargetModel = {
  id: string
  name: string
}

const sourceApplicationDefault = 'External RVT Converter'

const buildModelNameFromFile = (file: File) => {
  const baseName = file.name.replace(/\.[^.]+$/, '')
  return sanitizeModelName(baseName)
}

export const useRvtConversionFlow = () => {
  const createModel = useCreateNewModel()
  const {
    requestUploadUrl,
    uploadSourceFile,
    createJob,
    waitForJobCompletion,
    getErrorMessage
  } = useRvtConversion()

  const isProcessing = ref(false)
  const currentJob = ref<RvtConversionJob | null>(null)
  const statusMessage = ref('')

  const reset = () => {
    isProcessing.value = false
    currentJob.value = null
    statusMessage.value = ''
  }

  const submit = async (params: {
    projectId: string
    file: File
    model?: RvtTargetModel | null
    modelName?: string
    versionMessage?: string
    sourceApplication?: string
  }) => {
    if (!params.file.name.toLowerCase().endsWith('.rvt')) {
      throw new Error('仅支持上传 .rvt 文件')
    }

    isProcessing.value = true
    currentJob.value = null
    statusMessage.value = ''

    try {
      let targetModel: RvtTargetModel | ProjectPageLatestItemsModelItemFragment | null =
        params.model || null

      if (!targetModel) {
        statusMessage.value = '正在创建模型...'
        const createdModel = await createModel({
          name: sanitizeModelName(params.modelName || buildModelNameFromFile(params.file)),
          description: '',
          projectId: params.projectId
        })

        if (!createdModel?.id) {
          throw new Error('模型创建失败')
        }

        targetModel = createdModel
      }

      statusMessage.value = '正在申请上传地址...'
      const uploadUrlResult = await requestUploadUrl({
        projectId: params.projectId,
        modelId: targetModel.id,
        file: params.file
      })

      statusMessage.value = '正在上传源文件...'
      const { etag } = await uploadSourceFile({
        uploadUrl: uploadUrlResult.uploadUrl,
        file: params.file
      })

      statusMessage.value = '正在创建转换任务...'
      currentJob.value = await createJob({
        projectId: params.projectId,
        modelId: targetModel.id,
        fileId: uploadUrlResult.fileId,
        fileName: params.file.name,
        etag,
        versionMessage: params.versionMessage || undefined,
        sourceApplication: params.sourceApplication || sourceApplicationDefault
      })

      statusMessage.value = '等待转换服务处理...'
      currentJob.value = await waitForJobCompletion({
        projectId: params.projectId,
        modelId: targetModel.id,
        jobId: currentJob.value.id
      })

      if (currentJob.value.status !== 'succeeded') {
        throw new Error(currentJob.value.errorMessage || 'RVT 转换失败')
      }

      statusMessage.value = '转换完成'
      return {
        model: targetModel,
        job: currentJob.value
      }
    } catch (error) {
      statusMessage.value = getErrorMessage(error)
      throw error
    } finally {
      isProcessing.value = false
    }
  }

  return {
    buildModelNameFromFile,
    submit,
    reset,
    isProcessing,
    currentJob,
    statusMessage,
    getErrorMessage
  }
}
