import { describe, expect, it } from 'vitest';
import {
  calculateBuyer,
  calculateEstimate,
  calculateInstance,
  getBillableMs,
  getBuyerBillableMs,
  pauseHourlyBilling,
  removeHourlyAccount,
  setHourlyAccountActive,
  startHourlyBilling,
} from './calculator';
import { LEGENDS_EXP_TO_LEVEL, expGainedBetween, expToLevel, rawExpAt } from './expTable';
import { encodeInstances, migrateV5Instances, normalizeInstances } from './persistence';
import type { CharacterSnapshot, HourlyBilling, HourlyLedger, LeechBuyer, LeechInstance } from './types';

function snapshot(level: number, expPercent: number, capturedAt = '2026-06-09T00:00:00.000Z'): CharacterSnapshot {
  return {
    ign: 'Buyer',
    level,
    expPercent,
    capturedAt,
    source: 'manual',
  };
}

function buyer(start?: CharacterSnapshot, current?: CharacterSnapshot): LeechBuyer {
  return {
    id: 0,
    ign: 'Buyer',
    start,
    current,
  };
}

function ratioInstance(testBuyer: LeechBuyer): LeechInstance {
  return {
    id: 'leech-test',
    name: 'Leech #1',
    billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] },
    buyers: [testBuyer],
    nextBuyerId: 1,
    createdAt: '2026-06-09T00:00:00.000Z',
  };
}

function hourlyBilling(ledger: HourlyLedger = { status: 'paused', accumulatedMs: 0, accounts: {} }): HourlyBilling {
  return {
    type: 'hourly' as const,
    hourlyRateMesos: 12_000_000,
    ledger,
  };
}

