import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLanguage } from './LanguageContext';
import { speak, stopSpeaking, isSpeechSupported, hasNativeVoice } from '../utils/speech';

interface VoiceContextType {
  voiceEnabled: boolean;
  toggleVoice: () => void;
  speakText: (text: string, force?: boolean) => void;
  isSpeaking: boolean;
  isSupported: boolean;
  hasMalayalamVoice: boolean;
  stopVoice: () => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language } = useLanguage();
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('milk_voice_enabled');
    if (saved !== null) {
      return saved === 'true';
    }
    // Default enabled for Malayalam or Tamil
    return language === 'ml' || language === 'ta';
  });

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [hasMalayalamVoice, setHasMalayalamVoice] = useState<boolean>(false);

  useEffect(() => {
    const supported = isSpeechSupported();
    setIsSupported(supported);
    if (supported) {
      setHasMalayalamVoice(hasNativeVoice('ml'));
    }
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev;
      localStorage.setItem('milk_voice_enabled', String(next));
      if (!next) {
        stopSpeaking();
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  const stopVoice = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback(
    (text: string, force: boolean = false) => {
      if (!voiceEnabled && !force) return;

      setIsSpeaking(true);
      speak(text, language, () => {
        setIsSpeaking(false);
      });
    },
    [voiceEnabled, language]
  );

  return (
    <VoiceContext.Provider
      value={{
        voiceEnabled,
        toggleVoice,
        speakText,
        isSpeaking,
        isSupported,
        hasMalayalamVoice,
        stopVoice,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = (): VoiceContextType => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};
