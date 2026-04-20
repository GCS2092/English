// verbModule.js — CTI English PWA
// Tables de conjugaison complètes : anglais (EN) + espagnol (ES)
// Regular + Irregular verbs | 3 temps par langue
'use strict';

// ── SUJETS ────────────────────────────────────────────────────
const SUBJECTS_EN = ['I', 'You', 'He / She / It', 'We', 'You (pl.)', 'They'];
const SUBJECTS_ES = ['yo', 'tú', 'él / ella', 'nosotros', 'vosotros', 'ellos / ellas'];

// ══ VERBES ANGLAIS ════════════════════════════════════════════
const VERBS_EN = [

  // ── RÉGULIERS ───────────────────────────────────────────────
  { id:'work',   verb:'work',   fr:'travailler', type:'regular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Base verbale + -s à la 3ème pers. sing.',
        forms:['work','work','works','work','work','work'] },
      past:   { label:'Past Simple',      rule_fr:'Régulier : base + -ed pour toutes les personnes.',
        forms:['worked','worked','worked','worked','worked','worked'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have / Has + participe passé.',
        forms:['have worked','have worked','has worked','have worked','have worked','have worked'] },
    },
  },
  { id:'play',   verb:'play',   fr:'jouer / travailler', type:'regular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Base + -s (he/she/it).',
        forms:['play','play','plays','play','play','play'] },
      past:   { label:'Past Simple',      rule_fr:'Régulier : + -ed.',
        forms:['played','played','played','played','played','played'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have / Has + played.',
        forms:['have played','have played','has played','have played','have played','have played'] },
    },
  },
  { id:'study',  verb:'study',  fr:'étudier', type:'regular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Consonne + y → -y → -ies à la 3ème pers.',
        forms:['study','study','studies','study','study','study'] },
      past:   { label:'Past Simple',      rule_fr:'Consonne + y → -ied.',
        forms:['studied','studied','studied','studied','studied','studied'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have / Has + studied.',
        forms:['have studied','have studied','has studied','have studied','have studied','have studied'] },
    },
  },
  { id:'live',   verb:'live',   fr:'habiter / vivre', type:'regular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Terminaison en -e : + -s à la 3ème pers.',
        forms:['live','live','lives','live','live','live'] },
      past:   { label:'Past Simple',      rule_fr:'Terminaison en -e : + -d seulement.',
        forms:['lived','lived','lived','lived','lived','lived'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have / Has + lived.',
        forms:['have lived','have lived','has lived','have lived','have lived','have lived'] },
    },
  },
  { id:'watch',  verb:'watch',  fr:'regarder / observer', type:'regular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'-ch → -ches à la 3ème pers.',
        forms:['watch','watch','watches','watch','watch','watch'] },
      past:   { label:'Past Simple',      rule_fr:'Régulier : + -ed.',
        forms:['watched','watched','watched','watched','watched','watched'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have / Has + watched.',
        forms:['have watched','have watched','has watched','have watched','have watched','have watched'] },
    },
  },
  { id:'travel', verb:'travel', fr:'voyager', type:'regular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Base + -s à la 3ème pers.',
        forms:['travel','travel','travels','travel','travel','travel'] },
      past:   { label:'Past Simple',      rule_fr:'EN GB : travelled. EN US : traveled.',
        forms:['travelled','travelled','travelled','travelled','travelled','travelled'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have / Has + travelled.',
        forms:['have travelled','have travelled','has travelled','have travelled','have travelled','have travelled'] },
    },
  },
  { id:'finish', verb:'finish', fr:'terminer / finir', type:'regular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'-sh → -shes à la 3ème pers.',
        forms:['finish','finish','finishes','finish','finish','finish'] },
      past:   { label:'Past Simple',      rule_fr:'Régulier : + -ed.',
        forms:['finished','finished','finished','finished','finished','finished'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have / Has + finished.',
        forms:['have finished','have finished','has finished','have finished','have finished','have finished'] },
    },
  },
  { id:'stop',   verb:'stop',   fr:'arrêter / s\'arrêter', type:'regular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Consonne finale doublée uniquement au passé.',
        forms:['stop','stop','stops','stop','stop','stop'] },
      past:   { label:'Past Simple',      rule_fr:'Consonne finale doublée : stop → stopped.',
        forms:['stopped','stopped','stopped','stopped','stopped','stopped'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have / Has + stopped.',
        forms:['have stopped','have stopped','has stopped','have stopped','have stopped','have stopped'] },
    },
  },

  // ── IRRÉGULIERS ─────────────────────────────────────────────
  { id:'be',    verb:'be',    fr:'être', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'To Be est entièrement irrégulier au présent.',
        forms:['am','are','is','are','are','are'] },
      past:   { label:'Past Simple',      rule_fr:'Was (sing.) / Were (plur.).',
        forms:['was','were','was','were','were','were'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have been / Has been.',
        forms:['have been','have been','has been','have been','have been','have been'] },
    },
  },
  { id:'have',  verb:'have',  fr:'avoir', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Have → Has à la 3ème pers. sing.',
        forms:['have','have','has','have','have','have'] },
      past:   { label:'Past Simple',      rule_fr:'Had pour toutes les personnes.',
        forms:['had','had','had','had','had','had'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have had / Has had.',
        forms:['have had','have had','has had','have had','have had','have had'] },
    },
  },
  { id:'go',    verb:'go',    fr:'aller', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Go → Goes à la 3ème pers. (-o → -oes).',
        forms:['go','go','goes','go','go','go'] },
      past:   { label:'Past Simple',      rule_fr:'Went — entièrement irrégulier.',
        forms:['went','went','went','went','went','went'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have gone / Has gone.',
        forms:['have gone','have gone','has gone','have gone','have gone','have gone'] },
    },
  },
  { id:'do',    verb:'do',    fr:'faire', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Do → Does à la 3ème pers.',
        forms:['do','do','does','do','do','do'] },
      past:   { label:'Past Simple',      rule_fr:'Did pour toutes les personnes.',
        forms:['did','did','did','did','did','did'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have done / Has done.',
        forms:['have done','have done','has done','have done','have done','have done'] },
    },
  },
  { id:'make',  verb:'make',  fr:'faire / fabriquer', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Make → Makes à la 3ème pers.',
        forms:['make','make','makes','make','make','make'] },
      past:   { label:'Past Simple',      rule_fr:'Made pour toutes les personnes.',
        forms:['made','made','made','made','made','made'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have made / Has made.',
        forms:['have made','have made','has made','have made','have made','have made'] },
    },
  },
  { id:'take',  verb:'take',  fr:'prendre', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Take → Takes à la 3ème pers.',
        forms:['take','take','takes','take','take','take'] },
      past:   { label:'Past Simple',      rule_fr:'Took — irrégulier.',
        forms:['took','took','took','took','took','took'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have taken / Has taken.',
        forms:['have taken','have taken','has taken','have taken','have taken','have taken'] },
    },
  },
  { id:'come',  verb:'come',  fr:'venir', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Come → Comes à la 3ème pers.',
        forms:['come','come','comes','come','come','come'] },
      past:   { label:'Past Simple',      rule_fr:'Came — irrégulier.',
        forms:['came','came','came','came','came','came'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have come / Has come.',
        forms:['have come','have come','has come','have come','have come','have come'] },
    },
  },
  { id:'see',   verb:'see',   fr:'voir', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'See → Sees à la 3ème pers.',
        forms:['see','see','sees','see','see','see'] },
      past:   { label:'Past Simple',      rule_fr:'Saw — irrégulier.',
        forms:['saw','saw','saw','saw','saw','saw'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have seen / Has seen.',
        forms:['have seen','have seen','has seen','have seen','have seen','have seen'] },
    },
  },
  { id:'give',  verb:'give',  fr:'donner', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Give → Gives à la 3ème pers.',
        forms:['give','give','gives','give','give','give'] },
      past:   { label:'Past Simple',      rule_fr:'Gave — irrégulier.',
        forms:['gave','gave','gave','gave','gave','gave'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have given / Has given.',
        forms:['have given','have given','has given','have given','have given','have given'] },
    },
  },
  { id:'write', verb:'write', fr:'écrire', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Write → Writes à la 3ème pers.',
        forms:['write','write','writes','write','write','write'] },
      past:   { label:'Past Simple',      rule_fr:'Wrote — irrégulier.',
        forms:['wrote','wrote','wrote','wrote','wrote','wrote'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have written / Has written.',
        forms:['have written','have written','has written','have written','have written','have written'] },
    },
  },
  { id:'buy',   verb:'buy',   fr:'acheter', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Buy → Buys à la 3ème pers.',
        forms:['buy','buy','buys','buy','buy','buy'] },
      past:   { label:'Past Simple',      rule_fr:'Bought — irrégulier.',
        forms:['bought','bought','bought','bought','bought','bought'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have bought / Has bought.',
        forms:['have bought','have bought','has bought','have bought','have bought','have bought'] },
    },
  },
  { id:'speak', verb:'speak', fr:'parler', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Speak → Speaks à la 3ème pers.',
        forms:['speak','speak','speaks','speak','speak','speak'] },
      past:   { label:'Past Simple',      rule_fr:'Spoke — irrégulier.',
        forms:['spoke','spoke','spoke','spoke','spoke','spoke'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have spoken / Has spoken.',
        forms:['have spoken','have spoken','has spoken','have spoken','have spoken','have spoken'] },
    },
  },
  { id:'know',  verb:'know',  fr:'savoir / connaître', type:'irregular',
    tenses:{
      present:{ label:'Present Simple',   rule_fr:'Know → Knows à la 3ème pers.',
        forms:['know','know','knows','know','know','know'] },
      past:   { label:'Past Simple',      rule_fr:'Knew — irrégulier.',
        forms:['knew','knew','knew','knew','knew','knew'] },
      perfect:{ label:'Present Perfect',  rule_fr:'Have known / Has known.',
        forms:['have known','have known','has known','have known','have known','have known'] },
    },
  },
];

