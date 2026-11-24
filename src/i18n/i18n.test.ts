import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { EN } from './en';
import { t } from './index';
import { PRESETS } from '../config/presets';
import { REGIONS } from '../calendar/holidays';
import { LOCALES } from '../calendar/locale';
import { CATEGORY_LABELS } from '../fonts/registry';

const srcDir = join(__dirname, '..');

/** Alle Texte, die im Code als t('…') stehen. */
function collectKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !name.includes('.test.')) {
        const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const visit = (node: ts.Node) => {
          if (ts.isCallExpression(node) && node.expression.getText(sf) === 't') {
            const arg = node.arguments[0];
            if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) keys.set(arg.text, path);
          }
          ts.forEachChild(node, visit);
        };
        visit(sf);
      }
    }
  };
  walk(srcDir);
  return keys;
}

const needsTranslation = (text: string) => /[a-zäöüß]/.test(text);

describe('Englische Übersetzung', () => {
  it('deckt alle Texte im Code ab', () => {
    const missing = [...collectKeys().entries()].filter(([k]) => needsTranslation(k) && !(k in EN)).map(([k, f]) => `${k}  (${f})`);
    expect(missing).toEqual([]);
  });

  it('deckt Vorlagen, Regionen, Sprachen und Schriftkategorien ab', () => {
    const dynamic = [
      ...PRESETS.flatMap((p) => [p.name, p.description]),
      ...REGIONS.flatMap((r) => [r.label, r.group].filter(Boolean)),
      ...LOCALES.map((l) => l.label),
      ...Object.values(CATEGORY_LABELS),
    ];
    expect(dynamic.filter((k) => needsTranslation(k) && !(k in EN))).toEqual([]);
  });

  it('behält Platzhalter in den Übersetzungen bei', () => {
    for (const [de, en] of Object.entries(EN)) {
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(vars(en), de).toEqual(vars(de));
    }
  });

  it('ersetzt Platzhalter', () => {
    expect(t('{n} Dateien exportieren', { n: 12 })).toBe('12 Dateien exportieren');
  });
});
