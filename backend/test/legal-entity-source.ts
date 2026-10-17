import * as fs from 'fs';
import * as path from 'path';

/**
 * Reads the string fields of LEGAL_ENTITY from the landing page's legal source (the data users see in the
 * terms and the privacy policy). Tests compare the backend's e-mail footer against it, so the two cannot drift.
 */
export function landingLegalEntity(): Record<'name' | 'address' | 'nip' | 'email', string> {
  const file = path.resolve(__dirname, '../../landing-page/src/legal/entity.ts');
  const source = fs.readFileSync(file, 'utf-8');
  const block = source.match(/export const LEGAL_ENTITY = \{([\s\S]*?)\n\}/)?.[1];
  if (!block) throw new Error('LEGAL_ENTITY not found in landing-page/src/legal/entity.ts');
  const field = (name: string) => {
    const value = block.match(new RegExp(`\\n\\s*${name}: '([^']*)'`))?.[1];
    if (value === undefined) throw new Error(`LEGAL_ENTITY.${name} not found`);
    return value;
  };
  return { name: field('name'), address: field('address'), nip: field('nip'), email: field('email') };
}
