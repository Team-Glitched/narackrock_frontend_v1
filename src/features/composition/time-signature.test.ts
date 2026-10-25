import test from "node:test";
import assert from "node:assert/strict";
import {parseSignature,signatureTiming,validSignature,signatureGrid,rulerLabels} from "./time-signature.ts";
test("time signature changes bar grouping and metronome interval without changing tempo",()=>{
  assert.deepEqual(signatureTiming(parseSignature("4/4"),120),{cellsPerBar:8,beatMs:500});
  assert.deepEqual(signatureTiming(parseSignature("3/4"),120),{cellsPerBar:6,beatMs:500});
  assert.deepEqual(signatureTiming(parseSignature("6/8"),120),{cellsPerBar:12,beatMs:250});
  assert.deepEqual(signatureTiming(parseSignature("2/2"),120),{cellsPerBar:4,beatMs:1000});
});
test("invalid stored signatures fall back to common time",()=>{
  for(const value of ["0/4","-3/4","3/0","1.5/4","bad","3/4/5"]){assert.deepEqual(parseSignature(value),{numerator:4,denominator:4});}
  assert.equal(validSignature({numerator:12,denominator:8}),true);
});

test("uncommon signatures preserve arbitrary positive whole-number values",()=>{
  for(const value of [{numerator:31,denominator:16},{numerator:17,denominator:3},{numerator:999,denominator:128}]){
    assert.equal(validSignature(value),true);
    assert.deepEqual(parseSignature(`${value.numerator}/${value.denominator}`),value);
  }
});
test("beat separators share exact pixel spacing even between editing cells",()=>{
  assert.deepEqual(signatureGrid({numerator:4,denominator:4}),{beatPx:40,barPx:160,cellPx:20});
  assert.deepEqual(signatureGrid({numerator:7,denominator:16}),{beatPx:10,barPx:70,cellPx:5});
  const unusual=signatureGrid({numerator:17,denominator:3});
  assert.equal(unusual.barPx,unusual.beatPx*17);
  assert.deepEqual(rulerLabels({numerator:7,denominator:16},220),[{left:0,bar:1},{left:70,bar:2},{left:140,bar:3},{left:210,bar:4}]);
  assert.ok(rulerLabels({numerator:1,denominator:1000000},4800).length<=80);
});

test("17/3 beat and bar boundaries are exact editing-cell multiples",()=>{
  for(const denominator of [2,3,4,7,8,16,128]){
    const signature={numerator:17,denominator};
    const grid=signatureGrid(signature);
    assert.equal(grid.beatPx/grid.cellPx,2);
    assert.ok(Math.abs(grid.barPx/grid.cellPx-34)<1e-10);
    const stepTick=480*2/denominator;
    assert.ok(Math.abs(57600/stepTick*grid.cellPx-4800)<1e-8);
  }
});
