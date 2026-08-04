const { parseEmailList, isValidEmailList, EMAIL_RE } = require('../../functions/emailList');

describe('parseEmailList', () => {
  it('returns an empty array for falsy input', () => {
    expect(parseEmailList(undefined)).toEqual([]);
    expect(parseEmailList(null)).toEqual([]);
    expect(parseEmailList('')).toEqual([]);
  });

  it('splits on semicolons (Outlook-style paste)', () => {
    expect(parseEmailList('a@x.com; b@x.com')).toEqual(['a@x.com', 'b@x.com']);
  });

  it('splits on commas', () => {
    expect(parseEmailList('a@x.com, b@x.com')).toEqual(['a@x.com', 'b@x.com']);
  });

  it('splits on a mix of commas and semicolons', () => {
    expect(parseEmailList('a@x.com; b@x.com, c@x.com')).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
  });

  it('trims whitespace around each address', () => {
    expect(parseEmailList('  a@x.com  ;  b@x.com  ')).toEqual(['a@x.com', 'b@x.com']);
  });

  it('drops empty entries from trailing/double separators', () => {
    expect(parseEmailList('a@x.com;;b@x.com;')).toEqual(['a@x.com', 'b@x.com']);
  });

  it('coerces non-string input to a string first', () => {
    expect(parseEmailList(12345)).toEqual(['12345']);
  });
});

describe('isValidEmailList', () => {
  it('treats empty input as valid by default (optional field)', () => {
    expect(isValidEmailList('')).toBe(true);
    expect(isValidEmailList(undefined)).toBe(true);
  });

  it('treats empty input as invalid when requireNonEmpty is set', () => {
    expect(isValidEmailList('', { requireNonEmpty: true })).toBe(false);
  });

  it('accepts a single valid address', () => {
    expect(isValidEmailList('a@x.com')).toBe(true);
  });

  it('accepts multiple valid addresses separated by ; or ,', () => {
    expect(isValidEmailList('a@x.com; b@x.com, c@x.com')).toBe(true);
  });

  it('rejects if any address in the list is malformed', () => {
    expect(isValidEmailList('a@x.com; not-an-email')).toBe(false);
  });

  it('rejects an address with no domain', () => {
    expect(isValidEmailList('a@')).toBe(false);
  });

  it('rejects an address with no @', () => {
    expect(isValidEmailList('a.x.com')).toBe(false);
  });
});

describe('EMAIL_RE', () => {
  it('matches common valid address shapes', () => {
    expect(EMAIL_RE.test('bilal.it@seanetpk.com')).toBe(true);
    expect(EMAIL_RE.test('first.last+tag@sub.domain.co')).toBe(true);
  });

  it('rejects addresses with spaces', () => {
    expect(EMAIL_RE.test('bilal it@seanetpk.com')).toBe(false);
  });
});
