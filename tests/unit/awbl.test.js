// The AWB check digit is the one part of the number that is derived rather
// than entered, so a regression here would silently mint numbers no airline
// accepts - and it would not show up until a shipment was rejected. These
// pin the rule described in functions/awbl.js.

const {
  checkDigitFor,
  buildNumber,
  formatNumber,
  parseEntry,
  generateSeries,
} = require('../../functions/awbl');

describe('checkDigitFor', () => {
  test('is the serial modulo 7', () => {
    expect(checkDigitFor('1000000')).toBe('1'); // 1000000 = 142857*7 + 1
    expect(checkDigitFor('1000001')).toBe('2');
    expect(checkDigitFor('1000006')).toBe('0'); // wraps
  });

  test('never produces 7, 8 or 9', () => {
    for (let serial = 1000000; serial < 1000200; serial++) {
      expect(['0', '1', '2', '3', '4', '5', '6']).toContain(checkDigitFor(serial));
    }
  });
});

describe('parseEntry', () => {
  test('accepts a valid prefix and 8-digit code', () => {
    expect(parseEntry('125', '10000001')).toEqual({ ok: true, prefix: '125', serial: 1000000 });
  });

  test('tolerates spacing and dashes in the code', () => {
    expect(parseEntry('125', '1000000-1').ok).toBe(true);
    expect(parseEntry(' 125 ', '1000000 1').ok).toBe(true);
  });

  test('rejects a wrong check digit, and spells out the corrected number', () => {
    const result = parseEntry('125', '10000009');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/should be 1, not 9/);
    // The message has to carry the fixed number, because the list it lands on
    // is worked through by operations staff, not developers.
    expect(result.error).toContain('125-10000001');
  });

  test('rejects a prefix that is not exactly 3 digits', () => {
    expect(parseEntry('12', '10000001').ok).toBe(false);
    expect(parseEntry('1256', '10000001').ok).toBe(false);
    expect(parseEntry('12A', '10000001').ok).toBe(false);
  });

  test('rejects a code that is not exactly 8 digits', () => {
    expect(parseEntry('125', '1000000').ok).toBe(false);
    expect(parseEntry('125', '100000012').ok).toBe(false);
  });
});

describe('generateSeries', () => {
  test('increments the serial and recomputes the check digit, wrapping 6 -> 0', () => {
    const rows = generateSeries('125', 1000000, 9).map((r) => r.awbNumber);
    expect(rows).toEqual([
      '12510000001',
      '12510000012',
      '12510000023',
      '12510000034',
      '12510000045',
      '12510000056',
      '12510000060', // check digit wraps back to 0, serial keeps counting
      '12510000071',
      '12510000082',
    ]);
  });

  test('every generated number carries its own valid check digit', () => {
    for (const row of generateSeries('125', 9999000, 100)) {
      expect(parseEntry(row.prefix, `${row.serial}${row.checkDigit}`).ok).toBe(true);
    }
  });

  test('zero pads short serials to 7 digits', () => {
    const [first] = generateSeries('125', 42, 1);
    expect(first.serial).toBe('0000042');
    expect(first.awbNumber).toHaveLength(11);
  });

  test('stops at the 7-digit ceiling rather than rolling over', () => {
    expect(generateSeries('125', 9999998, 10)).toHaveLength(2);
  });

  test('defaults to a single number when count is missing or invalid', () => {
    expect(generateSeries('125', 1000000)).toHaveLength(1);
    expect(generateSeries('125', 1000000, 0)).toHaveLength(1);
  });
});

describe('formatNumber / buildNumber', () => {
  test('builds and displays the standard 3 + 8 grouping', () => {
    expect(buildNumber('125', 1000000)).toBe('12510000001');
    expect(formatNumber('12510000001')).toBe('125-10000001');
  });
});
