import { get, isObjectLike, isString } from '#lodash'
import { ValueOf } from 'type-fest'
import { WorkspaceLimits } from '../../workspaces/helpers/limits.js'

export type AuthError<ErrorCode extends string = string, Payload = undefined> = {
  readonly code: ErrorCode
  readonly message: string
  readonly payload: Payload
} & Error

export const defineAuthError = <
  ErrorCode extends string,
  Payload = undefined
>(definition: {
  code: ErrorCode
  message: string
}): {
  new (
    ...args: Payload extends undefined
      ? [params?: { message?: string } | string]
      : [params: { payload: Payload; message?: string } | string]
  ): AuthError<ErrorCode, Payload>
  code: ErrorCode
} => {
  return class AuthErrorClass extends Error {
    readonly message: string
    readonly code: ErrorCode
    readonly payload: Payload
    readonly isAuthPolicyError = true

    static code: ErrorCode = definition.code

    constructor(
      ...args: Payload extends undefined
        ? [params?: { message?: string } | string]
        : [params: { payload: Payload; message?: string } | string]
    ) {
      const [params] = args
      const message = isString(params) ? params : params?.message || definition.message
      super(message)

      this.code = definition.code
      this.payload =
        params && !isString(params) && 'payload' in params
          ? params.payload
          : (undefined as Payload)
      this.message = message
      this.name = definition.code + 'Error'
    }
  }
}

export const isAuthPolicyError = (err: unknown): err is AuthError => {
  return isObjectLike(err) && get(err, 'isAuthPolicyError') === true
}

export const ProjectNotFoundError = defineAuthError({
  code: 'ProjectNotFound',
  message: '未找到项目'
})

export const ProjectNoAccessError = defineAuthError({
  code: 'ProjectNoAccess',
  message: '您没有访问项目的权限'
})

export const PersonalProjectsLimitedError = defineAuthError({
  code: 'PersonalProjectsLimited',
  message: '非工作空间项目被限制'
})

export const ProjectNotEnoughPermissionsError = defineAuthError({
  code: 'ProjectNotEnoughPermissions',
  message: '您没有足够的项目权限来执行此操作'
})

export const ProjectLastOwnerError = defineAuthError({
  code: 'ProjectLastOwner',
  message: '您是项目的最后一个所有者'
})

export const WorkspacesNotEnabledError = defineAuthError({
  code: 'WorkspacesNotEnabled',
  message: '此服务器不支持工作空间'
})

export const WorkspaceNoAccessError = defineAuthError({
  code: 'WorkspaceNoAccess',
  message: '您没有访问工作空间的权限'
})

export const WorkspaceNotEnoughPermissionsError = defineAuthError({
  code: 'WorkspaceNotEnoughPermissions',
  message: '您没有足够的工作空间权限来执行此操作'
})

export const EligibleForExclusiveWorkspaceError = defineAuthError({
  code: 'UserEligibleForExclusiveWorkspace',
  message:
    '无法创建工作空间: ' +
    '您是工作空间的成员或可成为成员。这是由于您已收到工作空间的邀请或' +
    '或您已验证的电子邮件地址匹配。'
})

export const WorkspaceReadOnlyError = defineAuthError({
  code: 'WorkspaceReadOnly',
  message: '工作空间已处于只读模式，升级您的计划以解锁它'
})

export const WorkspaceLimitsReachedError = defineAuthError<
  'WorkspaceLimitsReached',
  { limit: keyof WorkspaceLimits }
>({
  code: 'WorkspaceLimitsReached',
  message: '工作空间限制已达'
})

export const WorkspacePlanNoFeatureAccessError = defineAuthError({
  code: 'WorkspacePlanNoFeatureAccessError',
  message: '您的工作空间计划没有访问此功能的权限'
})

export const WorkspaceProjectMoveInvalidError = defineAuthError({
  code: 'WorkspaceProjectMoveInvalid',
  message: '工作空间项目不能移动到其他工作空间'
})

export const WorkspaceSsoSessionNoAccessError = defineAuthError<
  'WorkspaceSsoSessionNoAccess',
  {
    workspaceSlug: string
  }
