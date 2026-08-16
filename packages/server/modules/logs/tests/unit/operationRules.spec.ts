import { expect } from 'chai'
import { matchOperationRule } from '@/modules/logs/rest/operationRules'

const gql = (operationName: string, variables: Record<string, any> = {}) =>
  matchOperationRule({
    path: '/graphql',
    method: 'POST',
    operationName,
    variables,
    body: { operationName, variables }
  })

const rest = (path: string, method: string, body: Record<string, any> = {}) =>
  matchOperationRule({ path, method, operationName: null, variables: {}, body })

describe('operationRules - GraphQL 操作', () => {
  it('识别新增质量验收记录 (CreateQualityAcceptanceForm)', () => {
    const match = gql('CreateQualityAcceptanceForm', {
      input: {
        inspectionLotNumber: 'JY-2026-001',
        acceptancePart: '3F-A区',
        workVolume: 120.5,
        unit: 'm³'
      }
    })
    expect(match?.opType).to.equal('检验批新增')
    expect(match?.module).to.equal('质量验收')
    expect(match?.target).to.contain('JY-2026-001')
    expect(match?.action).to.equal('quality.inspection.create')
  })

  it('识别删除项目 (DeleteProject)', () => {
    const match = gql('DeleteProject', { id: 'project-1' })
    expect(match?.opType).to.equal('项目删除')
    expect(match?.module).to.equal('项目管理')
    expect(match?.target).to.equal('project-1')
    expect(match?.action).to.equal('project.project.delete')
  })

  it('识别批量删除项目 (AdminPanelDeleteProject)', () => {
    const match = gql('AdminPanelDeleteProject', { ids: ['p1', 'p2', 'p3'] })
    expect(match?.opType).to.equal('项目批量删除')
    expect(match?.target).to.equal('项目数: 3')
  })

  it('识别删除模型版本 (DeleteVersions)', () => {
    const match = gql('DeleteVersions', {
      input: { projectId: 'p1', versionIds: ['v1', 'v2'] }
    })
    expect(match?.opType).to.equal('版本删除')
    expect(match?.module).to.equal('文件管理')
    expect(match?.target).to.equal('版本数: 2')
    expect(match?.action).to.equal('project.model.version.delete')
  })

  it('识别版本移动 (MoveVersions) 与版本编辑 (UpdateVersion)', () => {
    const move = gql('MoveVersions', {
      input: { projectId: 'p1', targetModelName: '主楼', versionIds: ['v1'] }
    })
    expect(move?.opType).to.equal('版本移动')
    expect(move?.target).to.equal('主楼')

    const edit = gql('UpdateVersion', {
      input: { projectId: 'p1', versionId: 'v1', message: '修正钢筋量' }
    })
    expect(edit?.opType).to.equal('版本编辑')
    expect(edit?.target).to.equal('v1')
  })

  it('识别模型上传/删除/编辑 (CreateModel/DeleteModel/UpdateModel)', () => {
    expect(gql('CreateModel', { input: { name: '结构模型' } })?.opType).to.equal(
      '模型上传'
    )
    expect(gql('DeleteModel', { input: { id: 'm1' } })?.opType).to.equal('模型删除')
    expect(
      gql('UpdateModel', { input: { id: 'm1', name: '结构模型V2' } })?.opType
    ).to.equal('模型编辑')
  })

  it('识别创建项目 (CreateProject)', () => {
    const match = gql('CreateProject', {
      input: { name: '一号地块', contractCode: 'HT-001' }
    })
    expect(match?.opType).to.equal('创建项目')
    expect(match?.target).to.equal('一号地块')
  })

  it('识别检验批审批/删除与批量导入', () => {
    expect(
      gql('UpdateQualityAcceptanceForm', {
        input: { inspectionLotNumber: 'JY-001', workVolume: 10, unit: 'm' }
      })?.opType
    ).to.equal('检验批审批')
    expect(
      gql('DeleteQualityAcceptanceForm', { input: { id: 'qa1' } })?.opType
    ).to.equal('模型删除')
    expect(
      gql('ImportQualityAcceptanceForms', { input: { items: [{}, {}] } })?.opType
    ).to.equal('清单导入')
  })

  it('识别协同批注相关操作', () => {
    expect(
      gql('CreateCommentThread', { input: { resourceIdString: 'obj-1' } })?.opType
    ).to.equal('协同批注')
    expect(gql('CreateCommentReply', { input: { threadId: 't1' } })?.action).to.equal(
      'collaboration.comment.reply'
    )
    expect(gql('ArchiveComment', { input: { commentId: 'c1' } })?.action).to.equal(
      'collaboration.comment.archive'
    )
  })

  it('未命中规则时返回 null（未知 GraphQL 操作）', () => {
    expect(gql('SomeUnknownMutation')).to.equal(null)
  })
})