const LEGENDS_EXP_TABLE_REFERENCE = [
  { level: 1, expToLevel: 15, accumulatedExp: 0 },
  { level: 2, expToLevel: 34, accumulatedExp: 15 },
  { level: 3, expToLevel: 57, accumulatedExp: 49 },
  { level: 4, expToLevel: 92, accumulatedExp: 106 },
  { level: 5, expToLevel: 135, accumulatedExp: 198 },
  { level: 6, expToLevel: 372, accumulatedExp: 333 },
  { level: 7, expToLevel: 560, accumulatedExp: 705 },
  { level: 8, expToLevel: 840, accumulatedExp: 1_265 },
  { level: 9, expToLevel: 1_242, accumulatedExp: 2_105 },
  { level: 10, expToLevel: 1_716, accumulatedExp: 3_347 },
  { level: 11, expToLevel: 2_360, accumulatedExp: 5_063 },
  { level: 12, expToLevel: 3_216, accumulatedExp: 7_423 },
  { level: 13, expToLevel: 4_200, accumulatedExp: 10_639 },
  { level: 14, expToLevel: 5_460, accumulatedExp: 14_839 },
  { level: 15, expToLevel: 7_050, accumulatedExp: 20_299 },
  { level: 16, expToLevel: 8_840, accumulatedExp: 27_349 },
  { level: 17, expToLevel: 11_040, accumulatedExp: 36_189 },
  { level: 18, expToLevel: 13_716, accumulatedExp: 47_229 },
  { level: 19, expToLevel: 16_680, accumulatedExp: 60_945 },
  { level: 20, expToLevel: 20_216, accumulatedExp: 77_625 },
  { level: 21, expToLevel: 24_402, accumulatedExp: 97_841 },
  { level: 22, expToLevel: 28_980, accumulatedExp: 122_243 },
  { level: 23, expToLevel: 34_320, accumulatedExp: 151_223 },
  { level: 24, expToLevel: 40_512, accumulatedExp: 185_543 },
  { level: 25, expToLevel: 47_216, accumulatedExp: 226_055 },
  { level: 26, expToLevel: 54_900, accumulatedExp: 273_271 },
  { level: 27, expToLevel: 63_666, accumulatedExp: 328_171 },
  { level: 28, expToLevel: 73_080, accumulatedExp: 391_837 },
  { level: 29, expToLevel: 83_720, accumulatedExp: 464_917 },
  { level: 30, expToLevel: 95_700, accumulatedExp: 548_637 },
  { level: 31, expToLevel: 108_480, accumulatedExp: 644_337 },
  { level: 32, expToLevel: 122_760, accumulatedExp: 752_817 },
  { level: 33, expToLevel: 138_666, accumulatedExp: 875_577 },
  { level: 34, expToLevel: 155_540, accumulatedExp: 1_014_243 },
  { level: 35, expToLevel: 174_216, accumulatedExp: 1_169_783 },
  { level: 36, expToLevel: 194_832, accumulatedExp: 1_343_999 },
  { level: 37, expToLevel: 216_600, accumulatedExp: 1_538_831 },
  { level: 38, expToLevel: 240_500, accumulatedExp: 1_755_431 },
  { level: 39, expToLevel: 266_682, accumulatedExp: 1_995_931 },
  { level: 40, expToLevel: 294_216, accumulatedExp: 2_262_613 },
  { level: 41, expToLevel: 324_240, accumulatedExp: 2_556_829 },
  { level: 42, expToLevel: 356_916, accumulatedExp: 2_881_069 },
  { level: 43, expToLevel: 391_160, accumulatedExp: 3_237_985 },
  { level: 44, expToLevel: 428_280, accumulatedExp: 3_629_145 },
  { level: 45, expToLevel: 468_450, accumulatedExp: 4_057_425 },
  { level: 46, expToLevel: 510_420, accumulatedExp: 4_525_875 },
  { level: 47, expToLevel: 555_680, accumulatedExp: 5_036_295 },
  { level: 48, expToLevel: 604_416, accumulatedExp: 5_591_975 },
  { level: 49, expToLevel: 655_200, accumulatedExp: 6_196_391 },
  { level: 50, expToLevel: 709_716, accumulatedExp: 6_851_591 },
  { level: 51, expToLevel: 748_608, accumulatedExp: 7_561_307 },
  { level: 52, expToLevel: 789_631, accumulatedExp: 8_309_915 },
  { level: 53, expToLevel: 832_902, accumulatedExp: 9_099_546 },
  { level: 54, expToLevel: 878_545, accumulatedExp: 9_932_448 },
  { level: 55, expToLevel: 926_689, accumulatedExp: 10_810_993 },
  { level: 56, expToLevel: 977_471, accumulatedExp: 11_737_682 },
  { level: 57, expToLevel: 1_031_036, accumulatedExp: 12_715_153 },
  { level: 58, expToLevel: 1_087_536, accumulatedExp: 13_746_189 },
  { level: 59, expToLevel: 1_147_132, accumulatedExp: 14_833_725 },
  { level: 60, expToLevel: 1_209_994, accumulatedExp: 15_980_857 },
  { level: 61, expToLevel: 1_276_301, accumulatedExp: 17_190_851 },
  { level: 62, expToLevel: 1_346_242, accumulatedExp: 18_467_152 },
  { level: 63, expToLevel: 1_420_016, accumulatedExp: 19_813_394 },
  { level: 64, expToLevel: 1_497_832, accumulatedExp: 21_233_410 },
  { level: 65, expToLevel: 1_579_913, accumulatedExp: 22_731_242 },
  { level: 66, expToLevel: 1_666_492, accumulatedExp: 24_311_155 },
  { level: 67, expToLevel: 1_757_815, accumulatedExp: 25_977_647 },
  { level: 68, expToLevel: 1_854_143, accumulatedExp: 27_735_462 },
  { level: 69, expToLevel: 1_955_750, accumulatedExp: 29_589_605 },
  { level: 70, expToLevel: 2_062_925, accumulatedExp: 31_545_355 },
  { level: 71, expToLevel: 2_175_973, accumulatedExp: 33_608_280 },
  { level: 72, expToLevel: 2_295_216, accumulatedExp: 35_784_253 },
  { level: 73, expToLevel: 2_420_993, accumulatedExp: 38_079_469 },
  { level: 74, expToLevel: 2_553_663, accumulatedExp: 40_500_462 },
  { level: 75, expToLevel: 2_693_603, accumulatedExp: 43_054_125 },
  { level: 76, expToLevel: 2_841_212, accumulatedExp: 45_747_728 },
  { level: 77, expToLevel: 2_996_910, accumulatedExp: 48_588_940 },
  { level: 78, expToLevel: 3_161_140, accumulatedExp: 51_585_850 },
  { level: 79, expToLevel: 3_334_370, accumulatedExp: 54_746_990 },
  { level: 80, expToLevel: 3_517_093, accumulatedExp: 58_081_360 },
  { level: 81, expToLevel: 3_709_829, accumulatedExp: 61_598_453 },
  { level: 82, expToLevel: 3_913_127, accumulatedExp: 65_308_282 },
  { level: 83, expToLevel: 4_127_566, accumulatedExp: 69_221_409 },
  { level: 84, expToLevel: 4_353_756, accumulatedExp: 73_348_975 },
  { level: 85, expToLevel: 4_592_341, accumulatedExp: 77_702_731 },
  { level: 86, expToLevel: 4_844_001, accumulatedExp: 82_295_072 },
  { level: 87, expToLevel: 5_109_452, accumulatedExp: 87_139_073 },
  { level: 88, expToLevel: 5_389_449, accumulatedExp: 92_248_525 },
  { level: 89, expToLevel: 5_684_790, accumulatedExp: 97_637_974 },
  { level: 90, expToLevel: 5_996_316, accumulatedExp: 103_322_764 },
  { level: 91, expToLevel: 6_324_914, accumulatedExp: 109_319_080 },
  { level: 92, expToLevel: 6_671_519, accumulatedExp: 115_643_994 },
  { level: 93, expToLevel: 7_037_118, accumulatedExp: 122_315_513 },
  { level: 94, expToLevel: 7_422_752, accumulatedExp: 129_352_631 },
  { level: 95, expToLevel: 7_829_518, accumulatedExp: 136_775_383 },
  { level: 96, expToLevel: 8_258_575, accumulatedExp: 144_604_901 },
  { level: 97, expToLevel: 8_711_144, accumulatedExp: 152_863_476 },
  { level: 98, expToLevel: 9_188_514, accumulatedExp: 161_574_620 },
  { level: 99, expToLevel: 9_692_044, accumulatedExp: 170_763_134 },
  { level: 100, expToLevel: 10_223_168, accumulatedExp: 180_455_178 },
  { level: 101, expToLevel: 10_783_397, accumulatedExp: 190_678_346 },
  { level: 102, expToLevel: 11_374_327, accumulatedExp: 201_461_743 },
  { level: 103, expToLevel: 11_997_640, accumulatedExp: 212_836_070 },
  { level: 104, expToLevel: 12_655_110, accumulatedExp: 224_833_710 },
  { level: 105, expToLevel: 13_348_610, accumulatedExp: 237_488_820 },
  { level: 106, expToLevel: 14_080_113, accumulatedExp: 250_837_430 },
  { level: 107, expToLevel: 14_851_703, accumulatedExp: 264_917_543 },
  { level: 108, expToLevel: 15_665_576, accumulatedExp: 279_769_246 },
  { level: 109, expToLevel: 16_524_049, accumulatedExp: 295_434_822 },
  { level: 110, expToLevel: 17_429_566, accumulatedExp: 311_958_871 },
  { level: 111, expToLevel: 18_384_706, accumulatedExp: 329_388_437 },
  { level: 112, expToLevel: 19_392_187, accumulatedExp: 347_773_143 },
  { level: 113, expToLevel: 20_454_878, accumulatedExp: 367_165_330 },
  { level: 114, expToLevel: 21_575_805, accumulatedExp: 387_620_208 },
  { level: 115, expToLevel: 22_758_159, accumulatedExp: 409_196_013 },
  { level: 116, expToLevel: 24_005_306, accumulatedExp: 431_954_172 },
  { level: 117, expToLevel: 25_320_796, accumulatedExp: 455_959_478 },
  { level: 118, expToLevel: 26_708_375, accumulatedExp: 481_280_274 },
  { level: 119, expToLevel: 28_171_993, accumulatedExp: 507_988_649 },
  { level: 120, expToLevel: 29_715_818, accumulatedExp: 536_160_642 },
  { level: 121, expToLevel: 31_344_244, accumulatedExp: 565_876_460 },
  { level: 122, expToLevel: 33_061_908, accumulatedExp: 597_220_704 },
  { level: 123, expToLevel: 34_873_700, accumulatedExp: 630_282_612 },
  { level: 124, expToLevel: 36_784_778, accumulatedExp: 665_156_312 },
  { level: 125, expToLevel: 38_800_583, accumulatedExp: 701_941_090 },
  { level: 126, expToLevel: 40_926_854, accumulatedExp: 740_741_673 },
  { level: 127, expToLevel: 43_169_645, accumulatedExp: 781_668_527 },
  { level: 128, expToLevel: 45_535_341, accumulatedExp: 824_838_172 },
  { level: 129, expToLevel: 48_030_677, accumulatedExp: 870_373_513 },
  { level: 130, expToLevel: 50_662_758, accumulatedExp: 918_404_190 },
  { level: 131, expToLevel: 53_439_077, accumulatedExp: 969_066_948 },
  { level: 132, expToLevel: 56_367_538, accumulatedExp: 1_022_506_025 },
  { level: 133, expToLevel: 59_456_479, accumulatedExp: 1_078_873_563 },
  { level: 134, expToLevel: 62_714_694, accumulatedExp: 1_138_330_042 },
  { level: 135, expToLevel: 66_151_459, accumulatedExp: 1_201_044_736 },
  { level: 136, expToLevel: 69_776_558, accumulatedExp: 1_267_196_195 },
  { level: 137, expToLevel: 73_600_313, accumulatedExp: 1_336_972_753 },
  { level: 138, expToLevel: 77_633_610, accumulatedExp: 1_410_573_066 },
  { level: 139, expToLevel: 81_887_931, accumulatedExp: 1_488_206_676 },
  { level: 140, expToLevel: 86_375_389, accumulatedExp: 1_570_094_607 },
  { level: 141, expToLevel: 91_108_760, accumulatedExp: 1_656_469_996 },
  { level: 142, expToLevel: 96_101_520, accumulatedExp: 1_747_578_756 },
  { level: 143, expToLevel: 101_367_883, accumulatedExp: 1_843_680_276 },
  { level: 144, expToLevel: 106_922_842, accumulatedExp: 1_945_048_159 },
  { level: 145, expToLevel: 112_782_213, accumulatedExp: 2_051_971_001 },
  { level: 146, expToLevel: 118_962_678, accumulatedExp: 2_164_753_214 },
  { level: 147, expToLevel: 125_481_832, accumulatedExp: 2_283_715_892 },
  { level: 148, expToLevel: 132_358_236, accumulatedExp: 2_409_197_724 },
  { level: 149, expToLevel: 139_611_467, accumulatedExp: 2_541_555_960 },
  { level: 150, expToLevel: 147_262_175, accumulatedExp: 2_681_167_427 },
  { level: 151, expToLevel: 155_332_142, accumulatedExp: 2_828_429_602 },
  { level: 152, expToLevel: 163_844_343, accumulatedExp: 2_983_761_744 },
  { level: 153, expToLevel: 172_823_012, accumulatedExp: 3_147_606_087 },
  { level: 154, expToLevel: 182_293_713, accumulatedExp: 3_320_429_099 },
  { level: 155, expToLevel: 192_283_408, accumulatedExp: 3_502_722_812 },
  { level: 156, expToLevel: 202_820_538, accumulatedExp: 3_695_006_220 },
  { level: 157, expToLevel: 213_935_103, accumulatedExp: 3_897_826_758 },
  { level: 158, expToLevel: 225_658_746, accumulatedExp: 4_111_761_861 },
  { level: 159, expToLevel: 238_024_845, accumulatedExp: 4_337_420_607 },
  { level: 160, expToLevel: 251_068_606, accumulatedExp: 4_575_445_452 },
  { level: 161, expToLevel: 264_827_165, accumulatedExp: 4_826_514_058 },
  { level: 162, expToLevel: 279_339_693, accumulatedExp: 5_091_341_223 },
  { level: 163, expToLevel: 294_647_508, accumulatedExp: 5_370_680_916 },
  { level: 164, expToLevel: 310_794_191, accumulatedExp: 5_665_328_424 },
  { level: 165, expToLevel: 327_825_712, accumulatedExp: 5_976_122_615 },
  { level: 166, expToLevel: 345_790_561, accumulatedExp: 6_303_948_327 },
  { level: 167, expToLevel: 364_739_883, accumulatedExp: 6_649_738_888 },
  { level: 168, expToLevel: 384_727_628, accumulatedExp: 7_014_478_771 },
  { level: 169, expToLevel: 405_810_702, accumulatedExp: 7_399_206_399 },
  { level: 170, expToLevel: 428_049_128, accumulatedExp: 7_805_017_101 },
  { level: 171, expToLevel: 451_506_220, accumulatedExp: 8_233_066_229 },
  { level: 172, expToLevel: 476_248_760, accumulatedExp: 8_684_572_449 },
  { level: 173, expToLevel: 502_347_192, accumulatedExp: 9_160_821_209 },
  { level: 174, expToLevel: 529_875_818, accumulatedExp: 9_663_168_401 },
  { level: 175, expToLevel: 558_913_012, accumulatedExp: 10_193_044_219 },
  { level: 176, expToLevel: 589_541_445, accumulatedExp: 10_751_957_231 },
  { level: 177, expToLevel: 621_848_316, accumulatedExp: 11_341_498_676 },
  { level: 178, expToLevel: 655_925_603, accumulatedExp: 11_963_346_992 },
  { level: 179, expToLevel: 691_870_326, accumulatedExp: 12_619_272_595 },
  { level: 180, expToLevel: 729_784_819, accumulatedExp: 13_311_142_921 },
  { level: 181, expToLevel: 769_777_027, accumulatedExp: 14_040_927_740 },
  { level: 182, expToLevel: 811_960_808, accumulatedExp: 14_810_704_767 },
  { level: 183, expToLevel: 856_456_260, accumulatedExp: 15_622_665_575 },
  { level: 184, expToLevel: 903_390_063, accumulatedExp: 16_479_121_835 },
  { level: 185, expToLevel: 952_895_838, accumulatedExp: 17_382_511_898 },
  { level: 186, expToLevel: 1_005_114_529, accumulatedExp: 18_335_407_736 },
  { level: 187, expToLevel: 1_060_194_805, accumulatedExp: 19_340_522_265 },
  { level: 188, expToLevel: 1_118_293_480, accumulatedExp: 20_400_717_070 },
  { level: 189, expToLevel: 1_179_575_962, accumulatedExp: 21_519_010_550 },
  { level: 190, expToLevel: 1_244_216_724, accumulatedExp: 22_698_586_512 },
  { level: 191, expToLevel: 1_312_399_800, accumulatedExp: 23_942_803_236 },
  { level: 192, expToLevel: 1_384_319_309, accumulatedExp: 25_255_203_036 },
  { level: 193, expToLevel: 1_460_180_007, accumulatedExp: 26_639_522_345 },
  { level: 194, expToLevel: 1_540_197_871, accumulatedExp: 28_099_702_352 },
  { level: 195, expToLevel: 1_624_600_714, accumulatedExp: 29_639_900_223 },
  { level: 196, expToLevel: 1_713_628_833, accumulatedExp: 31_264_500_937 },
  { level: 197, expToLevel: 1_807_535_693, accumulatedExp: 32_978_129_770 },
  { level: 198, expToLevel: 1_906_588_648, accumulatedExp: 34_785_665_463 },
  { level: 199, expToLevel: 2_011_069_705, accumulatedExp: 36_692_254_111 },
  { level: 200, expToLevel: 2_121_276_324, accumulatedExp: 38_703_323_816 },
] as const;

