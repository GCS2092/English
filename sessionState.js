// ============================================================
// sessionState.js — CTI English PWA
// Objet d'état de session + toutes les fonctions de mise à jour
// Pas de localStorage / sessionStorage / IndexedDB (volontaire)
// Tout est en mémoire JS pure — perdu au rechargement
// ============================================================

'use strict';

// ─── CONFIGURATION DES NIVEAUX ───────────────────────────────
const LEVELS = {
  starter: {
    label: 'Starter',
    icon: '🌱',
    emoji: '🌱',
    ttsRate: 0.8,
    maxTokensExplain: 400,
    maxTokensGenerate: 600,
    maxTokensRevision: 350,
    maxTokensReport: 800,
    thresholdUp: 0.70,
    thresholdDown: null,
    promptLang: '80% français, 20% anglais',
    description: 'Niveau débutant — questions courtes, indices visuels, traductions',
  },
  builder: {
    label: 'Builder',
    icon: '🔨',
    emoji: '🔨',
    ttsRate: 1.0,
    maxTokensExplain: 400,
    maxTokensGenerate: 600,
    maxTokensRevision: 350,
    maxTokensReport: 800,
    thresholdUp: 0.85,
    thresholdDown: 0.45,
    promptLang: '50% français, 50% anglais',
    description: 'Niveau intermédiaire — tous les modules actifs',
  },
  challenger: {
    label: 'Challenger',
    icon: '🏆',
    emoji: '🏆',
    ttsRate: 1.2,
    maxTokensExplain: 400,
    maxTokensGenerate: 600,
    maxTokensRevision: 350,
    maxTokensReport: 800,
    thresholdUp: null,
    thresholdDown: 0.55,
    promptLang: 'majorité anglais, glossaire FR en bas',
    description: 'Niveau avancé — pièges grammaticaux, traduction, génération libre',
  },
};

// ─── ÉTAT DE SESSION PRINCIPAL ───────────────────────────────
let sessionState = _createFreshState('starter', null);

/**
 * Fabrique un objet d'état vierge.
 * @param {string} level
 * @param {string|null} apiKey
 */
function _createFreshState(level, apiKey) {
  return {
    level: LEVELS[level] ? level : 'starter',
    startTime: Date.now(),
    totalQuestions: 0,
    totalCorrect: 0,
    streak: 0,
    streakErrors: 0,
    timePerQuestion: [],           // [{ questionId, ms }]
    apiKey: apiKey,                // jamais persisté
    isOnline: navigator.onLine,
    categories: {},                // { [catName]: CategoryStats }
    history: [],                   // toutes questions posées + réponses
    lastQuestionTime: Date.now(),
    consecutiveErrorsByCategory: {}, // { [cat]: number }
    levelSuggestionShown: false,   // éviter de répéter la suggestion
    sessionId: `cti-${Date.now()}`,
  };
}

// ─── INITIALISATION ──────────────────────────────────────────
/**
 * Démarre une nouvelle session ou remet à zéro.
 * @param {string} level   'starter' | 'builder' | 'challenger'
 * @param {string} apiKey  clé Anthropic — stockée en JS uniquement
 * @returns {Object} le nouvel état
 */
function initSession(level = 'starter', apiKey = null) {
  sessionState = _createFreshState(level, apiKey);
  return sessionState;
}

// ─── GESTION DES CATÉGORIES ───────────────────────────────────
/**
 * Retourne les stats d'une catégorie (initialise si absente).
 * @param {string} category
 */
function getCategoryStats(category) {
  if (!sessionState.categories[category]) {
    sessionState.categories[category] = {
      ok: 0,
      total: 0,
      errors: [],          // max 5 dernières erreurs
      lastSeen: null,
      generatedCount: 0,   // nb de questions générées par IA
      askedIds: [],        // IDs des questions déjà posées
    };
  }
  return sessionState.categories[category];
}

