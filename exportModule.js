// ============================================================
// exportModule.js — CTI English PWA
// OPTION 1 : PDF via window.print() + CSS @media print
// OPTION 2 : Export JSON session (Blob + createObjectURL)
// OPTION 3 : Partage résumé texte (navigator.share / clipboard)
// ============================================================

'use strict';

// ─── OPTION 1 : RAPPORT PDF ───────────────────────────────────
/**
 * Génère le HTML du rapport et déclenche window.print().
 * Crée/remplace l'élément #print-report dans le DOM.
 *
 * @param {Object} stats      résultat de getSessionStats()
 * @param {string} aiReport   texte narratif généré par l'IA (ou fallback)
 */
function printReport(stats, aiReport = '') {
  const date = new Date(stats.startTime || Date.now()).toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const time = new Date(stats.startTime || Date.now()).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });

  // ── Tableau par catégorie
  const catRows = (stats.categories || []).map(c => {
    const pct = c.score;
    const bar = _cssBar(pct);
    const status = pct >= 75 ? '✅' : pct < 50 ? '⚠️' : '🔶';
    return `<tr>
      <td>${_esc(c.name)}</td>
      <td>${c.ok}/${c.total}</td>
      <td>${pct}%</td>
      <td>${bar}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');

  // ── Section erreurs
  const errRows = (stats.recentErrors || []).slice(0, 10).map((e, i) =>
    `<tr>
      <td>${i + 1}</td>
      <td>${_esc(e.category || '')}</td>
      <td>${_esc(e.question || '')}</td>
      <td>${_esc(e.userAnswer || '—')}</td>
      <td><strong>${_esc(e.correctAnswer || '')}</strong></td>
    </tr>`
  ).join('');

  // ── Points forts / faibles
  const strong = (stats.categories || []).filter(c => c.score >= 75).map(c => c.name);
  const weak   = (stats.categories || []).filter(c => c.score < 50).map(c => c.name);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CTI English — Rapport de Session</title>
<style>
  @media print {
    body { margin: 0; font-size: 11px; color: #000; }
    .no-print { display: none !important; }
    table { page-break-inside: avoid; }
  }
  body { font-family: 'DM Sans', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1c1a14; }
  h1 { font-size: 22px; color: #1a4a8a; margin-bottom: 4px; }
  h2 { font-size: 15px; color: #1a4a8a; border-bottom: 2px solid #1a4a8a; padding-bottom: 4px; margin-top: 20px; }
  .header-meta { color: #666; font-size: 12px; margin-bottom: 16px; }
  .score-big { font-size: 28px; font-weight: 700; color: #1a4a8a; }
  .score-pct { font-size: 18px; color: #4a8a1a; }
  .kpis { display: flex; gap: 24px; flex-wrap: wrap; margin: 12px 0 20px; }
  .kpi { text-align: center; background: #f0ede6; border-radius: 8px; padding: 10px 16px; min-width: 80px; }
  .kpi .val { font-size: 22px; font-weight: 700; color: #1a4a8a; }
  .kpi .lbl { font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { background: #1a4a8a; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e0ddd6; }
  tr:nth-child(even) td { background: #faf9f6; }
  .bar-wrap { background: #e0ddd6; border-radius: 4px; height: 10px; width: 80px; overflow: hidden; display: inline-block; vertical-align: middle; }
  .bar-fill { height: 100%; border-radius: 4px; }
  .tag-good { background: #e8f5d8; color: #2d5a0e; padding: 2px 8px; border-radius: 12px; font-size: 11px; display: inline-block; margin: 2px; }
  .tag-bad  { background: #fdeaea; color: #5a0e0e; padding: 2px 8px; border-radius: 12px; font-size: 11px; display: inline-block; margin: 2px; }
  .ai-report { background: #e0ecfa; border-left: 3px solid #1a4a8a; padding: 12px 16px; border-radius: 0 8px 8px 0; white-space: pre-wrap; font-size: 12px; line-height: 1.6; margin-top: 8px; }
  .footer { text-align: center; font-size: 10px; color: #999; margin-top: 20px; border-top: 1px solid #e0ddd6; padding-top: 8px; }
  .level-badge { display: inline-block; background: #d4a840; color: #1c1a14; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
</style>
</head>
<body>
  <h1>📘 CTI English — Rapport de Session</h1>
  <div class="header-meta">
    <span class="level-badge">${_esc(stats.levelLabel || stats.level)}</span>
    &nbsp; ${date} à ${time} &nbsp;|&nbsp; Durée : ${stats.durationMin}min${stats.durationSec ? stats.durationSec + 's' : ''}
  </div>

  <div class="kpis">
    <div class="kpi"><div class="val">${stats.totalCorrect}/${stats.totalQuestions}</div><div class="lbl">Score</div></div>
    <div class="kpi"><div class="val" style="color:${stats.percentage >= 70 ? '#4a8a1a' : '#8a1a1a'}">${stats.percentage}%</div><div class="lbl">Réussite</div></div>
    <div class="kpi"><div class="val">${stats.streak}</div><div class="lbl">Série max</div></div>
    <div class="kpi"><div class="val">${stats.avgTimeSec}s</div><div class="lbl">Temps moy.</div></div>
    <div class="kpi"><div class="val">${stats.durationMin}min</div><div class="lbl">Durée</div></div>
  </div>

  <h2>📊 Résultats par catégorie</h2>
  <table>
    <thead><tr><th>Catégorie</th><th>Score</th><th>%</th><th>Progression</th><th></th></tr></thead>
    <tbody>${catRows || '<tr><td colspan="5">Aucune catégorie enregistrée</td></tr>'}</tbody>
  </table>

  ${strong.length > 0 ? `<h2>✅ Points forts</h2><p>${strong.map(s => `<span class="tag-good">${_esc(s)}</span>`).join(' ')}</p>` : ''}
  ${weak.length > 0 ? `<h2>⚠️ À revoir en priorité</h2><p>${weak.map(w => `<span class="tag-bad">${_esc(w)}</span>`).join(' ')}</p>` : ''}

  ${errRows ? `<h2>❌ Mes erreurs (${Math.min((stats.recentErrors || []).length, 10)} dernières)</h2>
  <table>
    <thead><tr><th>#</th><th>Catégorie</th><th>Question</th><th>Ma réponse</th><th>Bonne réponse</th></tr></thead>
    <tbody>${errRows}</tbody>
  </table>` : ''}

  ${aiReport ? `<h2>🤖 Analyse IA & Plan de révision</h2><div class="ai-report">${_esc(aiReport)}</div>` : ''}

  <div class="footer">CTI English · Cours Dakar · Session ID: ${_esc(stats.sessionId || '—')} · Généré le ${date}</div>
</body>
</html>`;

  // Injecter dans un iframe caché puis imprimer
  let frame = document.getElementById('print-frame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'print-frame';
    frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(frame);
  }

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }, 300);
}