describe('embedded MapleLegends EXP table', () => {
  it('contains selected rows from the embedded Legends reference table', () => {
    expect(expToLevel(1)).toBe(15);
    expect(expToLevel(2)).toBe(34);
    expect(expToLevel(3)).toBe(57);
    expect(expToLevel(6)).toBe(372);
    expect(expToLevel(10)).toBe(1_716);
    expect(expToLevel(50)).toBe(709_716);
    expect(expToLevel(51)).toBe(748_608);
    expect(expToLevel(100)).toBe(10_223_168);
    expect(expToLevel(150)).toBe(147_262_175);
    expect(expToLevel(199)).toBe(2_011_069_705);
    expect(expToLevel(200)).toBe(2_121_276_324);
  });

  it('matches every EXP-to-level value in the Legends reference table', () => {
    expect(LEGENDS_EXP_TO_LEVEL).toEqual(
      LEGENDS_EXP_TABLE_REFERENCE.map((row) => row.expToLevel),
    );
  });

  it('contains accumulated EXP values matching Legends reference rows', () => {
    const rows = LEGENDS_EXP_TABLE_REFERENCE;

    expect(rows).toHaveLength(200);
    expect(rows[0]).toEqual({ level: 1, expToLevel: 15, accumulatedExp: 0 });
    expect(rows[49]).toEqual({ level: 50, expToLevel: 709_716, accumulatedExp: 6_851_591 });
    expect(rows[99]).toEqual({ level: 100, expToLevel: 10_223_168, accumulatedExp: 180_455_178 });
    expect(rows[149]).toEqual({ level: 150, expToLevel: 147_262_175, accumulatedExp: 2_681_167_427 });
    expect(rows[198]).toEqual({ level: 199, expToLevel: 2_011_069_705, accumulatedExp: 36_692_254_111 });
    expect(rows[199]).toEqual({ level: 200, expToLevel: 2_121_276_324, accumulatedExp: 38_703_323_816 });

    for (const row of rows) {
      expect(rawExpAt(row.level, 0)).toBe(row.accumulatedExp);
    }
  });
});

