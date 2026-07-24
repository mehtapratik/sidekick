import { renderHeroSVG, HERO_ART_PALETTES } from "./hero-art.js";
import { TYPE_TO_MOTIF, type PostType } from "./site";
import type { HeroArtType } from "./hero-art";

export function heroArt(
   type: PostType,
   seed: string,
   width: number,
): { light: string; dark: string } {
   const motif = TYPE_TO_MOTIF[type] as HeroArtType;
   return {
      light: renderHeroSVG(motif, seed, width, HERO_ART_PALETTES.light),
      dark: renderHeroSVG(motif, seed, width, HERO_ART_PALETTES.dark),
   };
}
