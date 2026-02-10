export type GalleryTileTab = "summary" | "intents" | "queries" | "answers";

export function getGalleryTileBgClass(tab: GalleryTileTab): string {
  if (tab === "summary") {
    return "bg-transparent hover:bg-white/40";
  }
  return "bg-[#efe3d4] hover:bg-[#e8dccb]";
}

export function getGalleryTileCardBaseClass(): string {
  return "h-full border-brand-secondary hover:border-black/20 transition-all duration-300 rounded-none border-t-0 border-l-0 border-r-0 shadow-none p-5 flex flex-col gap-0";
}

export function shouldShowGalleryTileFooter(tab: GalleryTileTab): boolean {
  return tab === "answers";
}
