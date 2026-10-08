/**
 * ReadPulse - Pure Frontend Readability Engine
 * Computes:
 *  - Flesch Reading Ease
 *  - Flesch-Kincaid Grade Level
 *  - Gunning Fog Index
 *  - Coleman-Liau Index
 *  - Syllable counts & polysyllabic word detection
 *  - Sentence extraction & difficulty scoring
 *  - Ranks and highlights top 5 hardest sentences
 */

// --- Sample text for instant demonstration ---
const SAMPLE_PROSE = `The epistemological ramifications of post-structuralist hermeneutics necessitate a comprehensive re-evaluation of established ontological paradigms within contemporary phenomenological inquiries. In other words, our understanding of how truth is formed changes when we analyze the subtle nuances of human language. However, the overarching interconnectedness of multifaceted socio-economic systems often engenders systemic vulnerabilities that defy simplistic remediation strategies when deployed without empirical rigor. 

Clear writing communicates ideas with precision and brevity. Good writers strive to replace cumbersome circumlocutions with direct, energetic verbs and crisp nouns. Notwithstanding the aforementioned pedagogical virtues of straightforward syntactical arrangements, specialized academic discourse persistently manifests an inclination toward obfuscatory sesquipedalian nomenclature. 

When you simplify your phrasing, readers absorb your points faster and recall them more easily. Still, navigating the delicate balance between technical nuance and colloquial accessibility remains an enduring challenge for researchers and technical practitioners alike.`;

// DOM Elements
const textInput = document.getElementById('textInput');
const highlightViewer = document.getElementById('highlightViewer');
const tabInput = document.getElementById('tabInput');
const tabHighlight = document.getElementById('tabHighlight');
const sampleBtn = document.getElementById('sampleBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeLabel = document.getElementById('themeLabel');
const themeIcon = document.getElementById('themeIcon');

// Banner & Gauge
const gaugeBar = document.getElementById('gaugeBar');
const readingEaseVal = document.getElementById('readingEaseVal');
const gradePill = document.getElementById('gradePill');
const scoreVerdict = document.getElementById('scoreVerdict');
const scoreAdvice = document.getElementById('scoreAdvice');

// Metrics Cards
const gradeLevelVal = document.getElementById('gradeLevelVal');
const gradeLevelDesc = document.getElementById('gradeLevelDesc');
const targetAudienceVal = document.getElementById('targetAudienceVal');
const targetLevelSub = document.getElementById('targetLevelSub');
const readingTimeVal = document.getElementById('readingTimeVal');
const hardSentencesCount = document.getElementById('hardSentencesCount');
const hardSentencesPercent = document.getElementById('hardSentencesPercent');

// Panel elements
const wordCountEl = document.getElementById('wordCount');
const sentenceCountEl = document.getElementById('sentenceCount');
const charCountEl = document.getElementById('charCount');
const hardSentencesList = document.getElementById('hardSentencesList');
const heatmapBadge = document.getElementById('heatmapBadge');
const scrollToTopHardBtn = document.getElementById('scrollToTopHardBtn');

// Diagnostics
const diagAvgWords = document.getElementById('diagAvgWords');
const diagAvgSyllables = document.getElementById('diagAvgSyllables');
const diagComplexWords = document.getElementById('diagComplexWords');
const diagLongWords = document.getElementById('diagLongWords');
const diagGunningFog = document.getElementById('diagGunningFog');
const diagColeman = document.getElementById('diagColeman');

let currentView = 'edit'; // 'edit' or 'highlight'
let hardestSentenceElements = [];

// ==========================================
// Readability & Text Analysis Engine
// ==========================================

/**
 * Counts syllables in an English word with heuristic rules.
 */
function countSyllables(rawWord) {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;

  // Syllable reduction exceptions
  let clean = word
    .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
    .replace(/^y/, '');

  const matches = clean.match(/[aeiouy]{1,2}/g);
  let count = matches ? matches.length : 1;

  // Special cases adjustment
  if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word[word.length - 3])) {
    count++;
  }
  if (word.endsWith('sm')) {
    count++;
  }
  return Math.max(1, count);
}

/**
 * Splits text into sentences while preserving trailing punctuations and positions.
 */
function extractSentences(text) {
  if (!text || !text.trim()) return [];

  // Match sentences ending in ., !, ?, or ellipses
  const regex = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      matches.push({
        rawText: raw,
        trimmedText: trimmed,
        startIndex: match.index,
        endIndex: match.index + raw.length
      });
    }
  }

  return matches;
}

