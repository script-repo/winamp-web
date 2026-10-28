// text.bmp glyph mapping (report O-21). Returns [srcX, srcY] of a 5x6 cell.
export function glyph(ch: string): [number, number] {
  const c = ch.charCodeAt(0) & 0xff;
  if (c >= 65 && c <= 90) return [(c - 65) * 5, 0];
  if (c >= 97 && c <= 122) return [(c - 97) * 5, 0];
  if (c >= 48 && c <= 57) return [(c - 48) * 5, 6];
  const row6: Record<string, number> = {
    '\x01': 50, '.': 55, ':': 60, '(': 65, ')': 70, '-': 75, "'": 80, '`': 80, '!': 85, '_': 90, '+': 95,
    '\\': 100, '/': 105, '[': 110, '{': 110, '<': 110, ']': 115, '}': 115, '>': 115, '~': 120, '^': 120,
    '&': 125, '%': 130, ',': 135, '=': 140, '$': 145, '#': 150,
  };
  if (ch in row6) return [row6[ch], 6];
  switch (c) {
    case 0xc5: case 0xe5: return [0, 12];   // Å å
    case 0xd6: case 0xf6: return [5, 12];   // Ö ö
    case 0xc4: case 0xe4: return [10, 12];  // Ä ä
    case 0x3f: return [15, 12];             // ?
    case 0x2a: return [20, 12];             // *
    case 0x22: return [130, 0];             // "
    case 0x40: return [135, 0];             // @
    // accented letters mapped to base letters (O-21)
    case 0x83: return [25, 0];
    case 0xb0: return [0, 6];
    case 0xc6: case 0xe0: case 0xe1: case 0xe2: case 0xe6: return [0, 0];
    case 0xc7: case 0xe7: return [10, 0];
    case 0xc9: case 0xe8: case 0xe9: case 0xea: case 0xeb: return [20, 0];
    case 0xec: case 0xed: case 0xee: case 0xef: return [40, 0];
    case 0xd1: case 0xf1: return [65, 0];
    case 0xf2: case 0xf3: case 0xf4: return [70, 0];
    case 0xdc: case 0xf9: case 0xfa: case 0xfb: case 0xfc: return [100, 0];
    case 0xff: return [120, 0];
  }
  return [150, 0]; // space / unknown
}
