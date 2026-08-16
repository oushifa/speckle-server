// 最小 mocha 配置：只跑进度计划 MPP 字段确认测试，不启动整个 app（不需要 Redis/Postgres）
module.exports = {
  spec: ['modules/progress/tests/unit/mppPlanFileImport.spec.ts'],
  slow: 0,
  timeout: '150000',
  exit: true
}
