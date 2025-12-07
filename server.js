// server.js
// Minimal Express backend that proxies translation requests to either Google Translate API (v2) or LibreTranslate.
// Usage: set env vars:
//   TRANSLATE_PROVIDER = "google" | "libre"
//   GOOGLE_API_KEY = <your-google-cloud-translate-api-key>   (if provider=google)
//   LIBRE_ENDPOINT = "https://libretranslate.de"  (if provider=libre, optional)
// Run: node server.js

import express from 'express';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({limit: '256kb'}));

// simple rate limiting
const limiter = rateLimit({
  windowMs: 10 * 1000, // 10s
  max: 15
});
app.use(limiter);

const PROVIDER = (process.env.TRANSLATE_PROVIDER || 'libre').toLowerCase();
const GOOGLE_KEY = process.env.GOOGLE_API_KEY || '';
const LIBRE_ENDPOINT = process.env.LIBRE_ENDPOINT || 'https://libretranslate.de';

app.get('/api/provider', (req,res) => {
  res.json({provider: PROVIDER});
});

// Get supported languages from provider
app.get('/api/languages', async (req,res) => {
  try {
    if (PROVIDER === 'google') {
      if (!GOOGLE_KEY) return res.status(500).json({error:'GOOGLE_API_KEY not set'});
      // Google Translate v2 list: GET https://translation.googleapis.com/language/translate/v2/languages?key=KEY&target=en
      const url = `https://translation.googleapis.com/language/translate/v2/languages?key=${GOOGLE_KEY}&target=en`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.error) return res.status(500).json({error:j.error});
      const langs = (j.data && j.data.languages) ? j.data.languages.map(l=>({code:l.language, name:l.name||l.language})) : [];
      return res.json(langs);
    } else {
      // LibreTranslate: GET /languages
      const r = await fetch(`${LIBRE_ENDPOINT}/languages`);
      const j = await r.json();
      // expected [{code:'en', name:'English'}]
      return res.json(j);
    }
  } catch (err) {
    console.error('languages error', err);
    return res.status(500).json({error:err.message || String(err)});
  }
});

// Translate endpoint: accepts JSON { target: 'hi', html: '<p>..</p>' } and returns { translatedHtml: '...' }
// The server will attempt to preserve basic HTML structure by translating paragraph/blockquote contents separately.
app.post('/api/translate', async (req,res) => {
  try {
    const { target, html } = req.body;
    if (!target || !html) return res.status(400).json({error:'target and html required'});

    // parse minimal HTML into text blocks (paragraphs, blockquote, headings)
    // naive split: use regex to find tags and translate innerText per block
    const blocks = [];
    const blockRegex = /(<(p|blockquote|h[1-6]|li)[^>]*>)([\s\S]*?)(<\/\2>)/gi;
    let lastIndex = 0;
    let m;
    while ((m = blockRegex.exec(html)) !== null) {
      const [full, openTag, tagName, inner, closeTag] = m;
      // push any leading HTML fragment
      if (m.index > lastIndex) {
        blocks.push({type:'raw', html: html.slice(lastIndex, m.index)});
      }
      blocks.push({type:'block', tag: tagName, open: openTag, text: inner, close: closeTag});
      lastIndex = m.index + full.length;
    }
    if (lastIndex < html.length) blocks.push({type:'raw', html: html.slice(lastIndex)});

    // translate each text block individually to keep formatting
    const translatedParts = [];
    for (const b of blocks) {
      if (b.type === 'raw') translatedParts.push(b.html);
      else {
        const translatedText = await translateText(b.text, target);
        // note: translatedText may contain HTML-unsafe characters; keep as text
        translatedParts.push(`${b.open}${translatedText}${b.close}`);
      }
    }

    const finalHtml = translatedParts.join('');
    return res.json({translatedHtml});
  } catch (err) {
    console.error('translate error', err);
    return res.status(500).json({error:err.message || String(err)});
  }
});

async function translateText(text, target) {
  // Provider selection
  if (PROVIDER === 'google') {
    if (!GOOGLE_KEY) throw new Error('GOOGLE_API_KEY not configured on server');
    const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`;
    const payload = {
      q: text,
      target: target,
      format: 'text'
    };
    const r = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    const translation = j.data.translations.map(t => t.translatedText).join('\n');
    return translation;
  } else {
    // LibreTranslate
    const r = await fetch(`${LIBRE_ENDPOINT}/translate`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target: target,
        format: 'text'
      })
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    // Libre returns { translatedText: "..." }
    return j.translatedText || j.translated || '';
  }
}

// serve static frontend if running in same folder (for local dev)
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '.')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Translator proxy running on port ${PORT} • provider=${PROVIDER}`);
});
