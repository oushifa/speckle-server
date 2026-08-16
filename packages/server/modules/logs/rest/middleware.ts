import type { RequestHandler } from 'express'
import { buildBackendApiOperationEvent } from '@/modules/logs/services/events'
import { enqueueLogEvents } from '@/modules/logs/services/queue'
import { matchOperationRule } from '@/modules/logs/rest/operationRules'
import { moduleLogger } from '@/observability/logging'
import { db } from '@/db/knex'

const EXCLUDED_PATHS = new Set(['/api/v1/logs/events/batch', '/api/v1/server/version'])

const shouldSkipLogging = (path: string) => {
  if (EXCLUDED_PATHS.has(path)) return true
  return path.startsWith('/_/')
}

export const apiOperationLogMiddlewareFactory =
  (): RequestHandler => (req, res, next) => {
    /**
     * 请求路径必须在进入挂载点之前快照：express 的挂载机制（如 app.use('/graphql', ...)）
     * 会在处理请求时改写 req.url，导致 finish 回调里读取的 req.path 变成 '/'，
     * 使所有基于完整路径的匹配规则失效（GraphQL 操作日志因此全部丢失）。
     */
    const requestPath =
      req.path || (req.originalUrl || req.url || '/').split('?')[0] || '/'

    if (shouldSkipLogging(requestPath)) {
      return next()
    }

    const startTime = Date.now()

    res.on('finish', () => {
      // 异步后台非阻塞处理操作日志捕获
      void (async () => {
        try {
          const httpStatus = res.statusCode
          const isSuccess = httpStatus >= 200 && httpStatus < 400
          const userId = req.context?.userId

          // 仅拦截并记录执行成功的高价值业务操作日志
          if (!isSuccess) {
            // 如果操作失败，我们仍然记录原始的 API 监控日志
            const baseEvent = buildBackendApiOperationEvent({
              req,
              path: requestPath,
              durationMs: Date.now() - startTime,
              httpStatus
            })
            void enqueueLogEvents({ events: [baseEvent] })
            return
          }

          const match = matchOperationRule({
            path: requestPath,
            method: req.method,
            operationName: req.body?.operationName,
            variables: req.body?.variables || {},
            body: req.body || {}
          })

          // 构建原始事件
          const baseEvent = buildBackendApiOperationEvent({
            req,
            path: requestPath,
            durationMs: Date.now() - startTime,
            httpStatus
          })

          // 若命中业务规则，则重构为操作日志事件
          if (match) {
            let operatorDept = '项目部'
            let loginUserId: string | null = null
            // 联表获取操作用户的公司部门
            if (userId) {
              try {
                const user = await db('users').where({ id: userId }).first('company')
                if (user?.company) {
                  operatorDept = user.company
                }
              } catch (dbErr) {
                // 忽略数据库查询错误，保障服务的健壮度
              }
            } else if (match.opType === '用户登录' && req.body?.email) {
              try {
                const user = await db('users')
                  .where({ email: req.body.email.trim().toLowerCase() })
                  .first('id', 'company')
                if (user) {
                  loginUserId = user.id
                  if (user.company) {
                    operatorDept = user.company
                  }
                }
              } catch (dbErr) {
                // 忽略
              }
            }

            const customEvent = {
              ...baseEvent,
              who: {
                ...baseEvent.who,
                userId: loginUserId || baseEvent.who.userId
              },
              where: {
                ...baseEvent.where,
                module: match.module
              },
              what: {
                ...baseEvent.what,
                action: match.action,
                targetId: match.target,
                payloadSummary: match.detail
              },
              metadata: {
                opType: match.opType,
                operatorDept,
                target: match.target,
                detail: match.detail
              }
            }

            void enqueueLogEvents({ events: [customEvent] })
          } else {
            // 未命中，则默认记录标准 API 日志
            void enqueueLogEvents({ events: [baseEvent] })
          }
        } catch (err) {
          moduleLogger.error({ err }, 'Failed to enqueue backend api operation log')
        }
      })()
    })

    next()
  }
