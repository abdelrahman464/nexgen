/**
 * Comprehensive list of offensive words from multiple sources
 * - English: Uses 'badwords' npm package (450+ words)
 * - Arabic: Custom comprehensive list
 *
 * This combines professional datasets with custom words for maximum coverage
 */
const badwords = require('badwords');

// Arabic offensive words - comprehensive list
const arabicOffensiveWords = [
  // Insults and derogatory terms
  'كلب', // dog (used as insult)
  'حمار', // donkey (used as insult)
  'غبي', // stupid
  'أحمق', // fool
  'عاهر', // prostitute
  'زانية', // adulteress
  'ابن كلب', // son of a dog
  'عاهرة', // prostitute
  'ابن عاهرة', // son of a prostitute
  'خنزير', // pig
  'قذر', // dirty
  'وسخ', // filthy
  'حقير', // despicable
  'لعين', // damned
  'شيطان', // devil
  'كافر', // infidel
  'منافق', // hypocrite
  'خائن', // traitor
  'جبان', // coward
  'أبله', // idiot
  'مجنون', // crazy
  'معتوه', // insane
  'مريض نفسي', // psychopath
  'مخبول', // crazy
  'أخرق', // clumsy/fool
  'أهبل', // stupid
  'مغفل', // fool
  'أبله', // idiot (duplicate but kept for variations)
  'أحمق', // fool (duplicate but kept for variations)

  // Common Arabic curse phrases
  'يلعن', // curse
  'اللعنة', // the curse
  'يلعنك', // curse you
  'يلعن أبوك', // curse your father
  'يلعن دينك', // curse your religion
  'يلعن أمك', // curse your mother
  'اذهب للجحيم', // go to hell
  'انتحر', // commit suicide
  'مت', // die
  'اقتل نفسك', // kill yourself

  // Additional Arabic offensive terms
  'نيك', // fuck
  'نيكة', // fuck
  'نيكي', // fuck
  'نيكية', // fuck
  'نيكيا', // fuck
  'نيكيو', // fuck
  'نيكيوا', // fuck
  'نيكيون', // fuck
  'نيكيونا', // fuck
  'نيكيوني', // fuck
  'متناك', // fuck
  'متناكة', // fuck
  'كسمك', // fuck
  'كس', // fuck
  'طيز', // pussy
  'طيزة', // pussy
  'طيزي', // pussy
  'طيزية', // pussy
  'طيزيا', // pussy
  'طيزيو', // pussy
  'طيزيوا', // pussy
  'طيزيون', // pussy
  'طيزيونا', // pussy
  'بضان', // bastard
  'دعارة', // prostitution
  'داعر', // prostitute (male)
  'داعرة', // prostitute (female)
  'زاني', // adulterer
  'فاسق', // immoral
  'فاجر', // wicked
  'فاسد', // corrupt
  'منحط', // degraded
  'وضيع', // lowly
  'دنيء', // base
  'رذيل', // vile
  'لئيم', // mean
  'نذل', // scoundrel
  'وضيع', // despicable
  'حثالة', // scum
  'نفاية', // trash
  'قمامة', // garbage
  'زبالة', // rubbish
  'قبيح', // ugly
  'مقزز', // disgusting
  'مثير للاشمئزاز', // disgusting
  'مقرف', // repulsive
  'مقزز', // nauseating

  // Religious insults (be careful with these)
  'ملحد', // atheist (used as insult)
  'كافر', // infidel (already listed but kept)
  'مرتد', // apostate

  // Sexual terms (Arabic)
  'شاذ', // pervert
  'منحرف', // deviant
  'شاذ جنسيا', // sexually deviant

  // Violence-related
  'اقتل', // kill
  'اذبح', // slaughter
  'اذهب للموت', // go to death
  'انتحر', // commit suicide (already listed)

  // Body parts used as insults
  'رأس', // head (in some contexts)
  'وجه', // face (in some contexts)

  // Family insults
  'أمك', // your mother (in offensive context)
  'أبوك', // your father (in offensive context)
  'أختك', // your sister (in offensive context)
  'أخوك', // your brother (in offensive context)
];

// Combine English words from badwords package with Arabic words
// Remove duplicates and empty strings
const englishWords = Array.isArray(badwords)
  ? badwords.filter(
      (word) => word && typeof word === 'string' && word.trim().length > 0,
    )
  : [];

// Combine all words and remove duplicates
const allOffensiveWords = [
  ...new Set([...englishWords, ...arabicOffensiveWords]),
];

// Export the combined list
module.exports = allOffensiveWords;
