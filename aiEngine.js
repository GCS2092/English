// ============================================================
// aiEngine.js — CTI English PWA
// 4 fonctions API Anthropic + gestion erreurs + fallback statique
// Modèle : claude-sonnet-4-20250514
// Timeout : 8s max · Queue : max 3 appels simultanés
// Zéro dépendance externe · Vanilla JS uniquement
// ============================================================

'use strict';

// ─── CONSTANTES API ───────────────────────────────────────────
const AI_MODEL    = 'claude-sonnet-4-20250514';
const AI_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const AI_TIMEOUT  = 8000;
const AI_MAX_CONCURRENT = 3;
const AI_VERSION  = '2023-06-01';

// ─── QUEUE DE REQUÊTES SIMULTANÉES ───────────────────────────
let _activeReqs = 0;
const _waitQueue = [];

function _acquireSlot() {
  if (_activeReqs < AI_MAX_CONCURRENT) {
    _activeReqs++;
    return Promise.resolve();
  }
  return new Promise(resolve => _waitQueue.push(resolve));
}

function _releaseSlot() {
  _activeReqs--;
  if (_waitQueue.length > 0) {
    _activeReqs++;
    _waitQueue.shift()();
  }
}

// ─── PROMPT SYSTÈME CTI ───────────────────────────────────────
/**
 * Construit le system prompt contextualisé au niveau de l'élève.
 * @param {string} level 'starter'|'builder'|'challenger'
 * @param {number} maxTokens
 */
function _buildSystemPrompt(level, maxTokens) {
  const levelNames = {
    starter:    'Débutant (Starter)',
    builder:    'Intermédiaire (Builder)',
    challenger: 'Avancé (Challenger)',
  };
  const langDirectives = {
    starter:    'Explique en français à 80%, anglais à 20%. Questions courtes, indices visuels, traductions systématiques. Sois très simple, rassurant et encourage beaucoup.',
    builder:    'Explique moitié français, moitié anglais. Questions équilibrées, indices disponibles si demandés. Sois pédagogique et motivant.',
    challenger: 'Réponds majoritairement en anglais. Ajoute un petit glossaire FR en bas si nécessaire. Questions complexes, pièges grammaticaux, pas d\'indices automatiques.',
  };
  return `Tu es un professeur d'anglais bienveillant et motivant pour des apprenants francophones du Sénégal (cours CTI, Dakar). Niveau actuel de l'élève : ${levelNames[level] || levelNames.builder}.
${langDirectives[level] || langDirectives.builder}

Le cours CTI couvre : To Be (présent/passé/interro/négatif), To Have (présent/passé, idiomes : nap/rest/bath/break/impediment/mercy/manners/knowledge/appetite/nausea/news), Present Perfect (Have/Has + Past Participle, Have+Just+PP), WH Questions (What/When/Where/Who/Whom/Whose/Which/Why/How), Beaucoup (Much/Many/A lot/Several/Plenty/Lots + règle dénombrable vs indénombrable), Idiomes To Be (hungry/thirsty/afraid/ashamed/lucky/seasick/fed up with/in a rush/tired of/sleepy/right/wrong/cold/hot/warm), Introduction (Nice to meet you!/Let me introduce.../I go by the name of.../May I present.../Glad/Pleased/Delighted to meet you!), Likes & Preferences (mad about/keen on/crazy about/I'd rather/I prefer/fond of/enjoy/into/have a spot for), Prétérit ordinaire (did/didn't), verbes irréguliers du cours (go→went, see→saw, buy→bought, write→wrote, eat→ate, take→took, give→gave, come→came, know→knew, find→found...).

Personnages récurrents : Diallo, Emma, Ben, Faby, Fatou, Winy, Abdou, Tony.
Utilise des exemples concrets du quotidien sénégalais : chaleur de Dakar, marché Sandaga, transport en commun (car rapide, Dakar Dem Dikk), football (Sénégal vs autres), famille élargie, téléphone Orange/Free, réseaux sociaux, ramadan, Touba, Saint-Louis.

Sois toujours encourageant, précis et pédagogique. Maximum ${maxTokens} tokens en tout.`;
}

// ─── APPEL API GÉNÉRIQUE ──────────────────────────────────────
/**
 * Effectue un appel HTTP vers Anthropic avec timeout et queue.
 * @param {Object} p
 * @param {string} p.apiKey
 * @param {string} p.systemPrompt
 * @param {string} p.userMessage
 * @param {number} p.maxTokens
 * @returns {Promise<string>} texte brut de la réponse Claude
 */
