import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';

const GOLDEN_100 = [
  455919406, 4042750857, 4036713555, 1004527575, 3885174651, 3342903291, 1200158424, 1464636653, 858599751, 1533772857,
  1588364917, 2804846102, 2629854135, 3639905998, 1129121329, 1317854350, 1857894404, 800650182, 1181160799, 1583474889,
  2465686587, 2572438845, 3754282509, 3922419717, 3330689889, 669356150, 2120450157, 734341041, 3153928490, 633213104,
  642611803, 2070967565, 1806184245, 2994277565, 1123233215, 2684821912, 567144215, 1950572845, 2541762976, 681049526,
  3139393798, 3285473723, 733412874, 238776104, 478228544, 3111045937, 2184417353, 2020406364, 2907562377, 1307508074,
  29737198, 2078060100, 3766004413, 2465359464, 1037970931, 1464816512, 3063253257, 267572137, 1379816382, 3363951936,
  1933806962, 928369734, 3853434130, 1177016846, 1541433133, 189870532, 2763165555, 2728835283, 3361253436, 2518939451,
  333828763, 3974901352, 1630189901, 2789769504, 2976247789, 660991633, 2746958513, 4121873782, 712808560, 3803831375,
  3237830332, 4127562203, 1603770548, 3557410869, 3482312183, 686673607, 227068736, 705815157, 3840202038, 2109532304,
  191059969, 4110171112, 915045308, 740941049, 1466900026, 527778209, 2181379403, 404520251, 2252747056, 3196986872,
];

describe('REQ-002 seeded PRNG', () => {
  it('seed 0x12345678 produces the recorded golden 100 outputs', () => {
    const rng = createRng(0x12345678);
    const values = Array.from({ length: 100 }, () => rng.nextUint32());
    expect(values).toEqual(GOLDEN_100);
    expect(rng.state).toBe(3073374764);
  });

  it('same seed and same call sequence produce identical output', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 32 }, () => [a.nextUint32(), a.nextInt(6), a.nextInt(7)]);
    const seqB = Array.from({ length: 32 }, () => [b.nextUint32(), b.nextInt(6), b.nextInt(7)]);
    expect(seqA).toEqual(seqB);
  });

  it('nextInt(6) is unbiased over 60,000 samples', () => {
    const rng = createRng(7);
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60000; i += 1) counts[rng.nextInt(6)] += 1;
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(9000);
      expect(count).toBeLessThanOrEqual(11000);
    }
  });

  it('shuffle returns a new array and preserves the multiset', () => {
    const input = [1, 2, 2, 3, 4, 5, 5];
    const copy = input.slice();
    const rng = createRng(99);
    const shuffled = rng.shuffle(input);
    expect(input).toEqual(copy);
    expect(shuffled).not.toBe(input);
    expect(shuffled.slice().sort()).toEqual(copy.slice().sort());
  });
});
