function getArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name) return argv[i + 1];
  }
  return undefined;
}

function parseSupabaseRef(url: string): string | null {
  const match = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1].toLowerCase() : null;
}

function run(): number {
  const previewUrl =
    getArg("--preview-url") ?? process.env.PREVIEW_SUPABASE_URL;
  const productionUrl =
    getArg("--production-url") ?? process.env.PRODUCTION_SUPABASE_URL;

  if (!previewUrl || !productionUrl) {
    console.error(
      "[deploy:precheck] Missing URLs. Pass --preview-url/--production-url or set PREVIEW_SUPABASE_URL and PRODUCTION_SUPABASE_URL."
    );
    return 2;
  }

  const previewRef = parseSupabaseRef(previewUrl);
  const productionRef = parseSupabaseRef(productionUrl);

  if (!previewRef || !productionRef) {
    console.error(
      "[deploy:precheck] Could not parse Supabase project ref from one or both URLs."
    );
    return 1;
  }

  if (previewRef === productionRef) {
    console.error(
      `[deploy:precheck] FAILED: preview and production share Supabase ref '${previewRef}'.`
    );
    return 1;
  }

  console.log(
    `[deploy:precheck] OK previewRef=${previewRef} productionRef=${productionRef}`
  );
  return 0;
}

process.exit(run());

export {};
