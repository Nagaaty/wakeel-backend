const router  = require('express').Router();

// ─── AI Provider: Google Gemini (free) → Anthropic Claude (fallback) ─────────
//
// Primary (FREE, no credit card):
//   Get key at: https://aistudio.google.com/app/apikey
//   Add to Render: GEMINI_API_KEY=AIza...
//
// Fallback (paid, $5 free credit on signup):
//   Get key at: https://console.anthropic.com
//   Add to Render: ANTHROPIC_API_KEY=sk-ant-...
// ─────────────────────────────────────────────────────────────────────────────

// ── Google Gemini ─────────────────────────────────────────────────────────────
async function callGemini(messages, systemText, maxTokens = 1000) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null; // Not configured

  const MODEL = 'gemini-1.5-flash-latest';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemText }] },
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  };

  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini API error');
  return { reply: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.' };
}

// ── Anthropic Claude ──────────────────────────────────────────────────────────
async function callClaude(messages, systemText, maxTokens = 1000) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your_anthropic_api_key') return null; // Not configured

  const res  = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-3-5-haiku-20241022', // cheapest Claude model
      max_tokens: maxTokens,
      system:     systemText,
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Claude API error');
  return { reply: data.content?.[0]?.text || 'No response.' };
}

// ── Main dispatcher — tries Gemini first, then Claude ─────────────────────────
async function callAI(messages, systemText, maxTokens = 1000) {
  // Try Gemini first (free)
  const geminiResult = await callGemini(messages, systemText, maxTokens).catch(() => null);
  if (geminiResult) return geminiResult;

  // Try Claude fallback
  const claudeResult = await callClaude(messages, systemText, maxTokens).catch(() => null);
  if (claudeResult) return claudeResult;

  // Neither configured
  throw new Error('AI_NOT_CONFIGURED');
}

// ── System prompts ─────────────────────────────────────────────────────────────
const EGYPT_LAW_SYSTEM = `You are Justice Advisor — Wakeel.eg's expert AI legal assistant specialized exclusively in Egyptian law.

Your expertise covers:
- Civil Code (Law 131/1948)
- Criminal/Penal Code
- Commercial Code (Law 17/1999)
- Family & Personal Status Law (Laws 1/2000 and 10/2004)
- Labor Law (Law 12/2003)
- Real Estate registration laws
- Company Law (Law 159/1981)
- Administrative Law

RULES:
1. Respond in the same language the user writes (Arabic or English). Default to Arabic.
2. Be practical, specific, and cite relevant Egyptian law articles when possible.
3. Structure longer answers with clear sections using emojis as headers.
4. End by noting you are an AI and recommending a certified Egyptian lawyer for their specific case.
5. If the question involves a legal specialty where a lawyer would help, append exactly one tag at the very end: [TOPIC:criminal] [TOPIC:family] [TOPIC:labor] [TOPIC:realestate] [TOPIC:corporate] [TOPIC:civil]
6. If the user is angry, distressed, or urgently needs help, acknowledge their feelings first.
7. Never refuse Egyptian legal questions. Always try to help.
8. For platform questions (booking, pricing, account), explain how Wakeel works.`;

const CASE_ANALYSIS_SYSTEM = `You are a senior Egyptian legal analyst. Analyze the legal case and provide:
1. CASE TYPE: What area of Egyptian law applies
2. KEY LEGAL ISSUES: Main legal questions
3. STRENGTHS: Arguments in client's favor based on Egyptian law
4. WEAKNESSES: Potential challenges
5. SIMILAR CASES: How Egyptian courts typically rule
6. RECOMMENDED ACTIONS: Practical next steps
7. URGENCY: Any time-sensitive legal deadlines

Be specific about Egyptian law articles. End with a disclaimer to consult a licensed Egyptian lawyer.`;

const DOC_ANALYSIS_SYSTEM = `You are an expert Egyptian legal document reviewer. Analyze and provide:
1. DOCUMENT TYPE: What kind of legal document
2. PARTIES: Who is involved and their roles
3. KEY TERMS: Important clauses and their implications under Egyptian law
4. RED FLAGS: Unusual, unfair, or problematic clauses
5. MISSING CLAUSES: Important protections that should be included
6. OVERALL ASSESSMENT: Is this document fair and legally sound under Egyptian law?

Be specific and practical. Flag any clauses that violate Egyptian law.`;

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/ai/chat  — general Egyptian law Q&A
router.post('/chat', async (req, res, next) => {
  try {
    const { messages, system } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages array required' });
    }
    const result = await callAI(messages, system || EGYPT_LAW_SYSTEM);
    res.json(result);
  } catch (err) {
    if (err.message === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({
        message: 'AI not configured',
        hint: 'Add GEMINI_API_KEY to Render environment variables. Get a free key at https://aistudio.google.com/app/apikey',
      });
    }
    next(err);
  }
});

// POST /api/ai/analyze-case
router.post('/analyze-case', async (req, res, next) => {
  try {
    const { caseText } = req.body;
    if (!caseText) return res.status(400).json({ message: 'caseText required' });
    const result = await callAI(
      [{ role: 'user', content: `Please analyze this legal case:\n\n${caseText}` }],
      CASE_ANALYSIS_SYSTEM, 1500
    );
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/ai/analyze-doc
router.post('/analyze-doc', async (req, res, next) => {
  try {
    const { docText, docType } = req.body;
    if (!docText) return res.status(400).json({ message: 'docText required' });
    const result = await callAI(
      [{ role: 'user', content: `Document type: ${docType || 'Unknown'}\n\nDocument content:\n${docText}` }],
      DOC_ANALYSIS_SYSTEM, 1500
    );
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/ai/match-lawyer
router.post('/match-lawyer', async (req, res, next) => {
  try {
    const { issue, lawyers } = req.body;
    if (!issue) return res.status(400).json({ message: 'issue required' });
    const lawyerList = (lawyers || []).map(l =>
      `- ${l.name}, specializes in: ${l.specialization}, city: ${l.city}, rating: ${l.avg_rating}/5, price: ${l.consultation_fee} EGP`
    ).join('\n');
    const result = await callAI([{
      role: 'user',
      content: `Client's legal issue: "${issue}"\n\nAvailable lawyers:\n${lawyerList}\n\nWhich lawyers are best match and why? Return top 3 with brief explanation.`,
    }], 'You are a legal matching assistant. Recommend the most suitable lawyers for the client\'s specific legal issue. Be concise.', 600);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
