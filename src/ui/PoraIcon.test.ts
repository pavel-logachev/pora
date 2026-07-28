import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const forbiddenIconPlaceholders = ['□', '○', '▦', '≡', '‹', '›', '⇩', '◷', '＋'];

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')
      ? [path]
      : [];
  });
}

describe('application icon contract', () => {
  it('does not use font-dependent Unicode placeholders as interface icons', () => {
    const files = [join(process.cwd(), 'App.tsx'), ...tsxFiles(join(process.cwd(), 'src'))];
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return forbiddenIconPlaceholders
        .filter((glyph) => source.includes(glyph))
        .map((glyph) => `${file}: ${glyph}`);
    });

    expect(offenders).toEqual([]);
  });
});
