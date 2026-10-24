/**
 * Detects common languages using script ranges and compact stopword sets.
 * Explicit language values from an import row take precedence over inference.
 */
const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'with', 'this', 'from', 'that'],
  es: ['el', 'la', 'los', 'las', 'con', 'para', 'que'],
  fr: ['le', 'la', 'les', 'des', 'avec', 'pour', 'que'],
  de: ['der', 'die', 'das', 'und', 'mit', 'für', 'ist']
};

function detectLanguage(text: string): string {
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[一-鿿]/.test(text)) return 'zh';
  if (/[ぁ-ゟ゠-ヿ]/.test(text)) return 'ja';
  if (/[؀-ۿ]/.test(text)) return 'ar';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  const words = text.toLowerCase().match(/[a-záéíóúüñàâçèêëîïôùûÿœæ]+/g) || [];
  const scores = Object.entries(STOPWORDS).map(([language, list]) => ({
    language,
    score: words.filter((word) => list.includes(word)).length
  }));
  scores.sort((left, right) => right.score - left.score);
  return scores[0]?.score ? scores[0].language : 'en';
}

export { detectLanguage };
