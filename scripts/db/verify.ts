import postgres from "postgres";

interface VerifyResult {
  ok: boolean;
  errors: string[];
}

function getArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name) {
      return argv[i + 1];
    }
  }
  return undefined;
}

function needsSsl(connectionString: string): boolean {
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

async function verify(databaseUrl: string): Promise<VerifyResult> {
  const errors: string[] = [];
  const sql = postgres(databaseUrl, {
    ssl: needsSsl(databaseUrl) ? "require" : undefined,
    max: 1,
  });

  try {
    const table = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name = 'tenant_config'
      limit 1
    `;

    if (table.length === 0) {
      errors.push("Missing required table: public.tenant_config");
    } else {
      const row = await sql`
        select id
        from tenant_config
        where id = 'default'
        limit 1
      `;
      if (row.length === 0) {
        errors.push("Missing required row: tenant_config id='default'");
      }
    }

    const trigger = await sql`
      select trigger_name
      from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'tenant_config'
        and trigger_name = 'update_tenant_config_updated_at'
      limit 1
    `;
    if (trigger.length === 0) {
      errors.push("Missing required trigger: update_tenant_config_updated_at on tenant_config");
    }

    const functions = await sql`
      select routine_name
      from information_schema.routines
      where specific_schema = 'public'
        and routine_name in ('update_updated_at_column', 'cleanup_old_progress')
    `;
    const found = new Set(functions.map((r) => r.routine_name as string));
    if (!found.has("update_updated_at_column")) {
      errors.push("Missing required function: update_updated_at_column");
    }
    if (!found.has("cleanup_old_progress")) {
      errors.push("Missing required function: cleanup_old_progress");
    }
  } catch (err) {
    errors.push(`Database verification failed: ${(err as Error).message}`);
  } finally {
    await sql.end();
  }

  return { ok: errors.length === 0, errors };
}

async function run(): Promise<number> {
  const databaseUrl = getArg("--database-url") ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[db:verify] DATABASE_URL is not set. Pass --database-url or set env.");
    return 2;
  }

  const result = await verify(databaseUrl);
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`[db:verify] error: ${error}`);
    }
    return 1;
  }

  console.log("[db:verify] OK");
  return 0;
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[db:verify] fatal: ${(err as Error).message}`);
    process.exit(1);
  });
