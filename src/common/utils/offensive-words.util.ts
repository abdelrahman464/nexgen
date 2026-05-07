import { offensiveWords } from './offensive-words-list.util';
import { createFlexiblePattern, normalizeText, removeSeparators } from './text-normalizer.util';

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasArabic = (value: string) => /[\u0600-\u06FF]/.test(value);

export const filterOffensiveWords = (message: unknown, customWords: string[] = [], replacement = '***') => {
  if (!message || typeof message !== 'string') return message as string;
  const allOffensiveWords = [...offensiveWords, ...customWords];
  const englishWords = allOffensiveWords.filter((word) => !hasArabic(word));
  const arabicWords = allOffensiveWords.filter((word) => hasArabic(word));
  let filteredMessage = message;

  englishWords.forEach((word) => {
    const patterns = [
      `\\b${escapePattern(word)}\\b`,
      createFlexiblePattern(word),
      createFlexiblePattern(normalizeText(word)),
      escapePattern(removeSeparators(word)),
    ];
    patterns.forEach((pattern) => {
      if (!pattern?.trim()) return;
      try {
        filteredMessage = filteredMessage.replace(new RegExp(pattern, 'gi'), replacement);
      } catch (error: any) {
        console.warn(`Invalid regex pattern: ${pattern}`, error.message);
      }
    });
  });

  arabicWords.forEach((word) => {
    const normalizedWord = normalizeText(word);
    const patterns = [
      `(?<![\u0600-\u06FF])${escapePattern(word)}(?![\u0600-\u06FF])`,
      createFlexiblePattern(word),
      `(?<![\u0600-\u06FF])${escapePattern(normalizedWord)}(?![\u0600-\u06FF])`,
      escapePattern(removeSeparators(word)),
    ];
    patterns.forEach((pattern) => {
      if (!pattern?.trim()) return;
      try {
        filteredMessage = filteredMessage.replace(new RegExp(pattern, 'gi'), replacement);
      } catch (error: any) {
        console.warn(`Invalid regex pattern: ${pattern}`, error.message);
      }
    });
  });

  return filteredMessage;
};

export const containsOffensiveWords = (message: unknown, customWords: string[] = []) => {
  if (!message || typeof message !== 'string') return false;
  const normalizedMessage = normalizeText(message);
  const messageWithoutSeparators = removeSeparators(normalizedMessage);
  const allOffensiveWords = [...offensiveWords, ...customWords];

  return allOffensiveWords.some((word) => {
    const normalizedWord = normalizeText(word);
    const wordWithoutSeparators = removeSeparators(normalizedWord);
    const patterns: RegExp[] = [];
    [
      hasArabic(word) ? `(?<![\u0600-\u06FF])${escapePattern(word)}(?![\u0600-\u06FF])` : `\\b${escapePattern(word)}\\b`,
      createFlexiblePattern(word),
      hasArabic(normalizedWord) ? `(?<![\u0600-\u06FF])${escapePattern(normalizedWord)}(?![\u0600-\u06FF])` : `\\b${escapePattern(normalizedWord)}\\b`,
      escapePattern(wordWithoutSeparators),
    ].forEach((pattern) => {
      if (!pattern?.trim()) return;
      try {
        patterns.push(new RegExp(pattern, 'gi'));
      } catch {
        // Preserve legacy behavior: skip invalid patterns.
      }
    });
    return patterns.some((pattern) => pattern.test(message) || pattern.test(normalizedMessage) || pattern.test(messageWithoutSeparators));
  });
};

export { offensiveWords };
