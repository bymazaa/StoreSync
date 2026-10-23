// Code 128 subset B: every value 0-105 as eleven modules (bar = 1, space = 0).
// Widths transcribed from the ISO pattern table and cross-checked against a second reference implementation.
const PATTERNS =
  "11011001100110011011001100110011010010011000100100011001000100110010011001000100110001001000110010011001001000" +
  "11001000100110001001001011001110010011011100100110011101011100110010011101100100111001101100111001011001011100" +
  "11001001110110111001001100111010011101101110111010011001110010110011100100110111011001001110011010011100110010" +
  "11011011000110110001101100011011010100011000100010110001000100011010110001000100011010001000110001011010001000" +
  "11000101000110001000101011011100010110001110100011011101011101100010111000110100011101101110111011011010001110" +
  "11000101110110111010001101110001011011101110111010110001110100011011100010110111011010001110110001011100011010" +
  "11101111010110010000101111000101010100110000101000011001001011000010010000110100001011001000010011010110010000" +
  "10110000100100110100001001100001010000110100100001100101100001001011001010000111101110101100001010010001111010" +
  "10100111100100101111001001001111010111100100100111101001001111001011110100100111100101001111001001011011011110" +
  "11011110110111101101101010111100010100011110100010111101011110100010111100010111101010001111010001010111011110" +
  "101111011101110101111011110101110110100001001101001000011010011100";

const START_B = 104;
const STOP = "1100011101011";
const MODULES = 11;

/** Code 128 subset B carries printable ASCII 32-126 only, so Bengali names can never be encoded. */
export function isCode128Encodable(value: string) {
  return value.length > 0 && value.length <= 60 && [...value].every((character) => character >= " " && character <= "~");
}

function patternOf(value: number) {
  return PATTERNS.slice(value * MODULES, value * MODULES + MODULES);
}

export function encodeCode128(value: string): string | null {
  if (!isCode128Encodable(value)) return null;
  const characters = [...value];
  const modules = [patternOf(START_B)];
  let checksum = START_B;
  characters.forEach((character, index) => {
    const encoded = character.charCodeAt(0) - 32;
    checksum += encoded * (index + 1);
    modules.push(patternOf(encoded));
  });
  modules.push(patternOf(checksum % 103), STOP);
  return modules.join("");
}

/** Bar rectangles as [x, width] module pairs, ready for an SVG with viewBox "0 0 &lt;length&gt; 100". */
export function code128Bars(value: string): { bars: [number, number][]; width: number } | null {
  const modules = encodeCode128(value);
  if (!modules) return null;
  const bars: [number, number][] = [];
  let index = 0;
  while (index < modules.length) {
    if (modules[index] !== "1") { index += 1; continue; }
    let end = index;
    while (end < modules.length && modules[end] === "1") end += 1;
    bars.push([index, end - index]);
    index = end;
  }
  return { bars, width: modules.length };
}
