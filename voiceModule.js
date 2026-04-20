// ============================================================
// voiceModule.js — CTI English PWA
// PARTIE 1 : Text-To-Speech natif (window.speechSynthesis)
// PARTIE 2 : Speech-To-Text natif (window.SpeechRecognition)
// Zéro API externe · Fonctionne hors ligne (TTS) / en ligne (STT)
// ============================================================

'use strict';

// ─── ÉTAT DU MODULE VOCAL ─────────────────────────────────────
const voiceState = {
  ttsEnabled: false,
  sttEnabled: false,
  ttsSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  sttSupported: typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  currentUtterance: null,
  recognition: null,
  isListening: false,
  onTranscript: null,   // callback(transcript: string)
  onSttEnd: null,       // callback(finalText: string, wasAborted: boolean)
  onSttError: null,     // callback(errorMsg: string)
};

// Vitesses TTS par niveau
const TTS_RATES = { starter: 0.8, builder: 1.0, challenger: 1.2 };

// ─── INITIALISATION ───────────────────────────────────────────
/**
 * Initialise le module vocal, détecte le support navigateur.
 * @returns {{ ttsOk: boolean, sttOk: boolean, warnings: string[] }}
 */
function initVoiceModule() {
  const warnings = [];

  if (!voiceState.ttsSupported) {
    warnings.push('Text-to-Speech non supporté par ce navigateur.');
  }
  if (!voiceState.sttSupported) {
    warnings.push('Speech-to-Text non supporté par ce navigateur. Utilisez Chrome pour cette fonctionnalité.');
  } else if (!navigator.onLine) {
    warnings.push('Speech-to-Text nécessite une connexion internet sur Chrome.');
  }

  // Pré-charger les voix (asynchrone dans certains navigateurs)
  if (voiceState.ttsSupported) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', _cacheVoices);
  }

  return {
    ttsOk: voiceState.ttsSupported,
    sttOk: voiceState.sttSupported,
    warnings,
  };
}

// ─── PARTIE 1 : TEXT-TO-SPEECH ───────────────────────────────

let _cachedVoices = [];

function _cacheVoices() {
  _cachedVoices = window.speechSynthesis.getVoices();
}

/**
 * Sélectionne la meilleure voix anglaise disponible.
 * Préfère en-US, fallback en-GB, puis n'importe quelle voix anglaise.
 * @returns {SpeechSynthesisVoice|null}
 */
function _pickEnglishVoice() {
  const voices = _cachedVoices.length > 0
    ? _cachedVoices
    : window.speechSynthesis.getVoices();

  // Préférences dans l'ordre
  const preferred = [
    v => v.lang === 'en-US' && v.name.includes('Google'),
    v => v.lang === 'en-GB' && v.name.includes('Google'),
    v => v.lang === 'en-US',
    v => v.lang === 'en-GB',
    v => v.lang.startsWith('en'),
  ];

  for (const predicate of preferred) {
    const found = voices.find(predicate);
    if (found) return found;
  }
  return null;
}

/**
 * Lit un texte à voix haute en anglais.
 * @param {string} text       texte à lire
 * @param {string} level      niveau courant (détermine la vitesse)
 * @param {Function} [onEnd]  callback appelé à la fin
 */
