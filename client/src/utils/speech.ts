/**
 * Web Speech API Utility for Malayalam, Tamil, and English Voice Guidance
 * Designed for elderly family members who prefer spoken instructions.
 */

let voices: SpeechSynthesisVoice[] = [];

// Initialize voice list
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    voices = window.speechSynthesis.getVoices();
  };
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

export const isSpeechSupported = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

export const findBestVoice = (lang: 'ml' | 'ta' | 'en'): SpeechSynthesisVoice | null => {
  if (!voices.length && isSpeechSupported()) {
    voices = window.speechSynthesis.getVoices();
  }

  const langPrefix = lang === 'ml' ? 'ml' : lang === 'ta' ? 'ta' : 'en';

  // 1. Exact match for locale (e.g. ml-IN, ta-IN, en-IN)
  const exact = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
  if (exact) return exact;

  // 2. Name match (e.g. "Malayalam", "Tamil", "India")
  const byName = voices.find(v =>
    v.name.toLowerCase().includes(lang === 'ml' ? 'malayalam' : lang === 'ta' ? 'tamil' : 'india')
  );
  if (byName) return byName;

  // 3. Indian English fallback for natural accent
  const indianEnglish = voices.find(v => v.lang.toLowerCase() === 'en-in');
  if (indianEnglish) return indianEnglish;

  // 4. Default voice
  return voices.find(v => v.default) || (voices.length > 0 ? voices[0] : null);
};

export const hasNativeVoice = (lang: 'ml' | 'ta' | 'en'): boolean => {
  if (!isSpeechSupported()) return false;
  if (!voices.length) {
    voices = window.speechSynthesis.getVoices();
  }
  const langPrefix = lang === 'ml' ? 'ml' : lang === 'ta' ? 'ta' : 'en';
  return voices.some(v => v.lang.toLowerCase().startsWith(langPrefix));
};

export const speak = (
  text: string,
  lang: 'ml' | 'ta' | 'en' = 'ml',
  onEnd?: () => void
): boolean => {
  if (!isSpeechSupported()) {
    return false;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any pending utterance

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = findBestVoice(lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = lang === 'ml' ? 'ml-IN' : lang === 'ta' ? 'ta-IN' : 'en-IN';
    }

    // Slightly slower rate for elderly comprehension
    utterance.rate = 0.88;
    utterance.pitch = 1.0;

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('Speech synthesis failed:', err);
    return false;
  }
};

export const stopSpeaking = (): void => {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
};