describe('operationRules - REST 操作', () => {
  it('识别用户登录', () => {
    const match = rest('/auth/local/login', 'POST', { email: 'a@b.com' })
    expect(match?.opType).to.equal('用户登录')
    expect(match?.module).to.equal('系统')
    expect(match?.action).to.equal('system.user.login')
  })

  it('识别质量验收 Excel 导入/导出', () => {
    expect(
      rest('/api/v1/projects/p1/quality-acceptance/forms/import-excel', 'POST')?.opType
    ).to.equal('清单编辑')
    expect(
      rest('/api/v1/projects/p1/quality-acceptance/forms/export-excel?search=x', 'GET')
        ?.opType
    ).to.equal('数据导出')
  })

  it('识别模型版本发布 (models/upload)', () => {
    const match = rest('/api/v1/projects/p1/models/upload/rvt/主体结构', 'POST')
    expect(match?.opType).to.equal('版本发布')
    expect(match?.target).to.equal('主体结构')
  })

  it('识别资料档案 上传/编辑/删除', () => {
    expect(rest('/api/projects/p1/files/upload', 'POST')?.opType).to.equal('档案上传')
    expect(rest('/api/projects/p1/files/f1', 'PUT')?.opType).to.equal('档案编辑')
    expect(rest('/api/projects/p1/files/f1', 'DELETE')?.opType).to.equal('档案删除')
  })

  it('识别月度验工 新增/编辑/删除/提交/同步/调整/拨款/移除验收单/关联措施', () => {
    expect(
      rest('/api/v1/projects/p1/monthly-measurements', 'POST', { roundName: '1月' })
        ?.opType
    ).to.equal('验工新增')
    expect(rest('/api/v1/projects/p1/monthly-measurements/m1', 'PUT')?.opType).to.equal(
      '验工编辑'
    )
    expect(
      rest('/api/v1/projects/p1/monthly-measurements/m1', 'DELETE')?.opType
    ).to.equal('验工删除')
    expect(
      rest('/api/v1/projects/p1/monthly-measurements/m1/submit', 'POST')?.opType
    ).to.equal('验工提交')
    expect(
      rest('/api/v1/projects/p1/monthly-measurements/m1/sync', 'POST')?.opType
    ).to.equal('预算同步')
    expect(
      rest('/api/v1/projects/p1/monthly-measurements/m1/acceptance', 'PATCH')?.opType
    ).to.equal('验工调整')
    expect(
      rest('/api/v1/projects/p1/monthly-measurements/m1/payment-details', 'PATCH')
        ?.opType
    ).to.equal('拨款编辑')
    expect(
      rest('/api/v1/projects/p1/monthly-measurements/m1/payment-requests', 'PATCH')
        ?.opType
    ).to.equal('拨款编辑')
    expect(
      rest(
        '/api/v1/projects/p1/monthly-measurements/m1/quality-acceptance/qa1',
        'DELETE'
      )?.opType
    ).to.equal('验工调整')
    expect(
      rest(
        '/api/v1/projects/p1/monthly-measurements/m1/associate-safety-measure',
        'POST'
      )?.opType
    ).to.equal('措施关联')
  })

  it('识别安全文明措施费 新增/编辑/删除/提交', () => {
    expect(
      rest('/api/v1/projects/p1/safety-measures', 'POST', { name: '临边防护' })?.opType
    ).to.equal('措施新增')
    expect(rest('/api/v1/projects/p1/safety-measures/s1', 'PUT')?.opType).to.equal(
      '措施编辑'
    )
    expect(rest('/api/v1/projects/p1/safety-measures/s1', 'DELETE')?.opType).to.equal(
      '措施删除'
    )
    expect(
      rest('/api/v1/projects/p1/safety-measures/s1/submit', 'POST')?.opType
    ).to.equal('措施提交')
  })

  it('识别进度管理 计划任务/实际填报/月度计划', () => {
    expect(
      rest('/api/v1/projects/p1/progress/plan-tasks', 'POST', { name: '主体施工' })
        ?.opType
    ).to.equal('进度计划更新')
    expect(rest('/api/v1/projects/p1/progress/plan-tasks/t1', 'PUT')?.opType).to.equal(
      '进度计划更新'
    )
    expect(
      rest('/api/v1/projects/p1/progress/plan-tasks/t1', 'DELETE')?.opType
    ).to.equal('进度计划更新')
    expect(
      rest('/api/v1/projects/p1/progress/actual-records', 'POST')?.opType
    ).to.equal('进度填报')
    expect(
      rest('/api/v1/projects/p1/progress/actual-records/r1', 'PUT')?.opType
    ).to.equal('进度填报')
    expect(
      rest('/api/v1/projects/p1/progress/monthly-plans', 'POST', { code: 'MP-01' })
        ?.opType
    ).to.equal('月度计划新增')
    expect(
      rest('/api/v1/projects/p1/progress/monthly-plans/pl1', 'PUT')?.opType
    ).to.equal('月度计划编辑')
  })

  it('识别用户与角色管理', () => {
    expect(
      rest('/api/v1/organizations/users', 'POST', { name: '张三' })?.opType
    ).to.equal('用户新增')
    expect(
      rest('/api/v1/organizations/users/u1', 'PUT', { role: 'admin' })?.opType
    ).to.equal('角色授权')
    expect(rest('/api/v1/organizations/users/u1', 'DELETE')?.opType).to.equal(
      '用户删除'
    )
    expect(rest('/api/v1/custom-roles', 'POST', { name: '质检员' })?.opType).to.equal(
      '角色新增'
    )
    expect(rest('/api/v1/custom-roles/r1', 'PATCH', { name: '新名' })?.opType).to.equal(
      '权限变更'
    )
    expect(rest('/api/v1/custom-roles/r1', 'DELETE')?.opType).to.equal('角色取消')
    expect(
      rest('/api/v1/custom-roles/r1/users', 'POST', { userIds: ['u1'] })?.opType
    ).to.equal('成员添加')
    expect(rest('/api/v1/custom-roles/r1/users/u1', 'DELETE')?.opType).to.equal(
      '成员移除'
    )
  })

  it('预览/子接口等不应误命中为操作日志', () => {
    expect(rest('/api/v1/projects/p1/monthly-measurements/preview', 'POST')).to.equal(
      null
    )
    expect(
      rest('/api/v1/projects/p1/monthly-measurements/m1/sync-preview', 'POST')
    ).to.equal(null)
    expect(
      rest('/api/v1/projects/p1/progress/plan-tasks/t1/bim-association', 'DELETE')
    ).to.equal(null)
    expect(
      rest('/api/v1/projects/p1/progress/plan-tasks/t1/marker', 'DELETE')
    ).to.equal(null)
    expect(rest('/api/v1/projects/p1/monthly-measurements', 'GET')).to.equal(null)
  })
})

describe('operationRules - 路径快照回归保护', () => {
  it('GraphQL 请求以完整路径 /graphql 命中规则（防止 express 挂载点改写路径后全部失效）', () => {
    // 该用例复现曾导致所有 GraphQL 操作日志丢失的 bug：
    // finish 回调中 req.path 被挂载机制改写为 '/'，导致 path === '/graphql' 永不成立。
    const match = matchOperationRule({
      path: '/graphql',
      method: 'POST',
      operationName: 'DeleteVersions',
      variables: { input: { versionIds: ['v1'] } },
      body: {}
    })
    expect(match?.opType).to.equal('版本删除')
    expect(match).to.not.equal(null)
  })
})