async function _callAPI({ apiKey, systemPrompt, userMessage, maxTokens }) {
  if (!apiKey) throw new Error('NO_API_KEY');
  if (!navigator.onLine) throw new Error('OFFLINE');

  await _acquireSlot();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT);

  try {
    const resp = await fetch(AI_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': AI_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!resp.ok) {
      let errMsg = `HTTP_${resp.status}`;
      try {
        const body = await resp.json();
        errMsg = body?.error?.message || errMsg;
      } catch (_) { /* ignore */ }
      if (resp.status === 429) throw new Error('RATE_LIMIT');
      if (resp.status === 401) throw new Error('INVALID_API_KEY');
      if (resp.status === 529) throw new Error('OVERLOADED');
      throw new Error(`API_ERROR: ${errMsg}`);
    }

    const data = await resp.json();
    return data?.content?.[0]?.text?.trim() || '';

  } catch (err) {
    if (err.name === 'AbortError') throw new Error('TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timer);
    _releaseSlot();
  }
}

// ─── [1] EXPLICATION D'ERREUR ─────────────────────────────────
/**
 * Explication pédagogique après une mauvaise réponse.
 * Input  : question, réponse élève, bonne réponse, catégorie, niveau, 3 erreurs récentes
 * Output : règle FR + exemple EN+FR + pourquoi incorrect + astuce mnémotechnique
 *
 * @param {Object} p
 * @param {string} p.question
 * @param {string} p.userAnswer
 * @param {string} p.correctAnswer
 * @param {string} p.category
 * @param {string} p.level
 * @param {Array}  p.recentErrors   [{ question, userAnswer, correctAnswer }]
 * @param {string} p.apiKey
 * @returns {Promise<{ text: string, fromAI: boolean }>}
 */
async function explainError({ question, userAnswer, correctAnswer, category, level, recentErrors = [], apiKey }) {
  const maxTokens = 400;
  const systemPrompt = _buildSystemPrompt(level, maxTokens);

  const errCtx = recentErrors.length > 0
    ? `\nContexte — erreurs récentes de l'élève sur "${category}" :\n` +
      recentErrors.map((e, i) =>
        `${i + 1}. Q: "${e.question}" → Élève: "${e.userAnswer}" (attendu: "${e.correctAnswer}")`
      ).join('\n')
    : '';

  const userMsg = `ERREUR DE L'ÉLÈVE
Question   : "${question}"
Réponse    : "${userAnswer}"
Attendu    : "${correctAnswer}"
Catégorie  : ${category}${errCtx}

Produis une explication pédagogique structurée en 4 points :
1. 📖 La règle grammaticale (1-2 phrases claires)
2. 💬 Un exemple en anglais avec sa traduction française
3. ❌ Pourquoi la réponse de l'élève était incorrecte (bref)
4. 💡 Une astuce mnémotechnique mémorable (lien avec le Sénégal si possible)

Sois bref, chaleureux et encourage l'élève à continuer.`;

  try {
    const text = await _callAPI({ apiKey, systemPrompt, userMessage: userMsg, maxTokens });
    return { text, fromAI: true };
  } catch (err) {
    console.warn('[AI] explainError →', err.message);
    return { text: _fallbackExplanation(category, correctAnswer, err.message), fromAI: false };
  }
}

// ─── [2] GÉNÉRATION D'EXERCICE ────────────────────────────────
/**
 * Génère un exercice JSON structuré quand le pool statique est épuisé
 * ou quand le score dépasse 80% sur une catégorie.
 *
 * @param {Object} p
 * @param {string} p.theme          catégorie/thème à couvrir
 * @param {string} p.level
 * @param {Array}  p.recentErrors
 * @param {Array}  p.usedQuestions  textes des questions déjà posées
 * @param {string} p.apiKey
 * @returns {Promise<{ exercise: Object|null, fromAI: boolean }>}
 */
