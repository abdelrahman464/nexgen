/**
 * Advanced offensive words filter with normalization and pattern matching
 * Handles evasions, character substitutions, and elongation
 */
const offensiveWords = require('./offensiveWordsList');
const {
  normalizeText,
  createFlexiblePattern,
  removeSeparators,
} = require('./textNormalizer');

/**
 * Filters offensive words from a message with advanced pattern matching
 * @param {string} message - The message text to filter
 * @param {string[]} customWords - Optional custom list of offensive words to add to the default list
 * @param {string} replacement - What to replace offensive words with (default: '***')
 * @returns {string} The filtered message with offensive words replaced
 */
const filterOffensiveWords = (
  message,
  customWords = [],
  replacement = '***',
) => {
  if (!message || typeof message !== 'string') {
    return message;
  }

  // Combine default offensive words with custom words
  const allOffensiveWords = [...offensiveWords, ...customWords];

  // Separate English and Arabic words for different regex handling
  const englishWords = allOffensiveWords.filter(
    (word) => !/[\u0600-\u06FF]/.test(word), // Arabic Unicode range
  );
  const arabicWords = allOffensiveWords.filter((word) =>
    /[\u0600-\u06FF]/.test(word),
  );

  let filteredMessage = message;

  // Process English words
  if (englishWords.length > 0) {
    englishWords.forEach((word) => {
      // Create multiple patterns to catch evasions
      const patterns = [
        // Exact match with word boundaries
        `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        // Pattern with separators (f-u-c-k, f.u.c.k, etc.)
        createFlexiblePattern(word),
        // Pattern with character substitutions (f@ck, f4ck, etc.)
        createFlexiblePattern(normalizeText(word)),
        // Pattern without separators (removed spaces/symbols)
        removeSeparators(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      ];

      patterns.forEach((pattern) => {
        if (pattern && pattern.trim().length > 0) {
          try {
            const regex = new RegExp(pattern, 'gi');
            filteredMessage = filteredMessage.replace(regex, replacement);
          } catch (error) {
            // Skip invalid regex patterns
            console.warn(`Invalid regex pattern: ${pattern}`, error.message);
          }
        }
      });
    });
  }

  // Process Arabic words
  if (arabicWords.length > 0) {
    arabicWords.forEach((word) => {
      // Normalize the Arabic word
      const normalizedWord = normalizeText(word);

      // Create multiple patterns to catch evasions
      const patterns = [
        // Exact match (with Arabic word boundaries)
        `(?<![\u0600-\u06FF])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\u0600-\u06FF])`,
        // Pattern with separators (ك ل ب, ك-ل-ب, etc.)
        createFlexiblePattern(word),
        // Normalized pattern (without diacritics)
        `(?<![\u0600-\u06FF])${normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\u0600-\u06FF])`,
        // Pattern without separators
        removeSeparators(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      ];

      patterns.forEach((pattern) => {
        if (pattern && pattern.trim().length > 0) {
          try {
            const regex = new RegExp(pattern, 'gi');
            filteredMessage = filteredMessage.replace(regex, replacement);
          } catch (error) {
            // Skip invalid regex patterns
            console.warn(`Invalid regex pattern: ${pattern}`, error.message);
          }
        }
      });
    });
  }

  return filteredMessage;
};

/**
 * Checks if a message contains offensive words with advanced pattern matching
 * @param {string} message - The message text to check
 * @param {string[]} customWords - Optional custom list of offensive words to add to the default list
 * @returns {boolean} True if the message contains offensive words, false otherwise
 */
const containsOffensiveWords = (message, customWords = []) => {
  if (!message || typeof message !== 'string') {
    return false;
  }

  // Normalize the message for checking
  const normalizedMessage = normalizeText(message);
  const messageWithoutSeparators = removeSeparators(normalizedMessage);

  // Combine default offensive words with custom words
  const allOffensiveWords = [...offensiveWords, ...customWords];

  // Check each word using array methods
  return allOffensiveWords.some((word) => {
    const normalizedWord = normalizeText(word);
    const wordWithoutSeparators = removeSeparators(normalizedWord);

    // Check multiple patterns
    const patterns = [];

    // Exact match
    try {
      const exactPattern = /[\u0600-\u06FF]/.test(word)
        ? `(?<![\u0600-\u06FF])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\u0600-\u06FF])`
        : `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
      if (exactPattern && exactPattern.trim().length > 0) {
        patterns.push(new RegExp(exactPattern, 'gi'));
      }
    } catch (error) {
      // Skip invalid pattern
    }

    // Pattern with separators
    try {
      const flexiblePattern = createFlexiblePattern(word);
      if (flexiblePattern && flexiblePattern.trim().length > 0) {
        patterns.push(new RegExp(flexiblePattern, 'gi'));
      }
    } catch (error) {
      // Skip invalid pattern
    }

    // Normalized pattern
    try {
      const normalizedPattern = /[\u0600-\u06FF]/.test(normalizedWord)
        ? `(?<![\u0600-\u06FF])${normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\u0600-\u06FF])`
        : `\\b${normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
      if (normalizedPattern && normalizedPattern.trim().length > 0) {
        patterns.push(new RegExp(normalizedPattern, 'gi'));
      }
    } catch (error) {
      // Skip invalid pattern
    }

    // Pattern without separators
    try {
      const noSeparatorsPattern = wordWithoutSeparators.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      if (noSeparatorsPattern && noSeparatorsPattern.trim().length > 0) {
        patterns.push(new RegExp(noSeparatorsPattern, 'gi'));
      }
    } catch (error) {
      // Skip invalid pattern
    }

    return patterns.some(
      (pattern) =>
        pattern.test(message) ||
        pattern.test(normalizedMessage) ||
        pattern.test(messageWithoutSeparators),
    );
  });
};

module.exports = {
  filterOffensiveWords,
  containsOffensiveWords,
  offensiveWords, // Export the list in case you want to access it
};
