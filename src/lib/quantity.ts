const wholeQuantityTerms = new Set([
  "pc", "pcs", "piece", "pieces", "ea", "each",
  "packet", "packets", "pkt", "pkts", "pack", "packs",
  "carton", "cartons", "ctn", "ctns", "case", "cases", "box", "boxes",
  "bag", "bags", "sack", "sacks", "crate", "crates", "tray", "trays",
  "bottle", "bottles", "can", "cans", "jar", "jars", "dozen", "dozens",
  "roll", "rolls", "strip", "strips", "set", "sets", "pair", "pairs",
]);

/** Counted packages use whole quantities; measured units allow two decimal places. */
export function usesWholeQuantity(...unitLabels: string[]) {
  return unitLabels.some((label) => label.toLowerCase().split(/[^a-z0-9]+/).some((term) => wholeQuantityTerms.has(term)));
}
