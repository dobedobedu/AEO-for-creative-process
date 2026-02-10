"use client";

import { useEffect } from "react";
import { useTenantConfig } from "@/lib/config/client";

/**
 * Injects brand colors from tenant config into CSS custom properties.
 * This enables dynamic theming without reloading the page.
 */
export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const { config } = useTenantConfig();

  useEffect(() => {
    if (!config?.brand?.highlightColor) return;

    const root = document.documentElement;
    const highlightColor = config.brand.highlightColor;

    // Convert hex to RGB for alpha support
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : null;
    };

    // Darken a hex color by a percentage
    const darkenColor = (hex: string, percent: number) => {
      const rgb = hexToRgb(hex);
      if (!rgb) return hex;
      const factor = 1 - percent / 100;
      const r = Math.round(rgb.r * factor);
      const g = Math.round(rgb.g * factor);
      const b = Math.round(rgb.b * factor);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    };

    // Lighten a hex color by a percentage
    const lightenColor = (hex: string, percent: number) => {
      const rgb = hexToRgb(hex);
      if (!rgb) return hex;
      const factor = percent / 100;
      const r = Math.round(rgb.r + (255 - rgb.r) * factor);
      const g = Math.round(rgb.g + (255 - rgb.g) * factor);
      const b = Math.round(rgb.b + (255 - rgb.b) * factor);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    };

    // Set brand colors based on highlight color
    // The highlight color becomes the brand primary
    root.style.setProperty("--brand-primary", highlightColor);
    root.style.setProperty("--brand-primary-light", lightenColor(highlightColor, 20));

    const rgb = hexToRgb(highlightColor);
    if (rgb) {
      root.style.setProperty("--brand-primary-muted", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
    }

    // Generate a highlight background (very light version)
    root.style.setProperty("--brand-highlight", lightenColor(highlightColor, 85));

  }, [config?.brand?.highlightColor]);

  return <>{children}</>;
}