>({
  code: 'WorkspaceSsoSessionNoAccess',
  message: '您的工作空间SSO会话已过期或不存在'
})

export const WorkspaceNoEditorSeatError = defineAuthError({
  code: 'WorkspaceNoEditorSeat',
  message: '您需要一个编辑器席位才能执行此操作'
})

export const ServerNoAccessError = defineAuthError({
  code: 'ServerNoAccess',
  message: '您没有访问此服务器的权限'
})

export const ServerNotEnoughPermissionsError = defineAuthError({
  code: 'ServerNotEnoughPermissions',
  message: '您没有足够的服务器权限来执行此操作'
})

export const ServerNoSessionError = defineAuthError({
  code: 'ServerNoSession',
  message: '您未登录到此服务器'
})

export const CommentNotFoundError = defineAuthError({
  code: 'CommentNotFound',
  message: '未找到评论'
})

export const CommentNoAccessError = defineAuthError({
  code: 'CommentNoAccess',
  message: '您没有访问此评论的权限'
})

export const ModelNotFoundError = defineAuthError({
  code: 'ModelNotFound',
  message: '未找到模型'
})

export const ReservedModelNotDeletableError = defineAuthError({
  code: 'ReservedModelNotDeletable',
  message: '此模型已被保留，不能删除'
})

export const VersionNotFoundError = defineAuthError({
  code: 'VersionNotFound',
  message: '未找到版本'
})

export const AutomateNotEnabledError = defineAuthError({
  code: 'AutomateNotEnabled',
  message: '此服务器未启用自动操作'
})

export const AutomateFunctionNotFoundError = defineAuthError({
  code: 'AutomateFunctionNotFound',
  message: '未找到函数'
})

export const AutomateFunctionNotCreatorError = defineAuthError({
  code: 'AutomateFunctionNotCreator',
  message: '您不是函数创建者，无法对其进行更改'
})

export const AccIntegrationNotEnabledError = defineAuthError({
  code: 'AccIntegrationNotEnabled',
  message: '此服务器或项目上未启用ACC集成'
})

export const SavedViewNotFoundError = defineAuthError({
  code: 'SavedViewNotFound',
  message: '未找到保存的视图'
})

export const SavedViewNoAccessError = defineAuthError({
  code: 'SavedViewNoAccess',
  message: '您没有访问此保存视图的权限'
})

export const SavedViewInvalidUpdateError = defineAuthError({
  code: 'SavedViewInvalidUpdate',
  message: '请求的更新无效'
})

export const SavedViewGroupNotFoundError = defineAuthError({
  code: 'SavedViewGroupNotFound',
  message: '未找到保存视图组'
})

export const UngroupedSavedViewGroupLockError = defineAuthError({
  code: 'UngroupedSavedViewGroupLock',
  message: '默认/未组分组不能修改'
})

export const DashboardsNotEnabledError = defineAuthError({
  code: 'DashboardsNotEnabled',
  message: '此服务器或工作空间未启用仪表板'
})

export const DashboardNotFoundError = defineAuthError({
  code: 'DashboardNotFound',
  message: '未找到看板'
})

export const DashboardNoProjectsError = defineAuthError({
  code: 'DashboardNoProjects',
  message: '看板未添加项目。您需要添加至少一个项目才能共享。'
})

export const DashboardProjectsNotEnoughPermissionsError = defineAuthError<
  'DashboardProjectsNotEnoughPermissions',
  {
    projectIds: string[]
  }
>({
  code: 'DashboardProjectsNotEnoughPermissions',
  message: '您没有足够的项目权限来执行此操作。'
})

export const DashboardNotOwnerError = defineAuthError({
  code: 'DashboardNotOwner',
  message: '您必须是看板所有者才能执行此操作'
})

// Resolve all exported error types
export type AllAuthErrors = ValueOf<{
  [key in keyof typeof import('./authErrors.js')]: typeof import('./authErrors.js')[key] extends new (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => infer R
    ? R
    : never
}>
