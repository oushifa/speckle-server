type IwhaleBaseConfig = {
  oaUrl: string
  oaToken: string
}

export const getIwhaleBaseConfig = (): IwhaleBaseConfig => {
  const runtimeConfig = useRuntimeConfig()
  const oaToken = useState<string | null>('oa-token')
  const oaUrl = runtimeConfig.public.oaUrl.replace(/\/$/, '')

  if (!oaUrl) {
    throw new Error('缺少 OA 地址配置')
  }

  if (!oaToken.value) {
    throw new Error('缺少 oaToken，请先完成第三方登录')
  }

  return {
    oaUrl,
    oaToken: oaToken.value
  }
}

export const createIwhaleFormData = async ({
  key,
  values
}: {
  key: string
  values: Record<string, any>
}): Promise<{
  ret: number
  msg: Record<string | 'key', any>
}> => {
  const normalizedKey = key.trim()
  if (!normalizedKey) {
    throw new Error('缺少表单 key')
  }

  const { oaUrl, oaToken } = getIwhaleBaseConfig()
  const response = await fetch(
    `${oaUrl}/api/tview/data/${encodeURIComponent(normalizedKey)}/add`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oaToken}`
      },
      body: JSON.stringify({
        values
      })
    }
  )

  const result = await response.json()
  if (result.ret !== 0) {
    throw new Error(result?.msg || `创建表单失败: ${result.msg?.error}`)
  }

  return result
}

export const updateIwhaleFormData = async ({
  key,
  values,
  id
}: {
  key: string
  id: string
  values: Record<string, any>
}) => {
  const normalizedKey = key.trim()
  if (!normalizedKey) {
    throw new Error('缺少表单 key')
  }

  if (!id) {
    throw new Error('缺少表单 ID')
  }

  const { oaUrl, oaToken } = getIwhaleBaseConfig()
  const response = await fetch(
    `${oaUrl}/api/tview/data/${encodeURIComponent(normalizedKey)}/update`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oaToken}`
      },
      body: JSON.stringify({
        id,
        values
      })
    }
  )

  const result = await response.json()
  if (result.ret !== 0) {
    throw new Error(result?.msg || `更新表单失败: ${result.msg?.error}`)
  }

  return result
}

export const getIwhaleFormDataList = async ({
  key,
  page = 1,
  pageSize = 10,
  // eslint-disable-next-line camelcase
  filter_cond = {}
}: {
  key: string
  page?: number
  pageSize?: number
  filter_cond?: Record<string, any>
}): Promise<{
  ret: number
  msg: {
    rows: any[]
    total: number
  }
}> => {
  const normalizedKey = key.trim()
  if (!normalizedKey) {
    throw new Error('缺少表单 key')
  }
  const { oaUrl, oaToken } = getIwhaleBaseConfig()

  const response = await fetch(
    `${oaUrl}/api/tview/data/${encodeURIComponent(normalizedKey)}/list`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oaToken}`
      },
      body: JSON.stringify({
        page,
        // eslint-disable-next-line camelcase
        page_size: pageSize,
        // eslint-disable-next-line camelcase
        filter_cond
      })
    }
  )

  const result = await response.json()
  if (result.ret !== 0) {
    throw new Error(result?.msg || `获取表单列表失败: ${result.msg?.error}`)
  }

  return result
}

export const deleteIwhaleFormData = async ({
  key,
  id
}: {
  key: string
  id: string
}) => {
  const normalizedKey = key.trim()
  if (!normalizedKey) {
    throw new Error('缺少表单 key')
  }
  if (!id) {
    throw new Error('缺少表单 ID')
  }
  const { oaUrl, oaToken } = getIwhaleBaseConfig()
  const response = await fetch(
    `${oaUrl}/api/tview/data/${encodeURIComponent(normalizedKey)}/delete?id=${id}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oaToken}`
      }
    }
  )
  const result = await response.json()
  if (result.ret !== 0) {
    throw new Error(result?.msg || `删除表单失败: ${result.msg?.error}`)
  }
  return result
}