async function generateExercise({ theme, level, recentErrors = [], usedQuestions = [], apiKey }) {
  const maxTokens = 600;
  const systemPrompt = _buildSystemPrompt(level, maxTokens);

  const avoid = usedQuestions.slice(-15).map(q => `- "${q}"`).join('\n') || 'aucune';
  const errCtx = recentErrors.length > 0
    ? '\nErreurs récentes à cibler :\n' +
      recentErrors.map(e => `- "${e.question}" (élève a dit: "${e.userAnswer}")`).join('\n')
    : '';

  const typeByLevel = {
    starter:    '"qcm" (4 options dont 2 proches)',
    builder:    '"qcm" ou "lacune" ou "conjugaison"',
    challenger: '"traduction" ou "conjugaison" ou "lacune"',
  };

  const userMsg = `Génère 1 exercice INÉDIT de type ${typeByLevel[level] || '"qcm"'} sur : "${theme}"${errCtx}

Questions DÉJÀ POSÉES à ne PAS reproduire :
${avoid}

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après) :
{
  "type": "qcm",
  "question": "...",
  "options": ["...", "...", "...", "..."],
  "answer_index": 0,
  "hint": "Indice optionnel en 1 phrase",
  "explication_fr": "Explication en français",
  "explication_en": "Explanation in English",
  "source_cours": "ex: Idiomes To Be / Conversation Diallo"
}

Pour type "lacune", "traduction" ou "conjugaison" : options peut être [] et answer_index: 0 pointe vers la réponse textuelle dans "answer_text".
Si type != "qcm", ajouter "answer_text": "réponse attendue".`;

  try {
    const text = await _callAPI({ apiKey, systemPrompt, userMessage: userMsg, maxTokens });
    const exercise = _parseExerciseJSON(text);
    return { exercise, fromAI: true };
  } catch (err) {
    console.warn('[AI] generateExercise →', err.message);
    return { exercise: null, fromAI: false };
  }
}

// ─── [3] MODE RÉVISION ────────────────────────────────────────
/**
 * Mini-cours structuré après 3 erreurs consécutives sur la même catégorie.
 * Output : règle bilingue FR|EN + 2 exemples sénégalais + 1 exercice pratique
 *
 * @param {Object} p
 * @param {string} p.category
 * @param {Array}  p.specificErrors  erreurs spécifiques commises
 * @param {string} p.level
 * @param {string} p.apiKey
 * @returns {Promise<{ text: string, fromAI: boolean }>}
 */
async function generateRevision({ category, specificErrors = [], level, apiKey }) {
  const maxTokens = 350;
  const systemPrompt = _buildSystemPrompt(level, maxTokens);

  const errList = specificErrors.length > 0
    ? specificErrors.map(e =>
        `• "${e.question}" → élève: "${e.userAnswer}" (attendu: "${e.correctAnswer}")`
      ).join('\n')
    : '• Erreurs diverses sur ce thème';

  const userMsg = `L'élève a fait 3 erreurs consécutives sur "${category}". Mode RÉVISION activé.

Erreurs commises :
${errList}

Produis un mini-cours bilingue FR|EN de révision (max 5 lignes) :
1. 📖 Règle principale (1-2 lignes, bilingue FR|EN)
2. 🌍 Exemple 1 ancré dans le quotidien sénégalais (Dakar, marché, chaleur, transport, foot, famille)
3. 🌍 Exemple 2 (aussi ancré au Sénégal, différent du premier)
4. ✏️ 1 exercice pratique immédiat avec sa réponse entre [crochets]

Termine avec une phrase très encourageante pour motiver l'élève !`;

  try {
    const text = await _callAPI({ apiKey, systemPrompt, userMessage: userMsg, maxTokens });
    return { text, fromAI: true };
  } catch (err) {
    console.warn('[AI] generateRevision →', err.message);
    return { text: _fallbackRevision(category), fromAI: false };
  }
}

// ─── [4] RAPPORT DE SESSION ───────────────────────────────────
/**
 * Analyse narrative complète de fin de session.
 * Output : points forts, points faibles, plan révision, 3 exercices prioritaires
 *
 * @param {Object} p
 * @param {Object} p.stats  résultat de getSessionStats()
 * @param {string} p.apiKey
 * @returns {Promise<{ text: string, fromAI: boolean }>}
 */
