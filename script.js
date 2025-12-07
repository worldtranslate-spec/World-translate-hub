// script.js
// Client-side logic: fetch supported languages, handle search, request translation, update UI.
// Uses sessionStorage for caching translations during a session.

const langSelect = document.getElementById('lang-select');
const langSearch = document.getElementById('lang-search');
const translateBtn = document.getElementById('translate-btn');
const resetBtn = document.getElementById('reset-btn');
const articleContentEl = document.getElementById('article-content');
const langInfoEl = document.getElementById('lang-info');
const providerNameEl = document.getElementById('provider-name');
const yearEl = document.getElementById('year');

yearEl.textContent = new Date().getFullYear();

// store original content to restore
const originalHTML = articleContentEl.innerHTML;
const originalLang = { code: 'en', name: 'English' };

// helper: set provider label from server
async function fetchProvider() {
  try {
    const r = await fetch('/api/provider');
    if (!r.ok) throw new Error('no provider');
    const j = await r.json();
    providerNameEl.textContent = j.provider || 'Translator';
  } catch (e) {
    providerNameEl.textContent = 'Translator';
  }
}

// Fetch supported languages from backend and populate selector
async function loadLanguages() {
  try {
    const res = await fetch('/api/languages');
    const data = await res.json();
    // expected: [{code:'hi', name:'Hindi'}, ...]
    populateLangs(data);
  } catch (err) {
    console.error('Failed fetching languages', err);
    // fallback small set
    populateLangs([
      {code:'hi', name:'Hindi'},
      {code:'es', name:'Spanish'},
      {code:'fr', name:'French'},
      {code:'ar', name:'Arabic'},
      {code:'bn', name:'Bengali'},
      {code:'de', name:'German'}
    ]);
  }
}

function populateLangs(list) {
  // Sort by name
  list.sort((a,b)=>a.name.localeCompare(b.name));
  // include English as first option
  langSelect.innerHTML = '';
  const englishOpt = document.createElement('option');
  englishOpt.value = 'en';
  englishOpt.textContent = 'English — en';
  langSelect.appendChild(englishOpt);

  for(const l of list){
    // avoid duplicate en
    if(l.code === 'en') continue;
    const opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = `${l.name} — ${l.code}`;
    langSelect.appendChild(opt);
  }
}

// simple live search in select: filter options
langSearch.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  for (const opt of langSelect.options) {
    const text = opt.textContent.toLowerCase();
    opt.hidden = q ? !text.includes(q) : false;
  }
});

// translate
translateBtn.addEventListener('click', async () => {
  const target = langSelect.value;
  if (!target) return;
  if (target === 'en') {
    restoreOriginal();
    return;
  }

  const cacheKey = `trans:${target}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    articleContentEl.innerHTML = cached;
    updateLangInfo(target);
    return;
  }

  // get plain text article (strip html tags but keep paragraphs)
  // We'll send the full text as HTML to preserve paragraphs (server handles it)
  const htmlText = articleContentEl.innerHTML;

  translateBtn.disabled = true;
  translateBtn.textContent = 'Translating...';

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({target, html: htmlText})
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Translation failed');
    }
    const j = await res.json();
    const translatedHtml = j.translatedHtml || j.translated || '<p>(No translation)</p>';
    articleContentEl.innerHTML = translatedHtml;
    sessionStorage.setItem(cacheKey, translatedHtml);
    updateLangInfo(target);
  } catch (e) {
    alert('Translation failed: ' + (e.message || e));
    console.error(e);
  } finally {
    translateBtn.disabled = false;
    translateBtn.textContent = 'Translate';
  }
});

resetBtn.addEventListener('click', restoreOriginal);

function restoreOriginal() {
  articleContentEl.innerHTML = originalHTML;
  langInfoEl.innerHTML = `Language: <strong>${originalLang.name} (${originalLang.code})</strong>`;
}

function updateLangInfo(code) {
  const opt = [...langSelect.options].find(o => o.value === code);
  const name = opt ? opt.textContent.split(' — ')[0] : code;
  langInfoEl.innerHTML = `Language: <strong>${name} (${code})</strong>`;
}

// init
(async function(){
  await fetchProvider();
  await loadLanguages();
  restoreOriginal();
})();
