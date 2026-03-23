'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Minimal SpeechRecognition type ────────────────────────────────────────
// The Web Speech API is not in standard lib.dom but is available in Chrome/Edge.
// We define only the surface we actually use to keep things type-safe.

interface SpeechResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

interface SpeechResultList {
  readonly length: number;
  readonly resultIndex: number;
  readonly results: readonly SpeechResult[];
}

type SpeechResultCallback = (event: SpeechResultList) => void;

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: SpeechResultCallback | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, unknown>;
  const Ctor = (win['SpeechRecognition'] ?? win['webkitSpeechRecognition']) as
    | SpeechRecognitionCtor
    | undefined;
  return Ctor ?? null;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export interface UseVoiceInputReturn {
  isListening: boolean;
  /** Interim (unconfirmed) transcript while the user is speaking */
  interimTranscript: string;
  /** False on browsers that do not support the Web Speech API */
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
}

/**
 * Thin wrapper around the Web Speech API (`he-IL`) for voice-to-text input.
 *
 * `onFinalTranscript` is called with the confirmed Hebrew text once the
 * recognition engine finalises a result. Interim text is exposed via
 * `interimTranscript` for real-time greyed preview in the input field.
 *
 * The mic button should be hidden when `isSupported === false`.
 */
export function useVoiceInput(
  onFinalTranscript: (text: string) => void,
): UseVoiceInputReturn {
  const [isListening,       setIsListening]       = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef       = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);

  // Keep callback ref in sync to avoid stale closures inside event handlers
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const isSupported = getSpeechRecognition() !== null;

  const startListening = useCallback(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) return;

    const recognition = new SpeechRec();
    recognition.lang             = 'he-IL';
    recognition.interimResults   = true;
    recognition.continuous       = false;
    recognition.maxAlternatives  = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let final   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) setInterimTranscript(interim);
      if (final) {
        setInterimTranscript('');
        onFinalTranscriptRef.current(final.trim());
      }
    };

    recognition.onend   = () => { setIsListening(false); setInterimTranscript(''); };
    recognition.onerror = () => { setIsListening(false); setInterimTranscript(''); };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  return { isListening, interimTranscript, isSupported, startListening, stopListening };
}
