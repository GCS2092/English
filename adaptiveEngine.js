// ============================================================
// adaptiveEngine.js — CTI English PWA
// Algorithme de sélection adaptative des questions
// Sélection pondérée par score, fréquence, erreurs récentes
// Gestion des niveaux et montée/descente automatique
// ============================================================

'use strict';

// ─── POIDS DE SÉLECTION ───────────────────────────────────────
// Plus le score est bas → plus la catégorie est prioritaire
// Formule : poids = (1 - score) * multiplicateur

const WEIGHT_CONFIG = {
  baseWeight: 1,
  lowScoreBoost: 3,      // ×3 si score < 50%
  highScoreReduction: 0.3, // ×0.3 si score > 80% ET ≥5 questions
  neverSeenBoost: 2,     // ×2 si catégorie jamais vue
  recentErrorBoost: 1.5, // ×1.5 par erreur récente (max 3)
};

// ─── SÉLECTION D'UNE CATÉGORIE PONDÉRÉE ──────────────────────
/**
 * Sélectionne une catégorie de façon pondérée selon les performances.
 * Les catégories avec les scores les plus faibles sont les plus probables.
 *
 * @param {string[]} allCategories  toutes les catégories disponibles
 * @param {Object}   categoryStats  objet sessionState.categories
 * @returns {string}  catégorie sélectionnée
 */
function selectWeightedCategory(allCategories, categoryStats) {
  if (!allCategories || allCategories.length === 0) return null;

  const weights = allCategories.map(cat => {
    const s = categoryStats[cat];
    let w = WEIGHT_CONFIG.baseWeight;

    if (!s || s.total === 0) {
      // Jamais vue → priorité modérée pour couvrir toutes les catégories
      w *= WEIGHT_CONFIG.neverSeenBoost;
      return { cat, weight: w };
    }

    const score = s.ok / s.total;

    if (score < 0.5) {
      w *= WEIGHT_CONFIG.lowScoreBoost;
    } else if (score > 0.8 && s.total >= 5) {
      w *= WEIGHT_CONFIG.highScoreReduction;
    } else {
      // Score intermédiaire : poids proportionnel à (1 - score)
      w *= Math.max(0.2, 1 - score);
    }

    // Boost pour erreurs récentes
    const recentErrCount = Math.min(s.errors ? s.errors.length : 0, 3);
    w *= 1 + recentErrCount * (WEIGHT_CONFIG.recentErrorBoost - 1);

    return { cat, weight: Math.max(0.01, w) };
  });

  // Sélection aléatoire pondérée
  const totalWeight = weights.reduce((sum, x) => sum + x.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const { cat, weight } of weights) {
    rand -= weight;
    if (rand <= 0) return cat;
  }
  return weights[weights.length - 1].cat;
}

// ─── SÉLECTION D'UNE QUESTION DANS LE POOL ───────────────────
/**
 * Sélectionne une question non encore posée dans la catégorie/niveau cible.
 * Filtre par niveau adaptatif.
 *
 * @param {Object[]} pool          tableau de toutes les questions statiques
 * @param {string}   category      catégorie cible
 * @param {string}   level         niveau courant
 * @param {string[]} askedIds      IDs déjà posés dans cette catégorie
 * @returns {{ question: Object|null, poolExhausted: boolean }}
 */
function selectQuestion(pool, category, level, askedIds = []) {
  const levelOrder = { starter: 0, builder: 1, challenger: 2 };
  const currentLevelIdx = levelOrder[level] ?? 0;

  // Filtre : bonne catégorie + niveau compatible + pas encore posée
  const candidates = pool.filter(q =>
    q.category === category &&
    !askedIds.includes(q.id) &&
    (levelOrder[q.level ?? 'starter'] ?? 0) <= currentLevelIdx
  );

  if (candidates.length === 0) {
    // Tenter sans filtre de niveau (prendre tout ce qui n'a pas été posé)
    const anyLevel = pool.filter(q =>
      q.category === category &&
      !askedIds.includes(q.id)
    );
    if (anyLevel.length === 0) {
      return { question: null, poolExhausted: true };
    }
    // Choisir aléatoirement
    return { question: anyLevel[Math.floor(Math.random() * anyLevel.length)], poolExhausted: false };
  }

  // Préférer les questions jamais vues au niveau exact
  const exactLevel = candidates.filter(q => (q.level ?? 'starter') === level);
  const pick = exactLevel.length > 0 ? exactLevel : candidates;
  return { question: pick[Math.floor(Math.random() * pick.length)], poolExhausted: false };
}

// ─── MÉLANGE FISHER-YATES ─────────────────────────────────────
/**
 * Mélange un tableau en place (Fisher-Yates).
 * @param {Array} arr
 * @returns {Array}
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── MÉLANGE DES OPTIONS QCM ─────────────────────────────────
/**
 * Mélange les options d'un QCM et ajuste l'index de la bonne réponse.
 * @param {string[]} options
 * @param {number}   answerIndex  index original de la bonne réponse
 * @returns {{ options: string[], answerIndex: number }}
 */
function shuffleQCMOptions(options, answerIndex) {
  const correct = options[answerIndex];
  const shuffled = shuffle([...options]);
  return {
    options: shuffled,
    answerIndex: shuffled.indexOf(correct),
  };
}

// ─── SUGGESTION DE CHANGEMENT DE NIVEAU ──────────────────────
/**
 * Calcule si un changement de niveau doit être suggéré.
 * @param {Object} sessionStats  résultat de getSessionStats()
 * @returns {{ suggest: boolean, direction: 'up'|'down'|null, newLevel: string|null, message: string }}
 */
