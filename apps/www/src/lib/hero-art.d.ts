export type HeroArtType =
   | "Essay"
   | "Blog"
   | "Core Drive"
   | "Plan"
   | "Decision"
   | "Build";

export type HeroArtPalette = {
   ink: string;
   accent: string;
   ochre: string;
   paper: string;
};

export function renderHeroSVG(
   type: HeroArtType,
   slug: string,
   width: number,
   palette: HeroArtPalette,
): string;

export const HERO_ART_PALETTES: {
   light: HeroArtPalette;
   dark: HeroArtPalette;
};
