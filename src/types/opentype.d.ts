// Minimale Typen für opentype.js 2.x (das Paket bringt keine eigenen mit).
declare module 'opentype.js' {
  export interface PathCommand {
    type: 'M' | 'L' | 'C' | 'Q' | 'Z';
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }

  export class BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isEmpty(): boolean;
  }

  export class Path {
    commands: PathCommand[];
    getBoundingBox(): BoundingBox;
  }

  export class Glyph {
    index: number;
    name?: string;
    unicode?: number;
    advanceWidth?: number;
    leftSideBearing?: number;
    path: Path;
    getBoundingBox(): BoundingBox;
  }

  export interface GlyphSet {
    get(index: number): Glyph | undefined;
    length: number;
  }

  export interface FvarAxis {
    tag: string;
    minValue: number;
    defaultValue: number;
    maxValue: number;
    name?: Record<string, string>;
  }

  export interface FvarInstance {
    name?: Record<string, string>;
    coordinates: Record<string, number>;
    postScriptNameID?: number;
  }

  export interface Os2Table {
    usWeightClass?: number;
    fsSelection?: number;
    sCapHeight?: number;
    sxHeight?: number;
    sTypoAscender?: number;
    sTypoDescender?: number;
  }

  export interface FontTables {
    os2?: Os2Table;
    head?: { macStyle?: number; unitsPerEm?: number };
    fvar?: { axes: FvarAxis[]; instances: FvarInstance[] };
    [table: string]: unknown;
  }

  export interface VariationManager {
    getTransform(glyph: Glyph, coords?: Record<string, number>): Glyph;
  }

  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    names: Record<string, Record<string, Record<string, string>>>;
    tables: FontTables;
    glyphs: GlyphSet;
    kerningPairs: Record<string, number>;
    variation?: VariationManager;
    position: {
      getKerningTables(script?: string, language?: string): unknown;
      getKerningValue(tables: unknown, leftIndex: number, rightIndex: number): number;
      getDefaultScriptName(): string;
    };
    charToGlyph(c: string): Glyph;
    charToGlyphIndex(c: string): number;
    getKerningValue(left: Glyph | number, right: Glyph | number): number;
    getEnglishName(name: string): string | undefined;
  }

  export function parse(buffer: ArrayBuffer, options?: { lowMemory?: boolean }): Font;
}
