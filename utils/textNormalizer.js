/**
 * Text normalization utilities for offensive words filtering
 * Handles Arabic and English text normalization
 */

/**
 * Character substitution maps for common evasions
 */
const charSubstitutions = {
  // English character substitutions
  english: {
    a: ['@', '4', 'а', 'а'],
    e: ['3', '€', 'е'],
    i: ['1', '!', '|', 'і', 'і'],
    o: ['0', 'о', 'о'],
    s: ['5', '$', 'ѕ'],
    t: ['7', '+'],
    l: ['1', '|', 'і'],
    g: ['6', '9'],
    b: ['8'],
    z: ['2'],
  },
  // Arabic character substitutions
  arabic: {
    ا: ['أ', 'إ', 'آ', 'ا'],
    أ: ['ا', 'إ', 'آ', 'أ'],
    إ: ['ا', 'أ', 'آ', 'إ'],
    آ: ['ا', 'أ', 'إ', 'آ'],
    ه: ['ة', 'ه'],
    ة: ['ه', 'ة'],
    ي: ['ى', 'ي', 'ئ'],
    ى: ['ي', 'ى', 'ئ'],
    و: ['ؤ', 'و'],
    ت: ['ة', 'ت'],
  },
};

/**
 * Normalizes Arabic text by removing diacritics and normalizing characters
 * @param {string} text - Arabic text to normalize
 * @returns {string} Normalized text
 */
const normalizeArabic = (text) => {
  if (!text) return text;

  // Remove Arabic diacritics (tashkeel)
  let normalized = text.replace(/[\u064B-\u065F\u0670]/g, '');

  // Normalize Arabic hamzas
  normalized = normalized.replace(/[أإآ]/g, 'ا');
  normalized = normalized.replace(/[ى]/g, 'ي');
  normalized = normalized.replace(/[ة]/g, 'ه');
  normalized = normalized.replace(/[ؤ]/g, 'و');
  normalized = normalized.replace(/[ئ]/g, 'ي');

  // Remove zero-width characters and special spaces
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  normalized = normalized.replace(/\u00A0/g, ' '); // Non-breaking space

  // Normalize multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized.trim();
};

/**
 * Normalizes English text by converting to lowercase and handling common substitutions
 * @param {string} text - English text to normalize
 * @returns {string} Normalized text
 */
const normalizeEnglish = (text) => {
  if (!text) return text;

  // Convert to lowercase
  let normalized = text.toLowerCase();

  // Remove zero-width characters
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Normalize multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized.trim();
};

/**
 * Removes elongation characters (repeated characters like كـــذا)
 * @param {string} text - Text to process
 * @returns {string} Text with elongation removed
 */
const removeElongation = (text) => {
  if (!text) return text;

  // Remove Arabic tatweel (elongation character)
  let normalized = text.replace(/ـ+/g, '');

  // Remove repeated characters (more than 2 consecutive)
  // This helps catch attempts like "fuuuuck" or "كللللب"
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

  return normalized;
};

/**
 * Reverses character substitutions (numbers/symbols to letters)
 * @param {string} text - Text with substitutions
 * @returns {string} Text with substitutions reversed
 */
const reverseSubstitutions = (text) => {
  if (!text) return text;

  let normalized = text;

  // Reverse English substitutions
  const englishMap = {
    '@': 'a',
    4: 'a',
    3: 'e',
    '€': 'e',
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
    // Escape special regex characters
    const escapedSub = String(sub).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedSub, 'gi');
    normalized = normalized.replace(regex, letter);
  });

  return normalized;
};

/**
 * Removes spaces and special characters that might be used to split words
 * @param {string} text - Text to process
 * @returns {string} Text with separators removed
 */
const removeSeparators = (text) => {
  if (!text) return text;

  // Remove spaces, dots, dashes, underscores, and other separators
  return text.replace(/[\s._\-*+!@#$%^&()[\]{}|\\/:;"'<>?,=~`]/g, '');
};

/**
 * Normalizes text for filtering (combines all normalization steps)
 * @param {string} text - Text to normalize
 * @returns {string} Fully normalized text
 */
const normalizeText = (text) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Step 1: Remove elongation
  let normalized = removeElongation(text);

  // Step 2: Reverse substitutions
  normalized = reverseSubstitutions(normalized);

  // Step 3: Normalize Arabic
  normalized = normalizeArabic(normalized);

  // Step 4: Normalize English
  normalized = normalizeEnglish(normalized);

  return normalized;
};

/**
 * Creates a pattern that matches a word with possible separators
 * @param {string} word - Word to create pattern for
 * @returns {string} Regex pattern
 */
const createFlexiblePattern = (word) => {
  if (!word || typeof word !== 'string') return '';

  // Skip flexible pattern for words with spaces or complex characters
  // These are better handled with exact matching
  if (/\s/.test(word) || /[[\]*+]/.test(word)) {
    return '';
  }

  // Escape special regex characters first
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create pattern that allows optional separators between characters
  // This catches attempts like "f-u-c-k" or "ك ل ب"
  const chars = escaped.split('');

  // If no characters after escaping, return empty
  if (chars.length === 0) return '';

  // Escape separators for use in character class
  // Inside character class: - must be escaped or at start/end, ] must be escaped
  // * and + don't need escaping inside []
  const separators = '\\s._\\-*+!@#$%^&()\\[\\]{}|\\\\/:;"\'<>?,=~`';

  const pattern = chars
    .map((char) => {
      // For Arabic characters, allow optional spaces and tatweel
      if (/[\u0600-\u06FF]/.test(char)) {
        return `${char}[\\s\\u0640]*`;
      }
      // For English, allow common separators
      return `${char}[${separators}]*`;
    })
    .join('');

  // Validate pattern - ensure it's not empty or just separators
  if (!pattern || pattern.trim().length === 0) return '';

  // Final validation: try to create regex to catch any syntax errors
  try {
    // eslint-disable-next-line no-unused-vars
    const testRegex = new RegExp(pattern, 'gi');
    // Test it works by matching empty string
    testRegex.test('');
  } catch (error) {
    // If pattern is invalid, return empty string
    return '';
  }

  return pattern;
};

module.exports = {
  normalizeArabic,
  normalizeEnglish,
  removeElongation,
  reverseSubstitutions,
  removeSeparators,
  normalizeText,
  createFlexiblePattern,
  charSubstitutions,
};