/**
 * Tokenizes text into words.
 */
function extractWords(text) {
  if (!text) return [];
  const words = text.match(/[A-Za-z0-9'’-]+/g);
  return words ? words.map(w => w.replace(/^['’]+|['’]+$/g, '')).filter(w => w.length > 0) : [];
}

/**
 * Compute difficulty score for an individual sentence.
 * Heavily factors in word count, syllable count, and presence of complex polysyllabic words.
 */
function scoreSentenceDifficulty(sentenceObj) {
  const words = extractWords(sentenceObj.trimmedText);
  const wordCount = words.length;
  if (wordCount === 0) return { ...sentenceObj, score: 0, wordCount: 0, syllables: 0, complexWords: 0 };

  let totalSyllables = 0;
  let complexWords = 0; // > 2 syllables

  words.forEach(w => {
    const syl = countSyllables(w);
    totalSyllables += syl;
    if (syl >= 3) complexWords++;
  });

  const avgSyllables = totalSyllables / wordCount;
  // Formula: Word count penalty + Syllable density weight + Polysyllabic ratio weight
  // Sentences > 20 words or dense with 3+ syllable words rise quickly to top
  const score = (wordCount * 1.2) + (avgSyllables * 14) + (complexWords * 3.5);

  return {
    ...sentenceObj,
    score: Math.round(score * 10) / 10,
    wordCount,
    totalSyllables,
    complexWords,
    avgSyllables: avgSyllables.toFixed(2)
  };
}

/**
 * Full Text Analysis
 */
function analyzeProse(text) {
  const cleanText = text.trim();
  if (!cleanText) {
    return null;
  }

  const rawSentences = extractSentences(cleanText);
  const totalSentences = rawSentences.length || 1;
  const words = extractWords(cleanText);
  const totalWords = words.length || 1;
  const totalChars = cleanText.replace(/\s+/g, '').length;

  let totalSyllables = 0;
  let complexWordsCount = 0;
  let longWordsCount = 0;

  words.forEach(w => {
    const s = countSyllables(w);
    totalSyllables += s;
    if (s >= 3) complexWordsCount++;
    if (w.length > 6) longWordsCount++;
  });

  // Calculate readability formulas:
  // 1. Flesch Reading Ease: 206.835 - 1.015 * (words/sentence) - 84.6 * (syllables/words)
  const wordsPerSentence = totalWords / totalSentences;
  const syllablesPerWord = totalSyllables / totalWords;
  let fleschReadingEase = 206.835 - (1.015 * wordsPerSentence) - (84.6 * syllablesPerWord);
  fleschReadingEase = Math.max(0, Math.min(100, Math.round(fleschReadingEase)));

  // 2. Flesch-Kincaid Grade Level: 0.39 * (words/sentence) + 11.8 * (syllables/words) - 15.59
  let gradeLevel = (0.39 * wordsPerSentence) + (11.8 * syllablesPerWord) - 15.59;
  gradeLevel = Math.max(1, Math.round(gradeLevel * 10) / 10);

  // 3. Gunning Fog Index: 0.4 * [ (words / sentences) + 100 * (complex words / words) ]
  const gunningFog = 0.4 * (wordsPerSentence + (100 * (complexWordsCount / totalWords)));

  // 4. Coleman-Liau: 0.0588 * L - 0.296 * S - 15.8 (L = chars per 100 words, S = sentences per 100 words)
  const L = (totalChars / totalWords) * 100;
  const S = (totalSentences / totalWords) * 100;
  const colemanLiau = (0.0588 * L) - (0.296 * S) - 15.8;

  // Reading time (~225 wpm)
  const totalReadingSeconds = Math.round((totalWords / 225) * 60);
  const readingMin = Math.floor(totalReadingSeconds / 60);
  const readingSec = totalReadingSeconds % 60;

  // Grade sentences & find top 5 hardest
  const scoredSentences = rawSentences.map(s => scoreSentenceDifficulty(s));
  // Filter only meaningful sentences (at least 3 words)
  const candidateSentences = scoredSentences.filter(s => s.wordCount >= 3);
  
  // Sort descending by difficulty score
  candidateSentences.sort((a, b) => b.score - a.score);
  const top5Hardest = candidateSentences.slice(0, 5);

  return {
    rawText: cleanText,
    totalWords,
    totalSentences,
    totalChars,
    wordsPerSentence: wordsPerSentence.toFixed(1),
    syllablesPerWord: syllablesPerWord.toFixed(2),
    complexWordsCount,
    longWordsCount,
    fleschReadingEase,
    gradeLevel,
    gunningFog: Math.max(1, gunningFog).toFixed(1),
    colemanLiau: Math.max(1, colemanLiau).toFixed(1),
    readingTime: `${readingMin}m ${readingSec}s`,
    allScoredSentences: scoredSentences,
    top5Hardest
  };
}

// ==========================================
// UI Updates & Interactions
// ==========================================

function updateUI() {
  const text = textInput.value;
  const stats = analyzeProse(text);

  if (!stats) {
    resetToEmptyState();
    return;
  }

  // Quick stats
  wordCountEl.textContent = `${stats.totalWords.toLocaleString()} words`;
  sentenceCountEl.textContent = `${stats.totalSentences.toLocaleString()} sentences`;
  charCountEl.textContent = `${stats.totalChars.toLocaleString()} characters`;

  // Reading Ease Gauge
  readingEaseVal.textContent = stats.fleschReadingEase;
  const circumference = 314.159; // 2 * PI * 50
  const offset = circumference - (stats.fleschReadingEase / 100) * circumference;
  gaugeBar.style.strokeDashoffset = offset;

  // Dynamic color coding based on reading ease
  let gaugeColor = 'var(--color-easy)';
  let verdictTitle = '';
  let adviceText = '';
  let gradePillText = '';
  let targetAudience = '';

  if (stats.fleschReadingEase >= 80) {
    gaugeColor = '#10b981';
    gradePillText = 'Very Easy / Fluent';
    verdictTitle = 'Effortless to Read';
    adviceText = 'Clear, crisp, and accessible to virtually anyone. Great for consumer copy, newsletters, and fast reading.';
  } else if (stats.fleschReadingEase >= 60) {
    gaugeColor = '#3b82f6';
    gradePillText = 'Standard & Clear';
    verdictTitle = 'Engaging & Balanced Prose';
    adviceText = 'Optimal readability for web content, blog posts, and general business correspondence (8th–9th grade).';
  } else if (stats.fleschReadingEase >= 40) {
    gaugeColor = '#f59e0b';
    gradePillText = 'Fairly Complex';
    verdictTitle = 'Requires Concentrated Attention';
    adviceText = 'Targeted towards high school or undergraduate readers. Consider splitting the highlighted sentences below.';
  } else {
    gaugeColor = '#ef4444';
    gaugeBar.style.filter = 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))';
    gradePillText = 'Very Difficult';
    verdictTitle = 'Dense Academic / Legal Prose';
    adviceText = 'Your text contains convoluted phrasing and high syllable density. Simplifying the hardest sentences will dramatically increase clarity.';
  }

  gaugeBar.style.stroke = gaugeColor;
  gradePill.textContent = gradePillText;
  scoreVerdict.textContent = verdictTitle;
  scoreAdvice.textContent = adviceText;

  // Grade Level & Metrics
  gradeLevelVal.textContent = `Gr. ${stats.gradeLevel}`;
  gradeLevelDesc.textContent = stats.gradeLevel <= 6 ? 'Elementary level' : stats.gradeLevel <= 10 ? 'High school level' : stats.gradeLevel <= 14 ? 'College level' : 'Graduate level';

  if (stats.gradeLevel <= 6) {
    targetAudience = 'Mass Public (5th Gr)';
  } else if (stats.gradeLevel <= 9) {
    targetAudience = 'General Web (7–9th Gr)';
  } else if (stats.gradeLevel <= 12) {
    targetAudience = 'Educated Adults';
  } else {
    targetAudience = 'Academic / Specialists';
  }
  targetAudienceVal.textContent = targetAudience;
  targetLevelSub.textContent = `Grade equivalent: ${stats.gradeLevel}`;

  readingTimeVal.textContent = stats.readingTime;

  const hardCount = stats.top5Hardest.length;
  hardSentencesCount.textContent = hardCount;
  heatmapBadge.textContent = hardCount;
  const pct = Math.round((hardCount / stats.totalSentences) * 100);
  hardSentencesPercent.textContent = `${pct}% of total sentences`;

  // Diagnostics
  diagAvgWords.textContent = `${stats.wordsPerSentence} words`;
  diagAvgSyllables.textContent = `${stats.syllablesPerWord} syl/w`;
  diagComplexWords.textContent = `${stats.complexWordsCount} (${Math.round((stats.complexWordsCount/stats.totalWords)*100)}%)`;
  diagLongWords.textContent = `${stats.longWordsCount} (${Math.round((stats.longWordsCount/stats.totalWords)*100)}%)`;
  diagGunningFog.textContent = stats.gunningFog;
  diagColeman.textContent = stats.colemanLiau;

  // Render Right Column: Top 5 Hardest Sentences List
  renderHardSentencesList(stats.top5Hardest);

  // Render Highlight View
  renderHighlightViewer(stats);
}

