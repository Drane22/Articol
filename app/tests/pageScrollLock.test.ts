import { describe, expect, it } from 'vitest';
import { acquirePageScrollLock } from '../src/lib/pageScrollLock';

function fakeDocument(overflow = '') {
  return { body: { style: { overflow } } };
}

describe('page scroll lock lifecycle', () => {
  it('restores the exact pre-existing overflow value', () => {
    const documentLike = fakeDocument('clip');
    const release = acquirePageScrollLock(documentLike);

    expect(documentLike.body.style.overflow).toBe('hidden');
    release();
    expect(documentLike.body.style.overflow).toBe('clip');
  });

  it('keeps the page locked until every dialog releases it', () => {
    const documentLike = fakeDocument('auto');
    const releaseShare = acquirePageScrollLock(documentLike);
    const releaseMatch = acquirePageScrollLock(documentLike);

    releaseShare();
    expect(documentLike.body.style.overflow).toBe('hidden');

    releaseMatch();
    expect(documentLike.body.style.overflow).toBe('auto');
  });

  it('makes cleanup idempotent so interrupted exits cannot over-release', () => {
    const documentLike = fakeDocument();
    const release = acquirePageScrollLock(documentLike);

    release();
    release();

    expect(documentLike.body.style.overflow).toBe('');
  });
});
