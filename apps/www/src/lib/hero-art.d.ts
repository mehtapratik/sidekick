export type HeroArtType =
   | "Frame stack"
   | "Requirement grid"
   | "Branch"
   | "Gantt"
   | "Radar"
   | "Lattice"
   | "Scatter"
   | "Contour"
   | "Margin"
   | "Drift";

export type HeroArtPalette = {
   ink: string;
   accent: string;
   paper: string;
};

export function renderHeroSVG(
   type: HeroArtType,
   seed: string,
   width: number,
   palette: HeroArtPalette,
): string;

export const HERO_ART_PALETTES: {
   light: HeroArtPalette;
   dark: HeroArtPalette;
};
