import { NextRequest, NextResponse } from "next/server";
import { getAllPersonas, getAllStages, saveDraftVersion, publishConfig } from "@/lib/matrix/db";
import { MatrixConfigSchema } from "@/lib/matrix/types";

// GET /api/matrix/config - Fetch all personas and stages (including inactive) for admin
export async function GET() {
  try {
    const [personas, stages] = await Promise.all([
      getAllPersonas(),
      getAllStages(),
    ]);

    return NextResponse.json({ personas, stages });
  } catch (error) {
    console.error("Error fetching matrix config:", error);
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

// PUT /api/matrix/config - Update matrix configuration (draft)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = MatrixConfigSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid configuration", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const config = validationResult.data;
    const versionId = await saveDraftVersion(config);

    return NextResponse.json({
      success: true,
      versionId,
      message: "Draft saved successfully"
    });
  } catch (error) {
    console.error("Error saving matrix config:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}

// POST /api/matrix/config/publish - Publish configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = MatrixConfigSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid configuration", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const config = validationResult.data;
    const versionId = await publishConfig(config);

    return NextResponse.json({
      success: true,
      versionId,
      message: "Configuration published successfully"
    });
  } catch (error) {
    console.error("Error publishing matrix config:", error);
    return NextResponse.json(
      { error: "Failed to publish configuration" },
      { status: 500 }
    );
  }
}
