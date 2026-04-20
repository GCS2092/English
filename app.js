// ============================================================
// app.js — CTI English PWA — Orchestrateur principal
// Gère l'UI, les transitions d'état, online/offline,
// la boucle de questions et l'intégration de tous les modules.
// ============================================================
'use strict';

// ─── ÉTAT GLOBAL DE L'APPLICATION ───────────────────────────
const App = {
  currentQuestion: null,
  currentCategory: null,
  timerInterval: null,
  questionStartTime: null,
  pendingAIRequest: false,
  initialized: false,
};

// ─── INITIALISATION ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _initOnlineStatus();
  _initVoice();
  _bindStaticEvents();
  _showScreen('screen-welcome');
  _registerServiceWorker();
});

function _registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ─── GESTION ONLINE / OFFLINE ────────────────────────────────
function _initOnlineStatus() {
  const update = () => {
    const online = navigator.onLine;
    setOnlineStatus(online);
    document.querySelectorAll('.badge-online-status').forEach(badge => {
      badge.textContent = online ? '● En ligne' : '● Hors ligne';
      badge.className = `badge-online-status ${online ? 'badge-online' : 'badge-offline'}`;
    });
    _updateAIStatusBar();
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ─── INITIALISATION VOIX ─────────────────────────────────────
function _initVoice() {
  const result = initVoiceModule();
  const ttsBtn = document.getElementById('btn-tts');
  const sttBtn = document.getElementById('btn-stt');
  if (ttsBtn) ttsBtn.disabled = !result.ttsOk;
  if (sttBtn) sttBtn.disabled = !result.sttOk;
}

// ─── BINDING ÉVÉNEMENTS STATIQUES ───────────────────────────
function _bindStaticEvents() {
  // Bouton démarrer → écran sélection niveau
  _on('btn-start', 'click', () => _showScreen('screen-level'));

  // Sélection niveau
  ['starter', 'builder', 'challenger'].forEach(lvl => {
    _on(`btn-level-${lvl}`, 'click', () => _onLevelSelected(lvl));
  });

  // Clé API — toggle affichage
  _on('btn-toggle-apikey', 'click', () => {
    const inp = document.getElementById('input-apikey');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Valider la clé API
  _on('btn-validate-apikey', 'click', _onValidateApiKey);

  // Bouton suivant (après correction)
  _on('btn-next', 'click', _nextQuestion);

  // TTS toggle
  _on('btn-tts', 'click', () => {
    const active = !getVoiceStatus().ttsEnabled;
    toggleTTS(active);
    _toggleBtnActive('btn-tts', active);
    if (active && App.currentQuestion) {
      speakQuestion(App.currentQuestion, getState().level);
    }
  });

  // STT toggle
  _on('btn-stt', 'click', () => {
    if (isCurrentlyListening()) {
      stopListening();
      _toggleBtnActive('btn-stt', false);
    } else {
      _startSTT();
    }
  });

  // Soumettre réponse lacune/traduction via Entrée
  _on('input-answer', 'keydown', e => {
    if (e.key === 'Enter') _onSubmitFreeText();
  });
  _on('btn-submit-text', 'click', _onSubmitFreeText);

  // Export
  _on('btn-export-pdf', 'click', _onExportPDF);
  _on('btn-export-json', 'click', _onExportJSON);
  _on('btn-share', 'click', _onShare);

  // Recommencer
  _on('btn-restart', 'click', () => _showScreen('screen-welcome'));

  // Changer de niveau depuis la barre de progression
  _on('btn-change-level', 'click', () => _showScreen('screen-level'));

  // Accepter suggestion de niveau
  _on('btn-level-accept', 'click', () => {
    const suggestion = document.getElementById('level-suggestion-text');
    const newLevel = suggestion?.dataset?.newLevel;
    if (newLevel) { setLevel(newLevel); _hideLevelSuggestion(); _nextQuestion(); }
  });
  _on('btn-level-decline', 'click', () => { _hideLevelSuggestion(); _nextQuestion(); });
}

// ─── SÉLECTION DU NIVEAU ─────────────────────────────────────
function _onLevelSelected(level) {
  _showScreen('screen-apikey');
  document.getElementById('selected-level-display').textContent =
    { starter: 'Starter 🌱', builder: 'Builder 🔨', challenger: 'Challenger 🏆' }[level] || level;
  document.getElementById('selected-level-display').dataset.level = level;
}

// ─── VALIDATION CLÉ API ──────────────────────────────────────
async function _onValidateApiKey() {
  const level = document.getElementById('selected-level-display')?.dataset?.level || 'builder';
  const keyInput = document.getElementById('input-apikey');
  const key = keyInput?.value?.trim() || '';

  // Initialiser la session (avec ou sans clé)
  initSession(level, key);

  if (!key) {
    _showToast('Mode hors ligne — questions statiques uniquement.', 'info');
    _startGame();
    return;
  }

  const btn = document.getElementById('btn-validate-apikey');
  _setLoading(btn, true);

  try {
    const valid = await testApiKey(key);
    if (valid) {
      _showToast('Clé API validée ✅', 'success');
      _startGame();
    } else {
      _showToast('Clé API invalide. Mode hors ligne activé.', 'warning');
      setApiKey('');
      _startGame();
    }
  } catch (_) {
    _showToast('Impossible de vérifier la clé. Mode hors ligne.', 'warning');
    _startGame();
  } finally {
    _setLoading(btn, false);
  }
}

// ─── DÉMARRAGE DU JEU ────────────────────────────────────────
function _startGame() {
  _showScreen('screen-game');
  _updateDashboard();
  // Démarrer le chronomètre de session
  if (App.timerInterval) clearInterval(App.timerInterval);
  App.timerInterval = setInterval(() => {
    const stats = computeDashboardStats(getState());
    _setText('dash-duration', stats.duration);
  }, 1000);
  _nextQuestion();
}

// ─── PROCHAINE QUESTION ──────────────────────────────────────
async function _nextQuestion() {
  _hideAll(['section-correction', 'section-options', 'section-freetext',
            'section-conjugaison', 'btn-next', 'level-suggestion']);
  // Réinitialiser le hint pour la prochaine question
  const hintEl = document.getElementById('question-hint');
  if (hintEl) { hintEl.textContent = ''; hintEl.style.display = 'none'; }
  _show('section-question-loader');

  const state = getState();
  const allCats = getAllCategories();

  // Sélection de la catégorie
  const category = selectWeightedCategory(allCats, state.categories);
  App.currentCategory = category;
  _updateAdaptivePanel();

  // Vérifier si on doit générer via IA
  const poolSize = getPoolSizeForCategory(category);
  const catStats = state.categories[category];
  const askedIds = getAskedQuestionIds();
  const wantsAI = shouldGenerateAI(category, catStats, poolSize) &&
                  state.apiKey && state.isOnline && !App.pendingAIRequest;

  let question = null;

  if (wantsAI) {
    App.pendingAIRequest = true;
    _show('section-ai-loader');
    try {
      const aiResult = await generateExercise({
        theme: category,
        level: state.level,
        recentErrors: getRecentErrors(category, 3),
        usedQuestions: getAskedQuestionTexts(),
        apiKey: state.apiKey,
      });
      if (aiResult && aiResult.exercise) {
        incrementAIGenerated(category);
        question = { ...aiResult.exercise, category };
      }
    } catch (_) {}
    App.pendingAIRequest = false;
    _hide('section-ai-loader');
  }

  // Fallback pool statique
  if (!question) {
    question = pickQuestion(category, state.level, askedIds);
  }

  // Pool totalement épuisé → recycler (réinitialiser les IDs)
  if (!question) {
    question = pickQuestion(category, state.level, []);
  }

  if (!question) {
    _showToast('Aucune question disponible pour cette catégorie.', 'warning');
    _hide('section-question-loader');
    return;
  }

  App.currentQuestion = question;
  _hide('section-question-loader');
  _renderQuestion(question, state.level);
}

// ─── RENDU D'UNE QUESTION ────────────────────────────────────
function _renderQuestion(question, level) {
  // En-tête catégorie & niveau
  _setText('question-category', question.category);
  _setText('question-level-badge',
    { starter: 'Starter 🌱', builder: 'Builder 🔨', challenger: 'Challenger 🏆' }[level] || level);

  // Numéro de question
  const st = getState();
  _setText('question-num', `Q${st.totalQuestions + 1}`);

  // Texte de la question
  _setText('question-text', question.question);
  const hintDiv = document.getElementById('question-hint');
  if (hintDiv) {
    hintDiv.textContent = question.hint || '';
    hintDiv.style.display = question.hint ? '' : 'none';
  }
  // Réinitialiser le bloc bilingue pour la prochaine correction
  const biEl = document.getElementById('correction-bilingual');
  if (biEl) biEl.style.display = 'none';
  _show('section-question');

  // Rendu selon le type
  switch (question.type) {
    case 'qcm':        _renderQCM(question); break;
    case 'lacune':     _renderFreeText(question, 'Complète la phrase...'); break;
    case 'traduction': _renderFreeText(question, 'Tape ta traduction...'); break;
    case 'conjugaison':_renderFreeText(question, 'Écris la forme correcte...'); break;
    default:           _renderQCM(question);
  }

  // TTS lecture automatique
  if (isTTSActive()) speakQuestion(question, level);

  // Démarrer chrono
  App.questionStartTime = Date.now();
}

// ─── RENDU QCM ───────────────────────────────────────────────
function _renderQCM(question) {
  const container = document.getElementById('section-options');
  container.innerHTML = '';
  const opts = question.options || [];
  const { options: shuffled, answerIndex: newIdx } = shuffleQCMOptions(opts, question.answer_index);
  App.currentQuestion = { ...question, _shuffledOptions: shuffled, _shuffledAnswerIdx: newIdx };

  const letters = ['A', 'B', 'C', 'D', 'E'];
  shuffled.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.index = i;
    btn.innerHTML = `<span class="option-letter">${letters[i] || (i+1)}</span><span>${opt}</span>`;
    btn.addEventListener('click', () => _onQCMAnswer(i));
    container.appendChild(btn);
  });
  _show('section-options');
}

// ─── RENDU TEXTE LIBRE ───────────────────────────────────────
function _renderFreeText(question, placeholder) {
  const inp = document.getElementById('input-answer');
  if (inp) { inp.value = ''; inp.placeholder = placeholder; }
  _show('section-freetext');
  if (inp) inp.focus();
}

// ─── RÉPONSE QCM ─────────────────────────────────────────────
function _onQCMAnswer(selectedIdx) {
  const q = App.currentQuestion;
  const correct = selectedIdx === q._shuffledAnswerIdx;
  const selectedText = q._shuffledOptions[selectedIdx];
  const correctText = q._shuffledOptions[q._shuffledAnswerIdx];

  // Colorer les boutons
  document.querySelectorAll('.option-btn').forEach(btn => {
    const idx = parseInt(btn.dataset.index, 10);
    btn.disabled = true;
    if (idx === q._shuffledAnswerIdx) btn.classList.add('option-correct');
    if (idx === selectedIdx && !correct) btn.classList.add('option-wrong');
  });

  _onAnswered({ correct, userAnswer: selectedText, correctAnswer: correctText });
}

// ─── RÉPONSE TEXTE LIBRE ─────────────────────────────────────
function _onSubmitFreeText() {
  const inp = document.getElementById('input-answer');
  const userAnswer = inp?.value?.trim() || '';
  if (!userAnswer) return;
  const q = App.currentQuestion;
  const { isCorrect } = compareAnswers(userAnswer, q.answer_text);
  _onAnswered({ correct: isCorrect, userAnswer, correctAnswer: q.answer_text });
}

// ─── RÉSULTAT D'UNE RÉPONSE ──────────────────────────────────
async function _onAnswered({ correct, userAnswer, correctAnswer }) {
  const q = App.currentQuestion;
  const elapsed = Date.now() - (App.questionStartTime || Date.now());

  // Enregistrer dans le state
  const triggers = recordAnswer({
    questionId: q.id,
    category: q.category,
    correct,
    question: q.question,
    userAnswer,
    correctAnswer,
    type: q.type,
  });

  // Feedback sonore/visuel
  _showFeedback(correct);
  _show('section-correction');
  _show('btn-next');

  // Mettre à jour la classe du header de correction
  const corrBox = document.getElementById('correction-box');
  if (corrBox) corrBox.className = `correction-header ${correct ? 'correct' : 'wrong'}`;

  // Correction statique — status + bonne réponse
  _setText('correction-status', correct ? '✅ Correct !' : '❌ Incorrect');
  _setText('correction-expected', correct ? `✔ ${correctAnswer}` : `Bonne réponse : ${correctAnswer}`);

  // Explications bilingues FR + EN
  const fr = q.explication_fr || '';
  const en = q.explication_en || '';
  _setText('correction-explanation', fr);
  _setText('correction-example', en);
  const bilingualEl = document.getElementById('correction-bilingual');
  if (bilingualEl) bilingualEl.style.display = (fr || en) ? '' : 'none';

  // TTS correction
  if (isTTSActive()) speakCorrection(correctAnswer, q.explication_en, getState().level);

  // Demande explication IA si erreur et connecté
  const state = getState();
  if (!correct && state.apiKey && state.isOnline) {
    _show('correction-ai-loader');
    try {
      const result = await explainError({
        question: q.question,
        userAnswer,
        correctAnswer,
        category: q.category,
        level: state.level,
        recentErrors: getRecentErrors(q.category, 3),
        apiKey: state.apiKey,
      });
      _hide('correction-ai-loader');
      if (result?.text) {
        _setText('correction-ai-text', result.text);
        _show('correction-ai-block');
      }
    } catch (_) {
      _hide('correction-ai-loader');
    }
  }

  // Mise à jour tableau de bord
  _updateDashboard();

  // Suggestion de niveau
  if (triggers?.levelSuggestion && !state.levelSuggestionShown) {
    const suggestion = computeLevelSuggestion(getSessionStats());
    if (suggestion.suggest) {
      _showLevelSuggestion(suggestion);
    }
  }

  // Mode révision IA si 3 erreurs consécutives sur la même catégorie
  if (triggers?.shouldRevise && triggers.revisionCategory && state.apiKey && state.isOnline) {
    _triggerRevision(triggers.revisionCategory);
  }

  // Rapport de session tous les 20 questions
  if (state.totalQuestions > 0 && state.totalQuestions % 20 === 0) {
    _triggerSessionReport();
  }
}

// ─── RÉVISION IA (3 erreurs consécutives) ────────────────────
async function _triggerRevision(category) {
  const state = getState();
  const errors = getRecentErrors(category, 3);
  if (errors.length === 0) return;
  try {
    const result = await generateRevision({
      category,
      level: state.level,
      specificErrors: errors,
      apiKey: state.apiKey,
    });
    if (result?.text) {
      _setText('session-report-text',
        `🔁 Révision — ${category}\n\n${result.text}`);
      _show('section-session-report');
    }
  } catch (_) {}
}

// ─── RAPPORT DE SESSION ──────────────────────────────────────
async function _triggerSessionReport() {
  const state = getState();
  if (!state.apiKey || !state.isOnline) return;
  try {
    const stats = getSessionStats();
    const report = await generateSessionReport({ stats, apiKey: state.apiKey });
    if (report?.text) {
      _setText('session-report-text', report.text);
      _show('section-session-report');
    }
  } catch (_) {}
}

// ─── MISE À JOUR TABLEAU DE BORD ─────────────────────────────
function _updateDashboard() {
  const stats = computeDashboardStats(getState());
  _setText('dash-score', stats.score);
  _setText('dash-percent', `${stats.percentage}%`);
  const streakEl = document.getElementById('dash-streak');
  if (streakEl) {
    streakEl.textContent = `🔥 ${stats.streak}`;
    streakEl.classList.toggle('streak-high', stats.streak >= 3);
  }
  _setText('dash-level', stats.level);
  _setText('dash-duration', stats.duration);

  const bar = document.getElementById('progress-bar-fill');
  if (bar) {
    bar.style.width = `${stats.percentage}%`;
    bar.className = 'progress-fill ' +
      (stats.percentage >= 70 ? 'progress-good' : stats.percentage >= 50 ? 'progress-mid' : 'progress-low');
  }
  _updateAdaptivePanel();
}

// ─── PANNEAU ADAPTATIF (moteur + IA) ───────────────────────────
function _updateAdaptivePanel() {
  const state = getState();

  // — Focus actuel (catégorie ciblée)
  if (App.currentCategory) {
    _setText('adapt-focus', App.currentCategory);
    const catSt = state.categories[App.currentCategory];
    let reason = 'Nouvelle';
    if (catSt && catSt.total > 0) {
      const sc = Math.round(catSt.ok / catSt.total * 100);
      reason = sc < 50 ? `Faible ${sc}%` : sc >= 80 ? `Fort ${sc}%` : `Moyen ${sc}%`;
    }
    _setText('adapt-reason', reason);
  }

  // — Statut IA
  _updateAIStatusBar();

  // — Questions générées par IA
  const aiCount = Object.values(state.categories)
    .reduce((sum, c) => sum + (c.generatedCount || 0), 0);
  _setText('adapt-ai-count', aiCount);

  // — Catégories faibles (score < 50%)
  const weakCount = Object.values(state.categories)
    .filter(c => c.total >= 2 && c.ok / c.total < 0.5).length;
  _setText('adapt-weak-count', weakCount);

  // — Grille catégories
  _renderCatGrid(state);
}

function _updateAIStatusBar() {
  const bar = document.getElementById('ai-status-bar');
  const txt = document.getElementById('ai-status-text');
  if (!bar || !txt) return;
  const state = getState();
  const hasKey = !!(state.apiKey);
  const online = state.isOnline;
  if (hasKey && online) {
    bar.className = 'ai-status-bar ai-active';
    txt.textContent = `IA Claude Sonnet — active (en ligne)`;
  } else if (hasKey && !online) {
    bar.className = 'ai-status-bar ai-inactive';
    txt.textContent = `IA : clé configurée, mais hors ligne`;
  } else {
    bar.className = 'ai-status-bar ai-inactive';
    txt.textContent = `IA : non configurée — mode statique (206 questions)`;
  }
}

function _renderCatGrid(state) {
  const grid = document.getElementById('cat-grid');
  if (!grid) return;
  const cats = Object.entries(state.categories)
    .filter(([, s]) => s.total > 0)
    .sort((a, b) => (a[1].ok / a[1].total) - (b[1].ok / b[1].total));

  if (cats.length === 0) {
    grid.innerHTML = '<div style="font-size:.8rem;color:var(--text3);font-style:italic;padding:4px 0">Réponds à quelques questions pour voir tes scores…</div>';
    return;
  }

  grid.innerHTML = cats.map(([name, s]) => {
    const pct = Math.round(s.ok / s.total * 100);
    const barClass = pct >= 70 ? 'cat-bar-good' : pct >= 50 ? 'cat-bar-mid' : 'cat-bar-low';
    const isCurrentFocus = name === App.currentCategory;
    return `<div class="cat-row" style="${isCurrentFocus ? 'background:var(--blue-pale2);border-radius:6px;padding:2px 4px;margin:0 -4px' : ''}">
      <span class="cat-row-name" title="${name}">${isCurrentFocus ? '🎯 ' : ''}${name}</span>
      <div class="cat-bar-wrap"><div class="cat-bar ${barClass}" style="width:${pct}%"></div></div>
      <span class="cat-score" style="color:${pct>=70?'var(--green)':pct>=50?'var(--gold)':'var(--red)'}">${pct}%</span>
    </div>`;
  }).join('');
}

// ─── SUGGESTION DE NIVEAU ────────────────────────────────────
function _showLevelSuggestion(suggestion) {
  const el = document.getElementById('level-suggestion');
  const text = document.getElementById('level-suggestion-text');
  if (!el || !text) return;
  text.textContent = suggestion.message;
  text.dataset.newLevel = suggestion.newLevel;
  _show('level-suggestion');
}

function _hideLevelSuggestion() {
  _hide('level-suggestion');
}

// ─── STT ─────────────────────────────────────────────────────
function _startSTT() {
  const inp = document.getElementById('input-answer');
  _toggleBtnActive('btn-stt', true);
  startListening({
    onTranscript: t => { if (inp) inp.value = t; },
    onFinal: t => {
      if (inp) inp.value = t;
      _toggleBtnActive('btn-stt', false);
    },
    onError: msg => {
      _showToast(msg, 'error');
      _toggleBtnActive('btn-stt', false);
    },
    onStart: () => _showToast('Parle maintenant... 🎤', 'info'),
  });
}

// ─── EXPORT ─────────────────────────────────────────────────
async function _onExportPDF() {
  const state = getState();
  const stats = getSessionStats();
  let aiText = '';
  if (state.apiKey && state.isOnline) {
    try {
      const r = await generateSessionReport({ stats, apiKey: state.apiKey });
      aiText = r?.text || '';
    } catch (_) {}
  }
  printReport(stats, aiText);
}

function _onExportJSON() {
  downloadSessionJSON(getState());
}

async function _onShare() {
  const stats = getSessionStats();
  const result = await shareScore(stats);
  if (result.message) _showToast(result.message, 'info');
}

// ─── FEEDBACK VISUEL ─────────────────────────────────────────
function _showFeedback(correct) {
  const el = document.getElementById('feedback-flash');
  if (!el) return;
  el.className = `feedback-flash ${correct ? 'feedback-correct' : 'feedback-wrong'}`;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 700);
}

// ─── NAVIGATION ÉCRANS ───────────────────────────────────────
function _showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
}

// ─── TOAST ───────────────────────────────────────────────────
let _toastTimer = null;
function _showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast toast-${type} toast-show`;
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('toast-show'), 3500);
}

// ─── HELPERS ─────────────────────────────────────────────────
function _on(id, event, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _show(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
}

function _hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function _hideAll(ids) { ids.forEach(_hide); }

function _setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Vérification...' : 'Continuer →';
}

function _toggleBtnActive(id, active) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('btn-active', active);
}