function resetToEmptyState() {
  readingEaseVal.textContent = '--';
  gaugeBar.style.strokeDashoffset = 314.159;
  gradePill.textContent = 'Waiting for input';
  scoreVerdict.textContent = 'Paste your prose to calculate readability';
  scoreAdvice.textContent = 'We calculate Flesch-Kincaid Grade Level, Dale-Chall complexity, and pinpoint your 5 most convoluted sentences instantly.';
  
  gradeLevelVal.textContent = '--';
  gradeLevelDesc.textContent = 'Flesch-Kincaid';
  targetAudienceVal.textContent = '--';
  targetLevelSub.textContent = 'Standard: 7th–9th grade';
  readingTimeVal.textContent = '0m 0s';
  hardSentencesCount.textContent = '0';
  hardSentencesPercent.textContent = '0% of total';
  heatmapBadge.textContent = '0';

  wordCountEl.textContent = '0 words';
  sentenceCountEl.textContent = '0 sentences';
  charCountEl.textContent = '0 characters';

  diagAvgWords.textContent = '--';
  diagAvgSyllables.textContent = '--';
  diagComplexWords.textContent = '--';
  diagLongWords.textContent = '--';
  diagGunningFog.textContent = '--';
  diagColeman.textContent = '--';

  hardSentencesList.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      </div>
      <h4>No text entered yet</h4>
      <p>Paste or type your content to discover the five most complex sentences that are weighing down your readability score.</p>
    </div>
  `;
  highlightViewer.innerHTML = '';
}

/**
 * Render the Top 5 Hardest Sentences list in the right panel
 */
function renderHardSentencesList(top5) {
  if (top5.length === 0) {
    hardSentencesList.innerHTML = `
      <div class="empty-state">
        <h4>No complex sentences found!</h4>
        <p>Your copy is exceptionally short or clean.</p>
      </div>
    `;
    return;
  }

  let html = '';
  top5.forEach((item, index) => {
    const rank = index + 1;
    html += `
      <div class="hard-card" data-rank="${rank}" id="hardCard-${rank}">
        <div class="hard-card-top">
          <span class="rank-badge rank-badge-${rank}">#${rank} Hardest Sentence</span>
          <span class="hard-card-score">Score: ${item.score}</span>
        </div>
        <p class="hard-card-text">“${escapeHtml(item.trimmedText)}”</p>
        <div class="hard-card-metrics">
          <span class="metric-tag"><strong>${item.wordCount}</strong> words</span>
          <span>•</span>
          <span class="metric-tag"><strong>${item.complexWords}</strong> complex words</span>
          <span>•</span>
          <span class="metric-tag"><strong>${item.avgSyllables}</strong> syl/word</span>
        </div>
        <button class="btn-rewrite-tip" onclick="focusSentenceInViewer(${rank})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Locate in Heatmap
        </button>
      </div>
    `;
  });

  hardSentencesList.innerHTML = html;

  // Add click listener to cards
  document.querySelectorAll('.hard-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const rank = parseInt(card.getAttribute('data-rank'), 10);
      focusSentenceInViewer(rank);
    });
  });
}

/**
 * Render the full text with top 5 sentences highlighted in varying intensities
 */
function renderHighlightViewer(stats) {
  const originalText = textInput.value;
  const top5 = stats.top5Hardest;

  // Build a map of trimmed sentence -> rank (1 to 5)
  const rankMap = new Map();
  top5.forEach((item, idx) => {
    rankMap.set(item.trimmedText, idx + 1);
  });

  // Rebuild the text with span wrappers
  let resultHtml = '';
  const sentences = stats.allScoredSentences;

  let lastIndex = 0;
  sentences.forEach((s) => {
    // text preceding this sentence (e.g. paragraph breaks, spaces)
    if (s.startIndex > lastIndex) {
      resultHtml += escapeHtml(originalText.substring(lastIndex, s.startIndex));
    }

    const rank = rankMap.get(s.trimmedText);
    if (rank) {
      resultHtml += `<span class="hl-sentence hl-rank-${rank}" data-rank="${rank}" id="hl-sentence-${rank}" title="Rank #${rank} hardest sentence (${s.wordCount} words, ${s.complexWords} complex words)">${escapeHtml(s.rawText)}</span>`;
    } else {
      resultHtml += escapeHtml(s.rawText);
    }

    lastIndex = s.endIndex;
  });

  // Any leftover trailing characters
  if (lastIndex < originalText.length) {
    resultHtml += escapeHtml(originalText.substring(lastIndex));
  }

  highlightViewer.innerHTML = resultHtml;

  // Attach hover/click events to spans
  document.querySelectorAll('.hl-sentence').forEach(span => {
    span.addEventListener('click', () => {
      const rank = span.getAttribute('data-rank');
      highlightMatchingCard(rank);
    });
  });
}

/**
 * Highlight and jump to sentence in Heatmap viewer
 */
window.focusSentenceInViewer = function(rank) {
  // Switch to heatmap view if currently in edit
  setView('highlight');

  // Remove existing active states
  document.querySelectorAll('.hl-sentence').forEach(el => el.classList.remove('hl-active'));
  document.querySelectorAll('.hard-card').forEach(el => el.classList.remove('active-card'));

  const targetSpan = document.getElementById(`hl-sentence-${rank}`);
  const targetCard = document.getElementById(`hardCard-${rank}`);

  if (targetSpan) {
    targetSpan.classList.add('hl-active');
    targetSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (targetCard) {
    targetCard.classList.add('active-card');
  }
};

function highlightMatchingCard(rank) {
  document.querySelectorAll('.hard-card').forEach(el => el.classList.remove('active-card'));
  const targetCard = document.getElementById(`hardCard-${rank}`);
  if (targetCard) {
    targetCard.classList.add('active-card');
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function setView(view) {
  currentView = view;
  if (view === 'edit') {
    tabInput.classList.add('active');
    tabHighlight.classList.remove('active');
    textInput.classList.remove('hidden');
    highlightViewer.classList.add('hidden');
    textInput.focus();
  } else {
    tabHighlight.classList.add('active');
    tabInput.classList.remove('active');
    textInput.classList.add('hidden');
    highlightViewer.classList.remove('hidden');
  }
}

function escapeHtml(string) {
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// Event Listeners
// ==========================================

let debounceTimer = null;
textInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updateUI();
  }, 100);
});

tabInput.addEventListener('click', () => setView('edit'));
tabHighlight.addEventListener('click', () => setView('highlight'));

sampleBtn.addEventListener('click', () => {
  textInput.value = SAMPLE_PROSE;
  updateUI();
  setView('highlight');
});

clearBtn.addEventListener('click', () => {
  textInput.value = '';
  updateUI();
  setView('edit');
});

copyBtn.addEventListener('click', async () => {
  if (!textInput.value) return;
  try {
    await navigator.clipboard.writeText(textInput.value);
    const origText = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Copied!
    `;
    setTimeout(() => {
      copyBtn.innerHTML = origText;
    }, 1800);
  } catch (err) {
    console.error('Copy failed', err);
  }
});

scrollToTopHardBtn.addEventListener('click', () => {
  focusSentenceInViewer(1);
});

// ==========================================
// Theme Management (Light by default)
// ==========================================

function getPreferredTheme() {
  const saved = localStorage.getItem('readpulse_theme');
  if (saved) return saved;
  return 'light'; // Default to light theme per user request
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('readpulse_theme', theme);

  if (theme === 'dark') {
    themeLabel.textContent = 'Light Mode';
    themeIcon.innerHTML = `
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    `;
  } else {
    themeLabel.textContent = 'Dark Mode';
    themeIcon.innerHTML = `
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    `;
  }
}

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
});

// Initialize theme and sample prose on first load
window.addEventListener('DOMContentLoaded', () => {
  applyTheme(getPreferredTheme());
  textInput.value = SAMPLE_PROSE;
  updateUI();
});