describe('EXP and billing math', () => {
  it('calculates gained EXP across levels and percentages', () => {
    expect(expGainedBetween(1, 50, 2, 50)).toBe(24.5);
  });

  it('calculates ratio-priced buyer cost using EXP per meso', () => {
    const testBuyer = buyer(snapshot(50, 0), snapshot(51, 0, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] });

    expect(result.expGained).toBe(709_716);
    expect(result.ratioMesosDue).toBeCloseTo(709_716 / 3.3);
  });

  it('splits ratio pricing when a buyer crosses a level tier', () => {
    const testBuyer = buyer(snapshot(50, 50), snapshot(51, 50, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, {
      type: 'ratio',
      expPerMesoRatio: 3,
      tiers: [{ minLevel: 51, expPerMesoRatio: 4 }],
    });

    expect(result.ratioMesosDue).toBeCloseTo((709_716 * 0.5) / 3 + (748_608 * 0.5) / 4);
  });

  it('uses all crossed tiers and starts a tier at zero percent of its threshold level', () => {
    const testBuyer = buyer(snapshot(50, 0), snapshot(53, 0, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, {
      type: 'ratio',
      expPerMesoRatio: 3,
      tiers: [
        { minLevel: 52, expPerMesoRatio: 5 },
        { minLevel: 51, expPerMesoRatio: 4 },
      ],
    });

    expect(result.ratioMesosDue).toBeCloseTo(709_716 / 3 + 748_608 / 4 + 789_631 / 5);
  });

  it('uses the tier ratio for a partial level that starts exactly at its threshold', () => {
    const testBuyer = buyer(snapshot(51, 0), snapshot(51, 25, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, {
      type: 'ratio',
      expPerMesoRatio: 3,
      tiers: [{ minLevel: 51, expPerMesoRatio: 4 }],
    });

    expect(result.ratioMesosDue).toBeCloseTo((748_608 * 0.25) / 4);
  });

  it('does not charge negative EXP when the current snapshot precedes the start snapshot', () => {
    const testBuyer = buyer(snapshot(51, 0), snapshot(50, 0, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, {
      type: 'ratio',
      expPerMesoRatio: 3,
      tiers: [{ minLevel: 51, expPerMesoRatio: 4 }],
    });

    expect(result.expGained).toBe(0);
    expect(result.ratioMesosDue).toBe(0);
  });

  it('calculates instance totals', () => {
    const instance = ratioInstance(buyer(snapshot(50, 0), snapshot(51, 0)));
    const result = calculateInstance(instance);

    expect(result.doneBuyerCount).toBe(0);
    expect(result.totalExpGained).toBe(709_716);
    expect(result.totalMesosDue).toBeCloseTo(709_716 / 3.3);
  });

  it('counts locked populated buyers as done', () => {
    const populatedBuyer = { ...buyer(snapshot(50, 0), snapshot(51, 0)), locked: true };
    const emptyBuyer = { ...buyer(), id: 1, ign: '', locked: true };
    const result = calculateInstance({
      ...ratioInstance(populatedBuyer),
      buyers: [populatedBuyer, emptyBuyer],
    });

    expect(result.buyerCount).toBe(1);
    expect(result.doneBuyerCount).toBe(1);
  });

  it('sums tiered buyer dues instead of applying one ratio to aggregate EXP', () => {
    const instance: LeechInstance = {
      ...ratioInstance(buyer(snapshot(50, 0), snapshot(51, 0))),
      billing: {
        type: 'ratio',
        expPerMesoRatio: 3,
        tiers: [{ minLevel: 51, expPerMesoRatio: 4 }],
      },
      buyers: [
        { ...buyer(snapshot(50, 0), snapshot(51, 0)), id: 1 },
        { ...buyer(snapshot(51, 0), snapshot(52, 0)), id: 2 },
      ],
      nextBuyerId: 3,
    };

    expect(calculateInstance(instance).totalMesosDue).toBeCloseTo(709_716 / 3 + 748_608 / 4);
  });

  it('estimates hourly cost from EPH and hourly rate', () => {
    const result = calculateEstimate({
      fromLevel: 50,
      fromExpPercent: 0,
      toLevel: 51,
      toExpPercent: 0,
      billingType: 'hourly',
      expPerMesoRatio: 3.3,
      hourlyRateMesos: 12_000_000,
      expPerHourMillions: 1.419432,
    });

    expect(result.expNeeded).toBe(709_716);
    expect(result.expectedDurationMs).toBeCloseTo(1_800_000);
    expect(result.hourlyMesosDue).toBeCloseTo(6_000_000);
  });

  it('splits running time and checkpoints a late join', () => {
    const start = Date.UTC(2026, 5, 9, 0, 0);
    let billing = startHourlyBilling(hourlyBilling(), [0], start);
    billing = setHourlyAccountActive(billing, 1, true, start + 1_800_000);

    expect(getBuyerBillableMs(billing, 0, start + 3_600_000)).toBe(2_700_000);
    expect(getBuyerBillableMs(billing, 1, start + 3_600_000)).toBe(900_000);
    expect(getBillableMs(billing.ledger, start + 3_600_000)).toBe(3_600_000);
  });

  it('pauses by finalizing shares and stops live projection', () => {
    const start = Date.UTC(2026, 5, 9, 0, 0);
    const running = startHourlyBilling(hourlyBilling(), [0], start);
    const paused = pauseHourlyBilling(running, start + 3_600_000);

    expect(paused.ledger.status).toBe('paused');
    expect(paused.ledger.checkpointAt).toBeUndefined();
    expect(getBuyerBillableMs(paused, 0, start + 7_200_000)).toBe(3_600_000);
  });

  it('deletes one account without redistributing remaining accrued time', () => {
    const start = Date.UTC(2026, 5, 9, 0, 0);
    const running = startHourlyBilling(hourlyBilling(), [0, 1], start);
    const beforeDelete = getBuyerBillableMs(running, 0, start + 3_600_000);
    const deleted = removeHourlyAccount(running, 1, start + 3_600_000);

    expect(getBuyerBillableMs(deleted, 0, start + 3_600_000)).toBe(beforeDelete);
    expect(deleted.ledger.accounts[1]).toBeUndefined();
    expect(getBuyerBillableMs(deleted, 0, start + 5_400_000)).toBe(3_600_000);
  });

  it('calculates due from accrued and live ledger milliseconds at the current rate', () => {
    const testBuyer = buyer(snapshot(50, 0));
    const billing = hourlyBilling({
      status: 'running',
      accumulatedMs: 1_800_000,
      checkpointAt: 1_000,
      accounts: { [testBuyer.id]: { accruedMs: 1_800_000, active: true } },
    });
    const result = calculateBuyer(testBuyer, billing, 1_801_000);

    expect(result.hourlyMesosDue).toBe(12_000_000);
  });

  it('migrates v5 overlapping sessions into stable ledger shares', () => {
    const now = Date.parse('2026-06-09T01:00:00.000Z');
    const migrated = migrateV5Instances([{
      id: 'legacy',
      name: 'Legacy',
      billing: {
        type: 'hourly',
        hourlyRateMesos: 12_000_000,
        timer: { status: 'running', accumulatedMs: 0, lastStartedAt: '2026-06-09T00:00:00.000Z' },
      },
      buyers: [
        { ...buyer(snapshot(50, 0)), id: 'buyer-test', hourly: { sessions: [{ startedAt: '2026-06-09T00:00:00.000Z' }] } },
        { ...buyer(snapshot(51, 0)), id: 'buyer-test-2', hourly: { sessions: [{ startedAt: '2026-06-09T00:30:00.000Z' }] } },
      ],
      createdAt: '2026-06-09T00:00:00.000Z',
    }], [], now);
    const billing = migrated[0].billing as HourlyBilling;

    expect(billing.ledger.accounts[0].accruedMs).toBe(2_700_000);
    expect(billing.ledger.accounts[1].accruedMs).toBe(900_000);
    expect(migrated[0].buyers.map((item) => item.id)).toEqual([0, 1]);
    expect(migrated[0].nextBuyerId).toBe(2);
    expect(billing.ledger.checkpointAt).toBe(now);
    expect(migrated[0].buyers[0]).not.toHaveProperty('hourly');
  });

  it('normalizes compact v6 ledgers', () => {
    const normalized = normalizeInstances([{
      i: 'v6', n: 'V6', b: { t: 'h', r: 12_000_000, l: { s: 'r', t: 500, c: 1_000, a: { 0: { m: 250, r: 1 } } } },
      u: [{ i: 0, n: 'Buyer' }], d: 1, c: Date.parse('2026-06-09T00:00:00.000Z'),
    }], []);

    expect(normalized[0].billing).toEqual(hourlyBilling({
      status: 'running', accumulatedMs: 500, checkpointAt: 1_000, accounts: { 0: { accruedMs: 250, active: true } },
    }));
  });

  it('preserves the numeric high-water mark and discards invalid buyer ids', () => {
    const normalized = normalizeInstances([{
      i: 'numeric-v6', n: 'Numeric V6', b: { t: 'r', r: 3.3 },
      u: [{ i: 2, n: 'First' }, { i: 2, n: 'Duplicate' }, { i: -1, n: 'Invalid' }],
      d: 10, c: Date.parse('2026-06-09T00:00:00.000Z'),
    }], []);

    expect(normalized[0].buyers.map((item) => item.id)).toEqual([2]);
    expect(normalized[0].nextBuyerId).toBe(10);
  });

  it('encodes hourly ledgers with compact keys and omits inactive flags', () => {
    const encoded = encodeInstances([{
      id: 'v6',
      name: 'V6',
      billing: hourlyBilling({
        status: 'running',
        accumulatedMs: 500,
        checkpointAt: 1_000,
        accounts: { 0: { accruedMs: 250, active: true }, 1: { accruedMs: 100, active: false } },
      }),
      buyers: [],
      nextBuyerId: 2,
      createdAt: '2026-06-09T00:00:00.000Z',
    }]) as Array<{ b: unknown }>;

    expect(encoded[0].b).toEqual({
      t: 'h',
      r: 12_000_000,
      l: { s: 'r', t: 500, c: 1_000, a: { 0: { m: 250, r: 1 }, 1: { m: 100 } } },
    });
  });

  it('encodes snapshots as tuples and hoists latest-known metadata onto the buyer', () => {
    const encoded = encodeInstances([{
      id: 'snapshot-tuples',
      name: 'Snapshot tuples',
      billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] },
      buyers: [{
        id: 0,
        ign: 'Buyer',
        start: {
          ign: 'Buyer', level: 120, expPercent: 10, job: 'Bishop', guild: 'OldGuild', fame: 10,
          capturedAt: '2026-06-09T00:00:00.123Z', source: 'api',
        },
        current: {
          ign: 'Buyer', level: 121, expPercent: 20, guild: 'NewGuild',
          capturedAt: '2026-06-09T01:00:00.456Z', source: 'manual',
        },
      }],
      nextBuyerId: 1,
      createdAt: '2026-06-09T00:00:00.000Z',
    }]) as Array<{ u: Array<Record<string, unknown>> }>;
    const storedBuyer = encoded[0].u[0];
    const decodedBuyer = normalizeInstances(encoded, [])[0].buyers[0];

    expect(storedBuyer).toMatchObject({
      i: 0, n: 'Buyer', j: 'Bishop', g: 'NewGuild',
      s: [120, 10, 0, 0],
      c: [121, 20, 3_600, 1],
    });
    expect(JSON.stringify(storedBuyer)).not.toContain('snapshot_');
    const legacyObjectBuyer = {
      i: 0, n: 'Buyer',
      s: { i: 'snapshot_550e8400-e29b-41d4-a716-446655440000', n: 'Buyer', l: 120, e: 10, j: 'Bishop', g: 'OldGuild', f: 10, t: Date.parse('2026-06-09T00:00:00.123Z'), s: 'a' },
      c: { i: 'snapshot_550e8400-e29b-41d4-a716-446655440000', n: 'Buyer', l: 121, e: 20, g: 'NewGuild', t: Date.parse('2026-06-09T01:00:00.456Z'), s: 'm' },
    };
    expect(JSON.stringify(storedBuyer).length).toBeLessThan(JSON.stringify(legacyObjectBuyer).length);
    expect(storedBuyer).not.toHaveProperty('f');
    expect(decodedBuyer.start).toMatchObject({ ign: 'Buyer', source: 'api' });
    expect(decodedBuyer.start).not.toMatchObject({ job: 'Bishop', guild: 'NewGuild' });
    expect(decodedBuyer.current).toMatchObject({ ign: 'Buyer', job: 'Bishop', guild: 'NewGuild', source: 'manual' });
    expect(decodedBuyer.current).not.toHaveProperty('fame', 10);
  });

  it('round-trips the complete compact v6 payload with epoch timestamps', () => {
    const start = {
      ign: 'SameIGN', level: 120, expPercent: 12.5,
      job: 'Bishop', guild: 'Guild', fame: 42,
      capturedAt: '2026-06-09T00:00:00.123Z', source: 'api' as const,
    };
    const original: LeechInstance = {
      id: 'run-id',
      name: 'Compact run',
      billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [{ minLevel: 120, expPerMesoRatio: 4.2 }] },
      inactiveBilling: {
        ratio: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [{ minLevel: 120, expPerMesoRatio: 4.2 }] },
        hourly: hourlyBilling({ status: 'paused', accumulatedMs: 500, accounts: { 0: { accruedMs: 250, active: false } } }),
      },
      buyers: [{ id: 0, ign: 'SameIGN', locked: true, start, current: { ...start, source: 'manual' } }],
      nextBuyerId: 1,
      createdAt: '2026-06-09T00:00:00.456Z',
      lastCurrentRefreshedAt: '2026-06-09T01:00:00.789Z',
    };
    const encoded = encodeInstances([original]) as Array<Record<string, unknown>>;
    const decoded = normalizeInstances(encoded, []);

    expect(Object.keys(encoded[0]).sort()).toEqual(['b', 'c', 'd', 'i', 'n', 'r', 'u', 'x']);
    expect(encoded[0].c).toBe(Math.floor(Date.parse(original.createdAt) / 1000));
    expect(encoded[0].r).toBe(3_600);
    expect(JSON.stringify(encoded).length).toBeLessThan(JSON.stringify([original]).length);
    expect(decoded[0]).toMatchObject({
      ...original,
      buyers: [{
        id: 0,
        ign: 'SameIGN',
        locked: true,
        start: {
          ign: 'SameIGN', level: 120, expPercent: 12.5,
          capturedAt: '2026-06-09T00:00:00.000Z', source: 'api',
          job: undefined, guild: undefined,
        },
        current: {
          ign: 'SameIGN', level: 120, expPercent: 12.5,
          capturedAt: '2026-06-09T00:00:00.000Z', source: 'manual',
          job: 'Bishop', guild: 'Guild',
        },
      }],
      createdAt: '2026-06-09T00:00:00.000Z',
      lastCurrentRefreshedAt: '2026-06-09T01:00:00.000Z',
    });
    expect(decoded[0].buyers[0].start).not.toHaveProperty('fame');
    expect(decoded[0].buyers[0].current).not.toHaveProperty('fame');
  });

  it('normalizes legacy and malformed ratio tier data', () => {
    const normalized = normalizeInstances([{
      i: 'ratio-tier-normalization', n: 'Ratio tiers',
      b: { t: 'r', r: 3.3, q: [[120, 4], [80.4, 3.5], [120, 4.2], ['invalid', 5]] },
      u: [], d: 0, c: 0,
    }, {
      i: 'ratio', n: 'Ratio', b: { t: 'r', r: 3.3 }, u: [], d: 0, c: 0,
    }], []);

    expect(normalized[0].billing).toEqual({
      type: 'ratio',
      expPerMesoRatio: 3.3,
      tiers: [
        { minLevel: 80, expPerMesoRatio: 3.5 },
        { minLevel: 120, expPerMesoRatio: 4.2 },
      ],
    });
    expect(normalized[1].billing).toEqual({ type: 'ratio', expPerMesoRatio: 3.3, tiers: [] });
  });

  it('converts a level and percentage to raw accumulated EXP', () => {
    expect(rawExpAt(50, 50)).toBe(6_851_591 + 709_716 * 0.5);
  });
});