// ─── ENREGISTREMENT D'UNE RÉPONSE ────────────────────────────
/**
 * Enregistre le résultat d'une question et met à jour toutes les stats.
 * @param {Object} p
 * @param {string} p.questionId      identifiant unique
 * @param {string} p.category        catégorie grammaticale
 * @param {boolean} p.correct        bonne réponse ?
 * @param {string} p.question        texte de la question
 * @param {string} p.userAnswer      réponse de l'élève
 * @param {string} p.correctAnswer   bonne réponse attendue
 * @param {string} [p.type]          'qcm'|'lacune'|'traduction'|'conjugaison'
 * @returns {AdaptiveTriggers}
 */
function recordAnswer({ questionId, category, correct, question, userAnswer, correctAnswer, type = 'qcm' }) {
  const now = Date.now();
  const elapsed = sessionState.lastQuestionTime ? now - sessionState.lastQuestionTime : 0;

  // Compteurs globaux
  sessionState.totalQuestions++;
  if (correct) {
    sessionState.totalCorrect++;
    sessionState.streak++;
    sessionState.streakErrors = 0;
  } else {
    sessionState.streak = 0;
    sessionState.streakErrors++;
  }

  // Temps par question
  sessionState.timePerQuestion.push({ questionId, ms: elapsed });
  sessionState.lastQuestionTime = now;

  // Stats par catégorie
  const cat = getCategoryStats(category);
  cat.total++;
  cat.lastSeen = now;
  if (questionId && !cat.askedIds.includes(questionId)) {
    cat.askedIds.push(questionId);
  }

  if (correct) {
    cat.ok++;
    sessionState.consecutiveErrorsByCategory[category] = 0;
  } else {
    // Garder les 5 dernières erreurs
    cat.errors.unshift({ question, userAnswer, correctAnswer });
    if (cat.errors.length > 5) cat.errors.pop();
    const prev = sessionState.consecutiveErrorsByCategory[category] || 0;
    sessionState.consecutiveErrorsByCategory[category] = prev + 1;
  }

  // Historique complet
  sessionState.history.push({
    questionId, category, type,
    question, userAnswer, correctAnswer,
    correct, ms: elapsed,
    timestamp: now,
  });

  return _computeAdaptiveTriggers(category, elapsed);
}

// ─── DÉCLENCHEURS ADAPTATIFS ─────────────────────────────────
/**
 * Calcule les actions adaptatives après chaque réponse.
 * @param {string} category
 * @param {number} elapsed  ms pour répondre
 * @returns {AdaptiveTriggers}
 *
 * @typedef {Object} AdaptiveTriggers
 * @property {boolean} shouldRevise        mode révision IA obligatoire
 * @property {string|null} revisionCategory  catégorie à réviser
 * @property {boolean} tooSlow             question trop difficile
 * @property {'up'|'down'|null} levelSuggestion  suggestion de changement de niveau
 * @property {boolean} poolExhausted       pool statique épuisé → générer via IA
 */
function _computeAdaptiveTriggers(category, elapsed) {
  const consec = sessionState.consecutiveErrorsByCategory[category] || 0;
  const result = {
    shouldRevise: false,
    revisionCategory: null,
    tooSlow: elapsed > 20000,
    levelSuggestion: null,
    poolExhausted: false,
  };

  // 3 erreurs consécutives → révision obligatoire
  if (consec >= 3) {
    result.shouldRevise = true;
    result.revisionCategory = category;
    sessionState.consecutiveErrorsByCategory[category] = 0;
  }

  // Suggestion changement de niveau (≥5 questions pour fiabilité)
  if (sessionState.totalQuestions >= 5 && !sessionState.levelSuggestionShown) {
    const globalScore = sessionState.totalCorrect / sessionState.totalQuestions;
    const cfg = LEVELS[sessionState.level];
    if (cfg.thresholdUp !== null && globalScore >= cfg.thresholdUp) {
      result.levelSuggestion = 'up';
    } else if (cfg.thresholdDown !== null && globalScore < cfg.thresholdDown) {
      result.levelSuggestion = 'down';
    }
  }

  return result;
}

// ─── FONCTIONS D'ACCÈS ET MODIFICATION ───────────────────────

