export type TimeSignature = { numerator: number; denominator: number };
export const defaultSignature: TimeSignature = { numerator: 4, denominator: 4 };
export function validSignature(value: TimeSignature) {
  return Number.isSafeInteger(value.numerator) && value.numerator > 0 && Number.isSafeInteger(value.denominator) && value.denominator > 0;
}
export function parseSignature(value: string): TimeSignature {
  if(value.split("/").length!==2)return defaultSignature;
  const [numerator, denominator] = value.split("/").map(Number);
  return validSignature({ numerator, denominator }) ? { numerator, denominator } : defaultSignature;
}
export function signatureTiming(value: TimeSignature, bpm: number) {
  return { cellsPerBar: value.numerator * 2, beatMs: 60000 / bpm * 4 / value.denominator };
}

/** Two equal editing cells per beat; quarter-note time keeps the same 40px scale. */
export function signatureGrid(value: TimeSignature) {
  const beatPx=160/value.denominator;
  return {beatPx,barPx:beatPx*value.numerator,cellPx:beatPx/2};
}
export function musicalGridBackground(value: TimeSignature, colors={bar:"var(--grid-bar)",beat:"var(--grid-beat)",cell:"var(--grid-cell)"}) {
  const {beatPx,barPx,cellPx}=signatureGrid(value);
  return `repeating-linear-gradient(to right,${colors.bar} 0 ${Math.min(1.5,barPx/3)}px,transparent ${Math.min(1.5,barPx/3)}px ${barPx}px),repeating-linear-gradient(to right,${colors.beat} 0 ${Math.min(1,beatPx/3)}px,transparent ${Math.min(1,beatPx/3)}px ${beatPx}px),repeating-linear-gradient(to right,${colors.cell} 0 ${Math.min(1,cellPx/3)}px,transparent ${Math.min(1,cellPx/3)}px ${cellPx}px)`;
}
export function rulerLabels(value: TimeSignature,width:number) {
  const {barPx}=signatureGrid(value);
  const stride=Math.max(1,Math.ceil(60/barPx));
  const spacing=barPx*stride;
  return Array.from({length:Math.ceil(width/spacing)},(_,index)=>({left:index*spacing,bar:index*stride+1}));
}