// ══ VERBES ESPAGNOLS ══════════════════════════════════════════
const VERBS_ES = [

  // ── RÉGULIERS -AR ────────────────────────────────────────────
  { id:'hablar',    verb:'hablar',    fr:'parler',          type:'regular', ending:'-ar',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'Terminaisons -AR : -o, -as, -a, -amos, -áis, -an.',
        forms:['hablo','hablas','habla','hablamos','habláis','hablan'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Terminaisons -AR passé : -é, -aste, -ó, -amos, -asteis, -aron.',
        forms:['hablé','hablaste','habló','hablamos','hablasteis','hablaron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Infinitif + -é, -ás, -á, -emos, -éis, -án.',
        forms:['hablaré','hablarás','hablará','hablaremos','hablaréis','hablarán'] },
    },
  },
  { id:'trabajar',  verb:'trabajar',  fr:'travailler',      type:'regular', ending:'-ar',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'Terminaisons -AR régulier.',
        forms:['trabajo','trabajas','trabaja','trabajamos','trabajáis','trabajan'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Passé simple -AR régulier.',
        forms:['trabajé','trabajaste','trabajó','trabajamos','trabajasteis','trabajaron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Infinitif + terminaisons futur.',
        forms:['trabajaré','trabajarás','trabajará','trabajaremos','trabajaréis','trabajarán'] },
    },
  },
  { id:'llamar',    verb:'llamar',    fr:'appeler',          type:'regular', ending:'-ar',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'Terminaisons -AR régulier.',
        forms:['llamo','llamas','llama','llamamos','llamáis','llaman'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Passé simple -AR régulier.',
        forms:['llamé','llamaste','llamó','llamamos','llamasteis','llamaron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Infinitif + terminaisons futur.',
        forms:['llamaré','llamarás','llamará','llamaremos','llamaréis','llamarán'] },
    },
  },
  { id:'escuchar',  verb:'escuchar',  fr:'écouter',          type:'regular', ending:'-ar',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'Terminaisons -AR régulier.',
        forms:['escucho','escuchas','escucha','escuchamos','escucháis','escuchan'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Passé simple -AR régulier.',
        forms:['escuché','escuchaste','escuchó','escuchamos','escuchasteis','escucharon'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Infinitif + terminaisons futur.',
        forms:['escucharé','escucharás','escuchará','escucharemos','escucharéis','escucharán'] },
    },
  },

  // ── RÉGULIERS -ER ────────────────────────────────────────────
  { id:'comer',     verb:'comer',     fr:'manger',           type:'regular', ending:'-er',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'Terminaisons -ER : -o, -es, -e, -emos, -éis, -en.',
        forms:['como','comes','come','comemos','coméis','comen'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Passé -ER : -í, -iste, -ió, -imos, -isteis, -ieron.',
        forms:['comí','comiste','comió','comimos','comisteis','comieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Infinitif + terminaisons futur.',
        forms:['comeré','comerás','comerá','comeremos','comeréis','comerán'] },
    },
  },
  { id:'beber',     verb:'beber',     fr:'boire',             type:'regular', ending:'-er',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'Terminaisons -ER régulier.',
        forms:['bebo','bebes','bebe','bebemos','bebéis','beben'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Passé simple -ER régulier.',
        forms:['bebí','bebiste','bebió','bebimos','bebisteis','bebieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Infinitif + terminaisons futur.',
        forms:['beberé','beberás','beberá','beberemos','beberéis','beberán'] },
    },
  },

  // ── RÉGULIERS -IR ────────────────────────────────────────────
  { id:'vivir',     verb:'vivir',     fr:'vivre / habiter',  type:'regular', ending:'-ir',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'Terminaisons -IR : -o, -es, -e, -imos, -ís, -en.',
        forms:['vivo','vives','vive','vivimos','vivís','viven'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Passé -IR : -í, -iste, -ió, -imos, -isteis, -ieron.',
        forms:['viví','viviste','vivió','vivimos','vivisteis','vivieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Infinitif + terminaisons futur.',
        forms:['viviré','vivirás','vivirá','viviremos','viviréis','vivirán'] },
    },
  },
  { id:'escribir',  verb:'escribir',  fr:'écrire',           type:'regular', ending:'-ir',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'Terminaisons -IR régulier.',
        forms:['escribo','escribes','escribe','escribimos','escribís','escriben'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Passé simple -IR régulier.',
        forms:['escribí','escribiste','escribió','escribimos','escribisteis','escribieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Infinitif + terminaisons futur.',
        forms:['escribiré','escribirás','escribirá','escribiremos','escribiréis','escribirán'] },
    },
  },

  // ── IRRÉGULIERS ─────────────────────────────────────────────
  { id:'ser',       verb:'ser',       fr:'être (permanent)', type:'irregular', ending:'irreg',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'SER est entièrement irrégulier au présent.',
        forms:['soy','eres','es','somos','sois','son'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'SER et IR ont le même passé ! fui/fuiste/fue…',
        forms:['fui','fuiste','fue','fuimos','fuisteis','fueron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Futur régulier : infinitif + terminaisons.',
        forms:['seré','serás','será','seremos','seréis','serán'] },
    },
  },
  { id:'estar',     verb:'estar',     fr:'être (temporaire)', type:'irregular', ending:'irreg',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'ESTAR : estoy, estás, está, estamos, estáis, están.',
        forms:['estoy','estás','está','estamos','estáis','están'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Estuv- : estuve, estuviste, estuvo…',
        forms:['estuve','estuviste','estuvo','estuvimos','estuvisteis','estuvieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Futur régulier.',
        forms:['estaré','estarás','estará','estaremos','estaréis','estarán'] },
    },
  },
  { id:'tener',     verb:'tener',     fr:'avoir',            type:'irregular', ending:'irreg',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'TENER : tengo (1ère pers.), puis e→ie.',
        forms:['tengo','tienes','tiene','tenemos','tenéis','tienen'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Tuv- : tuve, tuviste, tuvo…',
        forms:['tuve','tuviste','tuvo','tuvimos','tuvisteis','tuvieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Futur irrégulier : tendr-.',
        forms:['tendré','tendrás','tendrá','tendremos','tendréis','tendrán'] },
    },
  },
  { id:'ir',        verb:'ir',        fr:'aller',            type:'irregular', ending:'irreg',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'IR : voy, vas, va, vamos, vais, van.',
        forms:['voy','vas','va','vamos','vais','van'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'IR = SER au passé : fui/fuiste/fue…',
        forms:['fui','fuiste','fue','fuimos','fuisteis','fueron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Futur régulier d\'IR.',
        forms:['iré','irás','irá','iremos','iréis','irán'] },
    },
  },
  { id:'hacer',     verb:'hacer',     fr:'faire',            type:'irregular', ending:'irreg',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'HACER : hago (1ère pers.), puis régulier.',
        forms:['hago','haces','hace','hacemos','hacéis','hacen'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Hic- : hice, hiciste, hizo…',
        forms:['hice','hiciste','hizo','hicimos','hicisteis','hicieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Futur irrégulier : har-.',
        forms:['haré','harás','hará','haremos','haréis','harán'] },
    },
  },
  { id:'poder',     verb:'poder',     fr:'pouvoir',          type:'irregular', ending:'irreg',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'PODER : o→ue (sauf nosotros/vosotros).',
        forms:['puedo','puedes','puede','podemos','podéis','pueden'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Pud- : pude, pudiste, pudo…',
        forms:['pude','pudiste','pudo','pudimos','pudisteis','pudieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Futur irrégulier : podr-.',
        forms:['podré','podrás','podrá','podremos','podréis','podrán'] },
    },
  },
  { id:'querer',    verb:'querer',    fr:'vouloir / aimer', type:'irregular', ending:'irreg',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'QUERER : e→ie (sauf nosotros/vosotros).',
        forms:['quiero','quieres','quiere','queremos','queréis','quieren'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Quis- : quise, quisiste, quiso…',
        forms:['quise','quisiste','quiso','quisimos','quisisteis','quisieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Futur irrégulier : querr-.',
        forms:['querré','querrás','querrá','querremos','querréis','querrán'] },
    },
  },
  { id:'venir',     verb:'venir',     fr:'venir',            type:'irregular', ending:'irreg',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'VENIR : vengo (1ère pers.), e→ie.',
        forms:['vengo','vienes','viene','venimos','venís','vienen'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Vin- : vine, viniste, vino…',
        forms:['vine','viniste','vino','vinimos','vinisteis','vinieron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Futur irrégulier : vendr-.',
        forms:['vendré','vendrás','vendrá','vendremos','vendréis','vendrán'] },
    },
  },
  { id:'decir',     verb:'decir',     fr:'dire',             type:'irregular', ending:'irreg',
    tenses:{
      present:{ label:'Présent (Presente)',    rule_fr:'DECIR : digo (1ère pers.), e→i.',
        forms:['digo','dices','dice','decimos','decís','dicen'] },
      past:   { label:'Passé (Pretérito)',     rule_fr:'Dij- : dije, dijiste, dijo…',
        forms:['dije','dijiste','dijo','dijimos','dijisteis','dijeron'] },
      future: { label:'Futur (Futuro)',        rule_fr:'Futur irrégulier : dir-.',
        forms:['diré','dirás','dirá','diremos','diréis','dirán'] },
    },
  },
];

