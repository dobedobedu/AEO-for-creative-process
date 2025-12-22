import { getDefaultSearchModels } from "@/lib/models/searchModels";

export async function GET() {
  return Response.json({ models: getDefaultSearchModels() });
}