// ─── CSS BARRE DE PROGRESSION INLINE ─────────────────────────
function _cssBar(pct) {
  const color = pct >= 75 ? '#4a8a1a' : pct >= 50 ? '#d4a840' : '#8a1a1a';
  return `<div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

// ─── OPTION 2 : EXPORT JSON ───────────────────────────────────
/**
 * Télécharge un fichier JSON complet de la session.
 * Nom : session_YYYYMMDD_HHMM.json
 * @param {Object} sessionState  état complet (getState())
 */
function downloadSessionJSON(sessionState) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const filename = `session_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.json`;

  // Exclure la clé API de l'export
  const exportData = { ...sessionState, apiKey: '[REDACTED]', exportedAt: now.toISOString() };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
}

// ─── OPTION 3 : PARTAGE RÉSUMÉ TEXTE ─────────────────────────
/**
 * Partage un résumé court via navigator.share() ou copie dans le presse-papier.
 * @param {Object} stats  résultat de getSessionStats()
 * @returns {Promise<{ method: 'share'|'clipboard'|'error', message: string }>}
 */
async function shareScore(stats) {
  const date = new Date(stats.startTime || Date.now()).toLocaleDateString('fr-FR');
  const strong = (stats.categories || []).filter(c => c.score >= 75).map(c => c.name).slice(0, 3).join(', ') || '—';
  const weak   = (stats.categories || []).filter(c => c.score < 50).map(c => c.name).slice(0, 3).join(', ') || '—';

  const emoji = stats.percentage >= 85 ? '🏆' : stats.percentage >= 70 ? '🎉' : stats.percentage >= 50 ? '💪' : '📚';

  const text = `${emoji} CTI English — Session du ${date}
Score : ${stats.totalCorrect}/${stats.totalQuestions} (${stats.percentage}%)
Niveau : ${stats.levelLabel}
Durée : ${stats.durationMin} min
Points forts : ${strong}
À travailler : ${weak}
#CTIEnglish #Dakar #ApprendreLAnglais`;

  // Tenter navigator.share (mobile)
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'CTI English — Mon score',
        text,
      });
      return { method: 'share', message: 'Partagé avec succès !' };
    } catch (e) {
      if (e.name === 'AbortError') return { method: 'aborted', message: '' };
    }
  }

  // Fallback : copier dans le presse-papier
  try {
    await navigator.clipboard.writeText(text);
    return { method: 'clipboard', message: 'Score copié dans le presse-papier !' };
  } catch (_) {
    // Dernier recours : prompt
    try {
      window.prompt('Copie ce texte (Ctrl+C / Cmd+C) :', text);
      return { method: 'prompt', message: 'Sélectionne et copie le texte.' };
    } catch (_) {
      return { method: 'error', message: 'Partage non disponible sur ce navigateur.' };
    }
  }
}

// ─── HELPER ───────────────────────────────────────────────────
function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
