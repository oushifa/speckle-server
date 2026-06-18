const knex = require('knex');
const config = require('./knexfile.js');

const db = knex(config.development || config);

async function run() {
  try {
    const tables = await db.raw("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    const names = tables.rows.map(r => r.tablename);
    console.log('Tables matching pattern:', names.filter(n => n.includes('approval') || n.includes('measure') || n.includes('flow')));
    
    if (names.includes('approval_flow_instances')) {
      const pendingFlows = await db('approval_flow_instances').select('*').limit(5);
      console.log('Pending Flows samples:', JSON.stringify(pendingFlows, null, 2));
    }
    if (names.includes('approval_flow_steps')) {
      const steps = await db('approval_flow_steps').select('*').limit(5);
      console.log('Approval flow steps samples:', JSON.stringify(steps, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await db.destroy();
  }
}

run();
