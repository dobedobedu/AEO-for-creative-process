/**
 * Templates API
 *
 * GET /api/tenant/templates
 *
 * Returns a list of available industry templates from config/templates/.
 * Each template includes its _templateInfo metadata and full config.
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const templatesDir = join(process.cwd(), "config", "templates");
    const files = await readdir(templatesDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const templates = [];
    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(templatesDir, file), "utf-8");
        const parsed = JSON.parse(content);
        templates.push({
          _filename: file,
          ...parsed,
        });
      } catch {
        // Skip invalid template files
      }
    }

    return Response.json(templates);
  } catch (error) {
    console.error("[api/tenant/templates] Error loading templates:", error);
    return Response.json([], { status: 200 });
  }
}