// ── FONCTIONS D'ACCÈS ─────────────────────────────────────────

/** Retourne la liste des verbes (résumé) pour une langue. */
function getVerbList(lang = 'en') {
  const pool = lang === 'es' ? VERBS_ES : VERBS_EN;
  return pool.map(v => ({
    id: v.id, verb: v.verb, fr: v.fr, type: v.type,
    ending: v.ending || null,
  }));
}

/** Retourne un verbe complet par ID et langue. */
function getVerb(id, lang = 'en') {
  const pool = lang === 'es' ? VERBS_ES : VERBS_EN;
  return pool.find(v => v.id === id) || null;
}

/** Retourne les sujets pour une langue. */
function getSubjects(lang = 'en') {
  return lang === 'es' ? SUBJECTS_ES : SUBJECTS_EN;
}

/**
 * Vérifie les réponses d'un tableau de conjugaison.
 * Comparaison tolérante (lowercase, espaces).
 * @param {string[]} userForms   6 réponses utilisateur
 * @param {string[]} correctForms 6 formes correctes
 * @returns {{ results: boolean[], score: number, total: number }}
 */
function checkConjugation(userForms, correctForms) {
  const norm = s => (s || '').toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'");
  const results = correctForms.map((f, i) => norm(userForms[i] || '') === norm(f));
  const score   = results.filter(Boolean).length;
  return { results, score, total: correctForms.length };
}
