// saveModule.js — CTI English PWA
// Sauvegarde de la progression en localStorage (mode hors ligne)
// La clé API n'est JAMAIS sauvegardée (sécurité)
// Expiration automatique après 7 jours
'use strict';

const SAVE_KEY      = 'cti-session-save';
const SAVE_MAX_AGE  = 7 * 24 * 60 * 60 * 1000; // 7 jours en ms

// ─── SAUVEGARDE ───────────────────────────────────────────────
/**
 * Sauvegarde la progression courante dans localStorage.
 * @param {Object} state  sessionState courant (getState())
 * @returns {boolean} true si succès
 */
function saveProgress(state) {
  if (!window.localStorage) return false;
  try {
    const snapshot = {
      level:       state.level,
      language:    state.language || 'en',
      totalCorrect:  state.totalCorrect,
      totalQuestions: state.totalQuestions,
      streak:      state.streak,
      streakErrors: state.streakErrors,
      categories:  state.categories,
      history:     (state.history || []).slice(-30), // max 30 entrées
      consecutiveErrorsByCategory: state.consecutiveErrorsByCategory || {},
      levelSuggestionShown: state.levelSuggestionShown || false,
      startTime:   state.startTime,
      savedAt:     Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (e) {
    console.warn('[Save] Échec sauvegarde :', e.message);
    return false;
  }
}

// ─── CHARGEMENT ───────────────────────────────────────────────
/**
 * Charge la sauvegarde depuis localStorage.
 * Retourne null si absente ou expirée.
 * @returns {Object|null}
 */
function loadProgress() {
  if (!window.localStorage) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.savedAt) return null;
    // Expiration 7 jours
    if (Date.now() - data.savedAt > SAVE_MAX_AGE) {
      clearProgress();
      return null;
    }
    // Données minimales requises
    if (typeof data.totalQuestions !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

// ─── EFFACEMENT ───────────────────────────────────────────────
/** Supprime la sauvegarde. */
function clearProgress() {
  if (!window.localStorage) return;
  localStorage.removeItem(SAVE_KEY);
}

// ─── PRÉSENCE ─────────────────────────────────────────────────
/** Retourne true si une sauvegarde valide existe. */
function hasSavedProgress() {
  return loadProgress() !== null;
}

// ─── RÉSUMÉ LISIBLE ───────────────────────────────────────────
/**
 * Retourne un objet résumé pour l'affichage de la bannière de reprise.
 * @returns {{ level, language, pct, totalQuestions, streak, savedAgo, levelLabel, langFlag } | null}
 */
function getSaveSummary() {
  const data = loadProgress();
  if (!data) return null;
  const pct = data.totalQuestions > 0
    ? Math.round(data.totalCorrect / data.totalQuestions * 100) : 0;
  const ageMs  = Date.now() - (data.savedAt || Date.now());
  const ageMin = Math.floor(ageMs / 60000);
  const ageH   = Math.floor(ageMin / 60);
  const ageD   = Math.floor(ageH   / 24);
  let savedAgo;
  if (ageD >= 1)      savedAgo = `il y a ${ageD} jour${ageD > 1 ? 's' : ''}`;
  else if (ageH >= 1) savedAgo = `il y a ${ageH}h`;
  else                savedAgo = `il y a ${ageMin} min`;

  const levelLabels = { starter: 'Starter 🌱', builder: 'Builder 🔨', challenger: 'Challenger 🏆' };
  const langFlag    = data.language === 'es' ? '🇪🇸' : '🇬🇧';
  return {
    level:          data.level || 'starter',
    language:       data.language || 'en',
    pct,
    totalQuestions: data.totalQuestions || 0,
    totalCorrect:   data.totalCorrect   || 0,
    streak:         data.streak         || 0,
    savedAgo,
    levelLabel:     levelLabels[data.level] || data.level,
    langFlag,
  };
}