async function generateSessionReport({ stats, apiKey }) {
  const maxTokens = 800;
  const systemPrompt = _buildSystemPrompt(stats.level, maxTokens);

  const catTable = (stats.categories || []).map(c =>
    `• ${c.name}: ${c.ok}/${c.total} = ${c.score}%${c.score < 50 ? ' ⚠️' : c.score >= 75 ? ' ✅' : ''}`
  ).join('\n');

  const errTable = (stats.recentErrors || []).slice(0, 5).map(e =>
    `• "${e.question}" → élève: "${e.userAnswer || '—'}" (attendu: "${e.correctAnswer}")`
  ).join('\n') || '• Aucune erreur récente';

  const userMsg = `BILAN DE SESSION — CTI English Dakar
Niveau : ${stats.levelLabel} | Durée : ${stats.durationMin}min${stats.durationSec}s
Score global : ${stats.totalCorrect}/${stats.totalQuestions} (${stats.percentage}%)
Meilleure série : ${stats.streak} bonnes réponses consécutives

Résultats par catégorie :
${catTable || '• Aucune catégorie enregistrée'}

Dernières erreurs :
${errTable}

Génère une analyse structurée en 4 sections :
1. ✅ Points forts (encourageant, cite les catégories réussies)
2. 📈 Points à améliorer (constructif, pas décourageant)
3. 📅 Plan de révision personnalisé pour la prochaine session (3 priorités concrètes)
4. ✏️ 3 exercices prioritaires à refaire (cite juste le thème + type d'exercice)

Contextualise avec le programme CTI de Dakar. Termine par une phrase motivante.`;

  try {
    const text = await _callAPI({ apiKey, systemPrompt, userMessage: userMsg, maxTokens });
    return { text, fromAI: true };
  } catch (err) {
    console.warn('[AI] generateSessionReport →', err.message);
    return { text: _fallbackReport(stats), fromAI: false };
  }
}

// ─── PARSING JSON EXERCICE ────────────────────────────────────
/**
 * Extrait et valide l'objet JSON d'un exercice dans la réponse du modèle.
 * @param {string} rawText
 * @returns {Object} exercice validé
 * @throws {Error} si JSON invalide ou champs manquants
 */
function _parseExerciseJSON(rawText) {
  // Extraire le premier objet JSON même si le modèle ajoute du texte autour
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('NO_JSON_FOUND');

  let obj;
  try {
    obj = JSON.parse(match[0]);
  } catch (e) {
    throw new Error('JSON_PARSE_ERROR');
  }

  // Validation des champs obligatoires
  const required = ['type', 'question', 'explication_fr'];
  for (const f of required) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === '') {
      throw new Error(`MISSING_FIELD:${f}`);
    }
  }

  // Validation du type
  const validTypes = ['qcm', 'lacune', 'traduction', 'conjugaison'];
  if (!validTypes.includes(obj.type)) throw new Error('INVALID_TYPE');

  // Validation QCM
  if (obj.type === 'qcm') {
    if (!Array.isArray(obj.options) || obj.options.length < 2) throw new Error('INVALID_OPTIONS');
    obj.answer_index = parseInt(obj.answer_index ?? 0, 10);
    if (obj.answer_index < 0 || obj.answer_index >= obj.options.length) obj.answer_index = 0;
  }

  // Identifiant unique pour éviter doublons
  obj.id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  obj.fromAI = true;
  obj.hint = obj.hint || '';
  obj.explication_en = obj.explication_en || '';
  obj.source_cours = obj.source_cours || 'Généré par IA';

  return obj;
}