/** Change le niveau de la session. */
function setLevel(newLevel) {
  if (LEVELS[newLevel]) sessionState.level = newLevel;
}

/** Mémorise la clé API (jamais persistée sur disque). */
function setApiKey(key) {
  sessionState.apiKey = key;
}

/** Met à jour l'état de connexion. */
function setOnlineStatus(online) {
  sessionState.isOnline = online;
}

/** Marque qu'une question IA a été générée pour cette catégorie. */
function incrementAIGenerated(category) {
  const cat = getCategoryStats(category);
  cat.generatedCount++;
}

/** Retourne les N dernières erreurs d'une catégorie. */
function getRecentErrors(category, n = 3) {
  const cat = sessionState.categories[category];
  return cat ? cat.errors.slice(0, n) : [];
}

/** Retourne tous les IDs de questions déjà posées (pour éviter doublons IA). */
function getAskedQuestionIds() {
  const ids = new Set();
  Object.values(sessionState.categories).forEach(c => c.askedIds.forEach(id => ids.add(id)));
  return [...ids];
}

/** Retourne les textes de questions déjà posées (pour le prompt IA). */
function getAskedQuestionTexts() {
  return sessionState.history.map(h => h.question).slice(-20);
}

/**
 * Vérifie si le pool statique est épuisé pour une catégorie.
 * @param {string} category
 * @param {number} poolSize  taille du pool statique pour cette catégorie
 */
function needsAIGeneration(category, poolSize) {
  const cat = sessionState.categories[category];
  if (!cat) return false;
  const staticAsked = cat.askedIds.filter(id => !String(id).startsWith('ai-')).length;
  return staticAsked >= poolSize;
}

/** Retourne les catégories triées par score croissant (les plus faibles d'abord). */
function getWeakCategories() {
  return Object.entries(sessionState.categories)
    .filter(([, s]) => s.total > 0)
    .map(([name, s]) => ({
      name,
      score: s.total > 0 ? s.ok / s.total : 0,
      total: s.total,
      ok: s.ok,
      errors: s.errors,
    }))
    .sort((a, b) => a.score - b.score);
}

/** Calcule un résumé complet de la session pour l'export et le rapport IA. */
function getSessionStats() {
  const duration = Date.now() - sessionState.startTime;
  const pct = sessionState.totalQuestions > 0
    ? Math.round(sessionState.totalCorrect / sessionState.totalQuestions * 100) : 0;
  const avgMs = sessionState.timePerQuestion.length > 0
    ? sessionState.timePerQuestion.reduce((a, b) => a + b.ms, 0) / sessionState.timePerQuestion.length : 0;

  const catList = Object.entries(sessionState.categories)
    .map(([name, s]) => ({
      name,
      ok: s.ok,
      total: s.total,
      score: s.total > 0 ? Math.round(s.ok / s.total * 100) : 0,
      errors: s.errors,
      generatedCount: s.generatedCount,
    }))
    .sort((a, b) => a.score - b.score);

  return {
    sessionId: sessionState.sessionId,
    level: sessionState.level,
    levelLabel: LEVELS[sessionState.level].label,
    duration,
    durationMin: Math.floor(duration / 60000),
    durationSec: Math.floor((duration % 60000) / 1000),
    totalQuestions: sessionState.totalQuestions,
    totalCorrect: sessionState.totalCorrect,
    percentage: pct,
    streak: sessionState.streak,
    avgTimeSec: Math.round(avgMs / 1000),
    weakestCategory: catList[0] || null,
    strongestCategory: catList[catList.length - 1] || null,
    categories: catList,
    recentErrors: sessionState.history.filter(h => !h.correct).slice(-10),
    startTime: sessionState.startTime,
    isOnline: sessionState.isOnline,
    history: sessionState.history,
  };
}

/** Expose l'état brut (lecture seule pour l'affichage). */
function getState() {
  return sessionState;
}

/** Expose la config du niveau courant. */
function getCurrentLevelConfig() {
  return LEVELS[sessionState.level] || LEVELS.starter;
}

/** Expose tous les niveaux disponibles. */
function getAllLevels() {
  return LEVELS;
}
