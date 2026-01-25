import { describe, it, expect } from "vitest";
import { getGalleryTileBgClass, getGalleryTileCardBaseClass, shouldShowGalleryTileFooter } from "@/lib/matrix/galleryTileStyle";

describe("gallery tile background", () => {
  it("returns oatmeal background for non-summary tabs", () => {
    expect(getGalleryTileBgClass("intents")).toBe("bg-[#efe3d4] hover:bg-[#e8dccb]");
    expect(getGalleryTileBgClass("queries")).toBe("bg-[#efe3d4] hover:bg-[#e8dccb]");
    expect(getGalleryTileBgClass("answers")).toBe("bg-[#efe3d4] hover:bg-[#e8dccb]");
  });

  it("returns transparent background for summary tab", () => {
    expect(getGalleryTileBgClass("summary")).toBe("bg-transparent hover:bg-white/40");
  });
});

describe("gallery tile layout", () => {
  it("uses gap-0 to keep footer inside card", () => {
    expect(getGalleryTileCardBaseClass()).toContain("gap-0");
  });

  it("shows footer only for answers tab", () => {
    expect(shouldShowGalleryTileFooter("summary")).toBe(false);
    expect(shouldShowGalleryTileFooter("intents")).toBe(false);
    expect(shouldShowGalleryTileFooter("queries")).toBe(false);
    expect(shouldShowGalleryTileFooter("answers")).toBe(true);
  });
});