// ─── FALLBACKS STATIQUES ──────────────────────────────────────
function _fallbackExplanation(category, correctAnswer, reason) {
  const isOffline = reason === 'OFFLINE';
  const prefix = isOffline
    ? '📵 Mode hors ligne — explication IA indisponible.\n\n'
    : '⏱️ Explication IA indisponible — voici un rappel rapide :\n\n';

  const tips = {
    'To Be': `📖 To Be au présent : I AM · He/She/It IS · We/You/They ARE\nAu passé : I/He/She/It WAS · We/You/They WERE\nForme négative : add NOT · Forme interro : inverser sujet et verbe\n💡 Astuce : "I am Diallo" → "I was at the market yesterday"`,
    'To Have': `📖 To Have au présent : I/You/We/They HAVE · He/She/It HAS\nAu passé : tous les sujets → HAD\nDO NOT = DON'T · DOES NOT = DOESN'T · DID NOT = DIDN'T\n💡 Astuce : "Fatou HAS a headache from the Dakar heat"`,
    'WH Questions': `📖 WH Questions : What (quoi/que) · Where (où) · When (quand) · Who (qui-sujet) · Whom (qui-objet) · Whose (dont/de qui) · Which (lequel) · Why (pourquoi) · How (comment)\n💡 Astuce : "Where is the marché ?" → lieu`,
    'Beaucoup': `📖 MUCH + indénombrable (much water, much rice, much money)\nMANY + dénombrable pluriel (many students, many cars)\nA LOT OF → les deux · SEVERAL → quelques (dénombrable) · PLENTY → amplement\n💡 "Much traffic" (embouteillage Dakar) mais "many cars"`,
    'Past Simple': `📖 Passé régulier : verbe + -ED (work→worked, visit→visited)\nPassé irrégulier : forme propre (go→went, see→saw, buy→bought, eat→ate)\nNégatif : DID NOT + base verbale · Question : DID + sujet + base verbale\n💡 "Diallo WENT to Saint-Louis last weekend"`,
    'Present Perfect': `📖 Present Perfect : Subject + HAVE/HAS + Past Participle\nHave + JUST + PP = venir de faire (I have just eaten)\nHave + NEVER + PP = n'avoir jamais fait\n💡 "Emma HAS JUST arrived from Liverpool"`,
    'Idiomes': `📖 To be + adjectif d'état : hungry (faim), thirsty (soif), afraid (peur), ashamed (honte), lucky (chanceux), seasick (mal de mer), fed up with (en avoir marre de), in a rush (pressé), tired of (fatigué de)\n💡 "I'm FED UP WITH the heat wave in Dakar!"`,
    'Introduction': `📖 Se présenter : "My name is..." / "I am..." / "I go by the name of..."\nPrésenter : "Let me introduce you to..." / "Meet my friend..." / "May I present..."\nRépondre : "Nice to meet you!" / "Pleased to meet you!" / "Delighted!"\n💡 "Meet my friend Abdou — Nice to meet you!"`,
    'Likes & Preferences': `📖 I'm mad about / crazy about / keen on / very fond of / into / enjoy (+ V-ing)\nI prefer / I'd rather / I would prefer\n💡 "Diallo is mad about football — he prefers watching Champions League"`,
  };

  const tip = tips[category] || `📖 Bonne réponse attendue : "${correctAnswer}"\nRevois cette section dans ton cours CTI Dakar.`;
  return prefix + tip + `\n\n✅ Réponse correcte : "${correctAnswer}"`;
}

function _fallbackRevision(category) {
  return `📵 Mode révision — explication IA indisponible.\n\n📖 Révision : ${category}\n\nConsulte la section "${category}" dans ton cours CTI.\nDemande à ton professeur une explication en classe.\n\nContinue ! Chaque erreur est une opportunité d'apprendre. 💪`;
}

function _fallbackReport(stats) {
  const strong = (stats.categories || []).filter(c => c.score >= 75).map(c => c.name);
  const weak = (stats.categories || []).filter(c => c.score < 50).map(c => c.name);
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `📊 BILAN DE SESSION — CTI English
${date}

Score : ${stats.totalCorrect}/${stats.totalQuestions} (${stats.percentage}%)
Durée : ${stats.durationMin}min · Niveau : ${stats.levelLabel}

✅ Points forts :
${strong.length > 0 ? strong.map(s => `• ${s}`).join('\n') : '• Continue à pratiquer pour développer tes points forts !'}

⚠️ À revoir en priorité :
${weak.length > 0 ? weak.map(w => `• ${w}`).join('\n') : '• Excellent — aucun point faible détecté !'}

📅 Plan de révision suggéré :
${weak.length > 0 ? weak.slice(0, 3).map(w => `• Refaire les exercices "${w}"`).join('\n') : '• Passe au niveau supérieur !'}

(Rapport IA complet indisponible — connexion requise)`;
}

// ─── VALIDATION CLÉ API ───────────────────────────────────────
/**
 * Vérifie le format basique d'une clé Anthropic.
 * @param {string} key
 * @returns {boolean}
 */
function validateApiKey(key) {
  return typeof key === 'string' && key.startsWith('sk-ant-') && key.length > 30;
}

/**
 * Test rapide de l'API (retourne true si la clé fonctionne).
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
async function testApiKey(apiKey) {
  try {
    const text = await _callAPI({
      apiKey,
      systemPrompt: 'Reply with exactly: OK',
      userMessage: 'Reply with exactly: OK',
      maxTokens: 10,
    });
    return text.trim().includes('OK');
  } catch (_) {
    return false;
  }
}
