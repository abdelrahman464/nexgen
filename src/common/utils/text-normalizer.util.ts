export const charSubstitutions = {
  english: {
    a: ['@', '4', 'Ð°', 'Ð°'],
    e: ['3', 'â‚¬', 'Ðµ'],
    i: ['1', '!', '|', 'Ñ–', 'Ñ–'],
    o: ['0', 'Ð¾', 'Ð¾'],
    s: ['5', '$', 'Ñ•'],
    t: ['7', '+'],
    l: ['1', '|', 'Ñ–'],
    g: ['6', '9'],
    b: ['8'],
    z: ['2'],
  },
  arabic: {
    'Ø§': ['Ø£', 'Ø¥', 'Ø¢', 'Ø§'],
    'Ø£': ['Ø§', 'Ø¥', 'Ø¢', 'Ø£'],
    'Ø¥': ['Ø§', 'Ø£', 'Ø¢', 'Ø¥'],
    'Ø¢': ['Ø§', 'Ø£', 'Ø¥', 'Ø¢'],
    'Ù‡': ['Ø©', 'Ù‡'],
    'Ø©': ['Ù‡', 'Ø©'],
    'ÙŠ': ['Ù‰', 'ÙŠ', 'Ø¦'],
    'Ù‰': ['ÙŠ', 'Ù‰', 'Ø¦'],
    'Ùˆ': ['Ø¤', 'Ùˆ'],
    'Øª': ['Ø©', 'Øª'],
  },
};

export const normalizeArabic = (text: string) => {
  if (!text) return text;
  let normalized = text.replace(/[\u064B-\u065F\u0670]/g, '');
  normalized = normalized.replace(/[Ø£Ø¥Ø¢]/g, 'Ø§');
  normalized = normalized.replace(/[Ù‰]/g, 'ÙŠ');
  normalized = normalized.replace(/[Ø©]/g, 'Ù‡');
  normalized = normalized.replace(/[Ø¤]/g, 'Ùˆ');
  normalized = normalized.replace(/[Ø¦]/g, 'ÙŠ');
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  normalized = normalized.replace(/\u00A0/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ');
  return normalized.trim();
};

export const normalizeEnglish = (text: string) => {
  if (!text) return text;
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  normalized = normalized.replace(/\s+/g, ' ');
  return normalized.trim();
};

export const removeElongation = (text: string) => {
  if (!text) return text;
  let normalized = text.replace(/Ù€+/g, '');
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');
  return normalized;
};

export const reverseSubstitutions = (text: string) => {
  if (!text) return text;
  let normalized = text;
  const englishMap: Record<string, string> = {
    '@': 'a',
    4: 'a',
    3: 'e',
    'â‚¬': 'e',
    1: 'i',
    '!': 'i',
    '|': 'i',
    0: 'o',
    5: 's',
    $: 's',
    7: 't',
    '+': 't',
    6: 'g',
    9: 'g',
    8: 'b',
    2: 'z',
  };
  Object.entries(englishMap).forEach(([sub, letter]) => {
    const escapedSub = String(sub).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(escapedSub, 'gi'), letter);
  });
  return normalized;
};

export const removeSeparators = (text: string) => {
  if (!text) return text;
  return text.replace(/[\s._\-*+!@#$%^&()[\]{}|\\/:;"'<>?,=~`]/g, '');
};

export const normalizeText = (text: unknown) => {
  if (!text || typeof text !== 'string') return text as string;
  return normalizeEnglish(normalizeArabic(reverseSubstitutions(removeElongation(text))));
};

export const createFlexiblePattern = (word: string) => {
  if (!word || typeof word !== 'string') return '';
  if (/\s/.test(word) || /[[\]*+]/.test(word)) return '';
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const chars = escaped.split('');
  if (chars.length === 0) return '';
  const separators = '\\s._\\-*+!@#$%^&()\\[\\]{}|\\\\/:;"\'<>?,=~`';
  const pattern = chars
    .map((char) => (/[\u0600-\u06FF]/.test(char) ? `${char}[\\s\\u0640]*` : `${char}[${separators}]*`))
    .join('');
  if (!pattern || pattern.trim().length === 0) return '';
  try {
    new RegExp(pattern, 'gi').test('');
  } catch {
    return '';
  }
  return pattern;
};