function computeLevelSuggestion(sessionStats) {
  const { level, percentage, totalQuestions } = sessionStats;
  if (totalQuestions < 5) return { suggest: false, direction: null, newLevel: null, message: '' };

  const levelProgression = { starter: 'builder', builder: 'challenger', challenger: null };
  const levelRegression  = { starter: null, builder: 'starter', challenger: 'builder' };

  // Seuils : 70% Starter→Builder, 85% Builder→Challenger
  const upThresholds   = { starter: 70, builder: 85, challenger: 999 };
  const downThresholds = { starter: 0,  builder: 45, challenger: 55 };

  if (percentage >= upThresholds[level] && levelProgression[level]) {
    return {
      suggest: true,
      direction: 'up',
      newLevel: levelProgression[level],
      message: `🎉 Bravo ! Tu es prêt(e) pour le niveau ${_levelLabel(levelProgression[level])} !`,
    };
  }
  if (percentage < downThresholds[level] && levelRegression[level]) {
    return {
      suggest: true,
      direction: 'down',
      newLevel: levelRegression[level],
      message: `💡 On va consolider les bases en passant au niveau ${_levelLabel(levelRegression[level])}.`,
    };
  }
  return { suggest: false, direction: null, newLevel: null, message: '' };
}

function _levelLabel(level) {
  return { starter: 'Starter 🌱', builder: 'Builder 🔨', challenger: 'Challenger 🏆' }[level] || level;
}

// ─── SCORE PAR CATÉGORIE ─────────────────────────────────────
/**
 * Retourne le score (0-1) d'une catégorie.
 * @param {Object} categoryStats   sessionState.categories[cat]
 * @returns {number}
 */
function getCategoryScore(categoryStats) {
  if (!categoryStats || categoryStats.total === 0) return -1; // jamais vue
  return categoryStats.ok / categoryStats.total;
}

// ─── DÉCISION : GÉNÉRER VIA IA ? ─────────────────────────────
/**
 * Décide si une nouvelle question IA doit être générée pour une catégorie.
 * Conditions : pool épuisé OU score > 80% avec ≥5 questions posées.
 *
 * @param {string}   category
 * @param {Object}   catStats       sessionState.categories[category]
 * @param {number}   staticPoolSize nombre de questions statiques pour cette catégorie
 * @returns {boolean}
 */
function shouldGenerateAI(category, catStats, staticPoolSize) {
  if (!catStats) return false;
  const askedStatic = (catStats.askedIds || []).filter(id => !String(id).startsWith('ai-')).length;
  const poolExhausted = askedStatic >= staticPoolSize;
  const highScore = catStats.total >= 5 && (catStats.ok / catStats.total) > 0.8;
  return poolExhausted || highScore;
}

// ─── NORMALISATION DE RÉPONSE (pour STT) ─────────────────────
/**
 * Normalise une chaîne pour comparaison tolérante.
 * (lowercase, sans ponctuation, contractions développées)
 * @param {string} s
 * @returns {string}
 */
function normalizeAnswer(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/don't/g, 'do not')
    .replace(/doesn't/g, 'does not')
    .replace(/didn't/g, 'did not')
    .replace(/i'm/g, 'i am')
    .replace(/i've/g, 'i have')
    .replace(/i'll/g, 'i will')
    .replace(/won't/g, 'will not')
    .replace(/can't/g, 'cannot')
    .replace(/isn't/g, 'is not')
    .replace(/aren't/g, 'are not')
    .replace(/wasn't/g, 'was not')
    .replace(/weren't/g, 'were not')
    .replace(/haven't/g, 'have not')
    .replace(/hasn't/g, 'has not')
    .replace(/[?.!,;:'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compare deux réponses avec tolérance (seuil 65% des mots).
 * @param {string} userAnswer
 * @param {string} expectedAnswer
 * @returns {{ isCorrect: boolean, score: number }}
 */
function compareAnswers(userAnswer, expectedAnswer) {
  const u = normalizeAnswer(userAnswer);
  const e = normalizeAnswer(expectedAnswer);

  if (u === e) return { isCorrect: true, score: 1 };

  const eWords = e.split(/\s+/).filter(Boolean);
  const uWords = u.split(/\s+/).filter(Boolean);
  const matches = eWords.filter(w => uWords.includes(w)).length;
  const score = eWords.length > 0 ? matches / eWords.length : 0;

  return { isCorrect: score >= 0.65, score };
}

// ─── STATISTIQUES DE SESSION ──────────────────────────────────
/**
 * Retourne un objet résumé pour le tableau de bord.
 * @param {Object} sessionState  état complet de la session
 * @returns {Object}
 */
function computeDashboardStats(sessionState) {
  const total = sessionState.totalQuestions;
  const correct = sessionState.totalCorrect;
  const pct = total > 0 ? Math.round(correct / total * 100) : 0;
  const duration = Date.now() - (sessionState.startTime || Date.now());
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  let weakestCat = null;
  let lowestScore = Infinity;
  Object.entries(sessionState.categories || {}).forEach(([name, s]) => {
    if (s.total > 0) {
      const sc = s.ok / s.total;
      if (sc < lowestScore) { lowestScore = sc; weakestCat = name; }
    }
  });

  return {
    score: `${correct}/${total}`,
    percentage: pct,
    streak: sessionState.streak,
    level: sessionState.level,
    duration: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    weakestCategory: weakestCat,
    weakestScore: weakestCat ? Math.round(lowestScore * 100) : null,
    isOnline: sessionState.isOnline,
  };
}
