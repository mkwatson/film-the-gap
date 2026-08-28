const challengeModifiers = [
  'amber',
  'aqua',
  'bright',
  'coral',
  'copper',
  'crisp',
  'ember',
  'gold',
  'green',
  'indigo',
  'ivory',
  'jade',
  'lemon',
  'lime',
  'lunar',
  'mint',
  'neon',
  'orange',
  'pearl',
  'pink',
  'red',
  'silver',
  'solar',
  'swift',
  'teal',
  'violet',
  'warm',
  'white',
  'yellow',
  'young',
  'zesty',
  'vivid',
] as const;

const challengeObjects = [
  'acorn',
  'atlas',
  'beacon',
  'cedar',
  'comet',
  'delta',
  'fern',
  'harbor',
  'kite',
  'lotus',
  'maple',
  'mesa',
  'orbit',
  'pebble',
  'pine',
  'prism',
  'quill',
  'river',
  'rocket',
  'sparrow',
  'star',
  'stone',
  'tiger',
  'torch',
  'tulip',
  'wave',
  'willow',
  'wind',
  'wolf',
  'zenith',
  'zebra',
  'moon',
] as const;

export interface CaptureChallenge {
  readonly kind: 'spoken_or_shown_phrase';
  readonly phrase: string;
}

function secureRandomBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(4));
}

export function createCaptureChallenge(randomBytes = secureRandomBytes()): CaptureChallenge {
  if (randomBytes.length < 4) {
    throw new Error('A capture challenge requires at least four random bytes.');
  }
  const numericSeed = (randomBytes[2] ?? 0) * 256 + (randomBytes[3] ?? 0);
  const number = 10 + (numericSeed % 90);
  return {
    kind: 'spoken_or_shown_phrase',
    phrase:
      `${challengeModifiers[(randomBytes[0] ?? 0) % challengeModifiers.length]} ${challengeObjects[(randomBytes[1] ?? 0) % challengeObjects.length]} ${number}`.toUpperCase(),
  };
}
