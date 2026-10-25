import { authorName, toLedgerEntryDto } from './ledger.mapper.js';

describe('authorName', () => {
  it('joins first and last name', () => {
    expect(authorName({ firstName: 'Anna', lastName: 'Admin' })).toBe('Anna Admin');
  });

  it('returns the only name that is set', () => {
    expect(authorName({ firstName: 'Anna', lastName: null })).toBe('Anna');
    expect(authorName({ firstName: null, lastName: 'Admin' })).toBe('Admin');
  });

  it('returns null when both are missing', () => {
    expect(authorName({ firstName: null, lastName: null })).toBeNull();
  });

  it('treats blank strings as missing and trims the parts', () => {
    expect(authorName({ firstName: '  ', lastName: '' })).toBeNull();
    expect(authorName({ firstName: ' Anna ', lastName: ' ' })).toBe('Anna');
    expect(authorName({ firstName: ' Anna ', lastName: ' Admin ' })).toBe('Anna Admin');
  });
});

describe('toLedgerEntryDto', () => {
  const row = {
    id: 'entry-1',
    delta: 2,
    type: 'MANUAL_ADJUSTMENT' as const,
    comment: 'fix',
    createdAt: new Date('2026-10-25T10:00:00Z'),
    createdBy: { id: 'user-1', email: 'a@b.test', firstName: 'Anna', lastName: 'Admin' },
  };

  it('exposes createdBy as { id, email, name } and nothing else about the author', () => {
    const dto = toLedgerEntryDto(row);

    expect(dto.createdBy).toEqual({ id: 'user-1', email: 'a@b.test', name: 'Anna Admin' });
    expect(Object.keys(dto.createdBy).sort()).toEqual(['email', 'id', 'name']);
  });

  it('keeps the other entry fields unchanged', () => {
    const { createdBy: _ignored, ...rest } = toLedgerEntryDto(row);

    expect(rest).toEqual({
      id: 'entry-1',
      delta: 2,
      type: 'MANUAL_ADJUSTMENT',
      comment: 'fix',
      createdAt: row.createdAt,
    });
  });

  it('gives name null when the author has no name', () => {
    const dto = toLedgerEntryDto({ ...row, createdBy: { ...row.createdBy, firstName: null, lastName: null } });

    expect(dto.createdBy.name).toBeNull();
  });
});
