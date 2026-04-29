import type { Knex } from 'knex'

const SYS_LOG_TABLE = 'sys_log'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS ${SYS_LOG_TABLE} (
      id TEXT NOT NULL,
      event_time TIMESTAMPTZ NOT NULL,
      source TEXT NOT NULL,
      user_id TEXT NULL,
      org_id TEXT NULL,
      user_role TEXT NULL,
      ip TEXT NULL,
      user_agent TEXT NULL,
      location JSONB NOT NULL DEFAULT '{}'::jsonb,
      action TEXT NOT NULL,
      target_type TEXT NULL,
      target_id TEXT NULL,
      payload_summary JSONB NULL,
      result_status TEXT NOT NULL,
      result_code TEXT NULL,
      result_message TEXT NULL,
      duration_ms INTEGER NULL,
      http_status INTEGER NULL,
      trace_id TEXT NULL,
      request_id TEXT NULL,
      metadata JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (id, event_time),
      CHECK (source IN ('frontend', 'backend')),
      CHECK (result_status IN ('success', 'fail', 'unknown'))
    ) PARTITION BY RANGE (event_time);
  `)

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_sys_log_event_time ON ${SYS_LOG_TABLE} (event_time DESC);
    CREATE INDEX IF NOT EXISTS idx_sys_log_user_id_event_time ON ${SYS_LOG_TABLE} (user_id, event_time DESC);
    CREATE INDEX IF NOT EXISTS idx_sys_log_action_event_time ON ${SYS_LOG_TABLE} (action, event_time DESC);
    CREATE INDEX IF NOT EXISTS idx_sys_log_result_status_event_time ON ${SYS_LOG_TABLE} (result_status, event_time DESC);
    CREATE INDEX IF NOT EXISTS idx_sys_log_trace_id ON ${SYS_LOG_TABLE} (trace_id);
  `)

  await knex.raw(`
    CREATE OR REPLACE FUNCTION sys_log_ensure_partition_for(p_event_time timestamptz)
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
      partition_name text := format('sys_log_%s', to_char(date_trunc('month', p_event_time), 'YYYYMM'));
      partition_start timestamptz := date_trunc('month', p_event_time);
      partition_end timestamptz := partition_start + interval '1 month';
    BEGIN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF sys_log FOR VALUES FROM (%L) TO (%L);',
        partition_name,
        partition_start,
        partition_end
      );
    END;
    $$;
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS sys_log_default PARTITION OF ${SYS_LOG_TABLE} DEFAULT;
    SELECT sys_log_ensure_partition_for(now());
    SELECT sys_log_ensure_partition_for(now() + interval '1 month');
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP FUNCTION IF EXISTS sys_log_ensure_partition_for(timestamptz);
    DROP TABLE IF EXISTS ${SYS_LOG_TABLE} CASCADE;
  `)
}