function speak(text, level = 'builder', onEnd = null) {
  if (!voiceState.ttsSupported || !voiceState.ttsEnabled) {
    if (onEnd) onEnd();
    return;
  }
  if (!text || text.trim() === '') {
    if (onEnd) onEnd();
    return;
  }

  // Annuler toute lecture en cours
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang   = 'en-US';
  utterance.rate   = TTS_RATES[level] ?? 1.0;
  utterance.pitch  = 1;
  utterance.volume = 1;

  const voice = _pickEnglishVoice();
  if (voice) utterance.voice = voice;

  utterance.onend   = () => { voiceState.currentUtterance = null; if (onEnd) onEnd(); };
  utterance.onerror = (e) => {
    console.warn('[TTS] error:', e.error);
    voiceState.currentUtterance = null;
    if (onEnd) onEnd();
  };

  voiceState.currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

/**
 * Lit la question d'un exercice à voix haute.
 * @param {Object} question  objet question du pool
 * @param {string} level
 */
function speakQuestion(question, level = 'builder') {
  if (!question) return;
  const text = question.question || question.text || '';
  speak(text, level);
}

/**
 * Lit la bonne réponse et l'explication après correction.
 * @param {string} correctAnswer
 * @param {string} [example]  exemple contextuel optionnel
 * @param {string} level
 */
function speakCorrection(correctAnswer, example = '', level = 'builder') {
  const parts = [`The correct answer is: ${correctAnswer}`];
  if (example) parts.push(example);
  speak(parts.join('. '), level);
}

/** Active/désactive le TTS. */
function toggleTTS(enabled) {
  voiceState.ttsEnabled = enabled;
  if (!enabled) window.speechSynthesis.cancel();
}

/** Arrête immédiatement toute lecture TTS. */
function stopSpeaking() {
  if (voiceState.ttsSupported) window.speechSynthesis.cancel();
}

// ─── PARTIE 2 : SPEECH-TO-TEXT ───────────────────────────────

/**
 * Initialise et retourne une instance SpeechRecognition.
 * @returns {SpeechRecognition|null}
 */
function _createRecognition() {
  if (!voiceState.sttSupported) return null;
  const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SRClass();
  rec.lang          = 'en-US';
  rec.continuous    = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}

/**
 * Démarre l'écoute vocale.
 * @param {Object} callbacks
 * @param {Function} callbacks.onTranscript  appelé en temps réel avec le texte intermédiaire
 * @param {Function} callbacks.onFinal       appelé avec le texte final
 * @param {Function} callbacks.onError       appelé si erreur
 * @param {Function} [callbacks.onStart]     appelé au démarrage
 * @returns {boolean} true si démarrage réussi
 */
function startListening({ onTranscript, onFinal, onError, onStart }) {
  if (!voiceState.sttSupported) {
    if (onError) onError('Speech-to-Text non supporté. Utilisez Chrome.');
    return false;
  }
  if (voiceState.isListening) {
    stopListening();
  }
  if (!navigator.onLine) {
    if (onError) onError('STT nécessite une connexion internet. Mode hors ligne détecté.');
    return false;
  }

  const rec = _createRecognition();
  if (!rec) return false;

  voiceState.recognition = rec;
  voiceState.isListening = true;

  rec.onstart = () => {
    if (onStart) onStart();
  };

  rec.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }
    if (onTranscript) onTranscript(interim || final);
    if (final && onFinal) {
      voiceState.isListening = false;
      onFinal(final.trim());
    }
  };

  rec.onerror = (event) => {
    voiceState.isListening = false;
    const messages = {
      'no-speech':         'Aucune voix détectée. Parle plus près du micro.',
      'audio-capture':     'Micro non accessible. Vérifie les permissions.',
      'not-allowed':       'Permission microphone refusée. Active-la dans les paramètres.',
      'network':           'Erreur réseau — STT nécessite internet (Chrome).',
      'aborted':           null, // ignoré (arrêt volontaire)
      'service-not-allowed': 'Service STT non autorisé sur ce navigateur.',
    };
    const msg = messages[event.error];
    if (msg === null) return;
    if (onError) onError(msg || `Erreur STT: ${event.error}`);
  };

  rec.onend = () => {
    voiceState.isListening = false;
  };

  try {
    rec.start();
    return true;
  } catch (e) {
    voiceState.isListening = false;
    if (onError) onError(`Impossible de démarrer le micro: ${e.message}`);
    return false;
  }
}

/** Arrête l'écoute vocale. */
function stopListening() {
  if (voiceState.recognition) {
    try { voiceState.recognition.stop(); } catch (_) {}
    voiceState.recognition = null;
  }
  voiceState.isListening = false;
}

/** Active/désactive le STT. */
function toggleSTT(enabled) {
  voiceState.sttEnabled = enabled;
  if (!enabled) stopListening();
}

// ─── ÉTAT ET GETTERS ─────────────────────────────────────────

/** Retourne si le TTS est actif et supporté. */
function isTTSActive() {
  return voiceState.ttsSupported && voiceState.ttsEnabled;
}

/** Retourne si le STT est actif et supporté. */
function isSTTActive() {
  return voiceState.sttSupported && voiceState.sttEnabled;
}

/** Retourne si l'écoute est en cours. */
function isCurrentlyListening() {
  return voiceState.isListening;
}

/** Retourne l'état complet du module vocal (pour UI). */
function getVoiceStatus() {
  return {
    ttsSupported: voiceState.ttsSupported,
    ttsEnabled: voiceState.ttsEnabled,
    sttSupported: voiceState.sttSupported,
    sttEnabled: voiceState.sttEnabled,
    isListening: voiceState.isListening,
    onlineRequired: !navigator.onLine,
  };
}
