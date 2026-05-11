import { db } from '@/db/knex'

async function run() {
  const instances = await db('approval_flow_instances')
    .where('resourceType', 'FORMS')
    .orderBy('updatedAt', 'desc')
    .limit(1)
  
  if (!instances.length) {
    console.log("No instances found")
    process.exit(0)
  }
  
  const instance = instances[0]
  console.log("Instance:", {
    id: instance.id,
    status: instance.status,
    currentStep: instance.currentStep,
    resourceId: instance.resourceId
  })
  
  const steps = await db('approval_flow_instance_steps')
    .where('instanceId', instance.id)
    .orderBy('stepIndex', 'asc')
    
  console.log("Steps:", steps.map(s => ({
    id: s.id,
    stepIndex: s.stepIndex,
    status: s.status,
    name: s.name
  })))
  
  const mm = await db('monthly_measurements')
    .where('id', instance.resourceId.split(':')[1])
    .first()
    
  console.log("Monthly Measurement:", {
    id: mm.id,
    approveStatus: mm.approveStatus
  })
  
  process.exit(0)
}

run().catch(console.error)
