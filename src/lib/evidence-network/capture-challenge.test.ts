import { describe, expect, it } from 'vitest';

import { createCaptureChallenge } from './capture-challenge';

describe('mission capture challenge', () => {
  it('turns random bytes into a short phrase that can be spoken or shown on one phone', () => {
    expect(createCaptureChallenge(new Uint8Array([13, 12, 0, 37]))).toEqual({
      kind: 'spoken_or_shown_phrase',
      phrase: 'LIME ORBIT 47',
    });
  });

  it('rejects a weak random input instead of silently reducing the challenge space', () => {
    expect(() => createCaptureChallenge(new Uint8Array([1, 2, 3]))).toThrow(
      'at least four random bytes',
    );
  });
});
