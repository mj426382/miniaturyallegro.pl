/**
 * Catalogue of automatic generation styles.
 *
 * `prompt` is the English base prompt handed to the prompt-engineering model and
 * (as a fallback) directly to the image model. Image models are trained mostly on
 * English captions, so prompts are kept in English even though the UI is Polish.
 * `name`/`description` are shown to users.
 */
export interface GenerationStyle {
  id: string;
  name: string;
  description: string;
  prompt: string;
  /** Part of the default "starter" batch (cheapest way to see the most diverse results). */
  starter: boolean;
}

export const GENERATION_STYLES: GenerationStyle[] = [
  {
    id: 'white-bg',
    name: 'Białe tło',
    description: 'Czyste białe tło – zgodne z wymaganiami zdjęcia głównego Allegro.',
    starter: true,
    prompt:
      'Professional e-commerce packshot on a seamless pure white (#FFFFFF) background. Soft, even studio lighting, ' +
      'a subtle natural contact shadow under the product, product centred and filling about 80% of the square frame. ' +
      'No props, no additional objects, no gradients – the background must stay pure white to the edges, ' +
      'exactly like a marketplace main listing photo.',
  },
  {
    id: 'lifestyle-home',
    name: 'Lifestyle – wnętrze',
    description: 'Produkt w nowoczesnym, jasnym wnętrzu domowym.',
    starter: true,
    prompt:
      'Lifestyle product photograph in a bright, modern home interior that matches the product category. ' +
      'Natural window light, shallow depth of field with a softly blurred background, aspirational but realistic ' +
      'styling with at most one or two tasteful props that never cover the product.',
  },
  {
    id: 'dark-luxury',
    name: 'Ciemny luksus',
    description: 'Ciemne tło, dramatyczne światło, premium klimat.',
    starter: true,
    prompt:
      'Luxury product photograph on a dark charcoal or black background with dramatic, directional rim lighting, ' +
      'high contrast, subtle reflections on a glossy dark surface, premium editorial mood.',
  },
  {
    id: 'gradient-bg',
    name: 'Gradient',
    description: 'Elegancki gradient dopasowany do kolorystyki produktu.',
    starter: false,
    prompt:
      'Clean studio product photograph on a smooth, elegant two-tone gradient background whose colours complement ' +
      'the product palette, soft diffused lighting, gentle shadow, modern e-commerce look.',
  },
  {
    id: 'in-action',
    name: 'Produkt w użyciu',
    description: 'Realistyczna scena pokazująca zastosowanie produktu.',
    starter: false,
    prompt:
      'Photorealistic lifestyle scene showing the product being used in a realistic everyday situation that fits its ' +
      'purpose. If a person is shown, show only natural-looking hands interacting with the product; anatomy must be ' +
      'correct. Natural environment, dynamic but clean composition that keeps the product as the clear hero.',
  },
  {
    id: 'multi-angle',
    name: 'Wiele ujęć',
    description: 'Kolaż 3–4 ujęć produktu z różnych stron.',
    starter: false,
    prompt:
      'Professional e-commerce collage presenting the same product from 3-4 angles in a tidy grid layout: front view, ' +
      'side view, top or detail view and a close-up of a key feature. White or light-grey background, consistent studio ' +
      'lighting in every tile, thin even spacing between tiles. Every tile must show exactly this product – no variations.',
  },
];

export const STYLE_IDS = GENERATION_STYLES.map((s) => s.id);

export function getStyle(id: string): GenerationStyle | undefined {
  return GENERATION_STYLES.find((s) => s.id === id);
}

/** Resolves the default batch from env (DEFAULT_STYLE_IDS) or the `starter` flag. */
export function getDefaultStyleIds(envValue?: string): string[] {
  if (envValue) {
    const ids = envValue
      .split(',')
      .map((s) => s.trim())
      .filter((id) => STYLE_IDS.includes(id));
    if (ids.length) return ids;
  }
  return GENERATION_STYLES.filter((s) => s.starter).map((s) => s.id);
}
