import {
  THIRD_PARTY_API_BASE,
  THIRD_PARTY_STATIC_BASE
} from '@/modules/auth/services/thirdPartyToken'

/**
 * 后端版本指纹 —— 用来确认线上/测试服**实际运行**的到底是哪一版代码。
 *
 * 每次发版请更新 `MODEL_SYNC_BUILD_TAG`（部署时也可以用同名环境变量
 * `MODEL_SYNC_BUILD_TAG` 覆盖，方便流水线注入）。
 *
 * 查看方式（任选其一）：
 *  1. 浏览器直接打开同源地址：`/api/v1/model-sync/version`
 *  2. 前端控制台：工作台页面会打印 `[model-sync] 后端构建指纹: ...`
 *  3. 任意 model-sync 接口的响应头：`X-Model-Sync-Build`
 *  4. 容器日志：`docker logs <speckle-server> | grep 'model-sync build'`
 *
 * 注意：如果第 1 条返回 404 或前端页面，说明当前后端**不含本次改动**（旧版本）。
 */
export const MODEL_SYNC_BUILD_TAG = '2026-10-14-model-sync-v1'

/** 版本指纹响应头名称 */
export const MODEL_SYNC_BUILD_HEADER = 'X-Model-Sync-Build'

/** 进程启动时间：用于确认容器是否真的重启/重建过 */
const PROCESS_STARTED_AT = new Date().toISOString()

/**
 * 本版本包含的同步相关能力。改动这些能力时同步更新这里的值，
 * 便于一眼看出线上跑的是新代码还是旧代码。
 */
const FEATURES = {
  /** 中海登录失败时回退使用服务器缓存的共享 DTP token */
  sharedDtpTokenFallback: true,
  /** 转换完成后自动续跑同步（IFC/SKP/DXF 等新版导入器链路） */
  resumeSyncAfterConversion: true,
  /** 中海转换轮询接入真实阶段进度（currentStage/totalStage） */
  realDtpTransformProgress: true
} as const

export type ModelSyncBuildInfo = {
  buildTag: string
  processStartedAt: string
  nodeVersion: string
  thirdPartyApiBase: string
  thirdPartyStaticBase: string
  features: typeof FEATURES
}

export const getModelSyncBuildInfo = (): ModelSyncBuildInfo => ({
  buildTag: (process.env.MODEL_SYNC_BUILD_TAG || '').trim() || MODEL_SYNC_BUILD_TAG,
  processStartedAt: PROCESS_STARTED_AT,
  nodeVersion: process.version,
  thirdPartyApiBase: THIRD_PARTY_API_BASE,
  thirdPartyStaticBase: THIRD_PARTY_STATIC_BASE,
  features: FEATURES
})
