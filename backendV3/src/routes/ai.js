const router  = require('express').Router();

// ─── AI Providers (tried in order) ────────────────────────────────────────────
//
// 1. Groq (FASTEST + FREE) — best for chatbot, instant responses
//    Get key at: https://console.groq.com  (free, no credit card)
//    Add to Render: GROQ_API_KEY=gsk_...
//
// 2. Google Gemini (FREE fallback)
//    Get key at: https://aistudio.google.com/app/apikey
//    Add to Render: GEMINI_API_KEY=AIza...
//
// 3. Anthropic Claude (paid fallback, $5 free credit)
//    Add to Render: ANTHROPIC_API_KEY=sk-ant-...
// ─────────────────────────────────────────────────────────────────────────────

// ── Groq (FASTEST — tries first) ────────────────────────────────────────────
async function callGroq(messages, systemText, maxTokens = 1000) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null; // Not configured

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',   // best quality on Groq, free
      messages: [
        { role: 'system', content: systemText },
        ...messages,
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Groq API error');
  return { reply: data.choices?.[0]?.message?.content || 'No response.' };
}

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

// ── Main dispatcher — tries Groq → Gemini → Claude ───────────────────────────
async function callAI(messages, systemText, maxTokens = 1000) {
  // Try Groq first (fastest + free)
  const groqResult = await callGroq(messages, systemText, maxTokens).catch(() => null);
  if (groqResult) return groqResult;

  // Try Gemini second (free)
  const geminiResult = await callGemini(messages, systemText, maxTokens).catch(() => null);
  if (geminiResult) return geminiResult;

  // Try Claude fallback (paid)
  const claudeResult = await callClaude(messages, systemText, maxTokens).catch(() => null);
  if (claudeResult) return claudeResult;

  // Nothing configured
  throw new Error('AI_NOT_CONFIGURED');
}

// ── Customer Service System Prompt (used by /api/ai/chat) ─────────────────────
// This is the Wakeel SUPPORT chatbot — it must NEVER answer legal questions.
// It only helps with: bookings, payments, account issues, app problems, platform questions.
// Legal questions → politely refuse + direct user to find a lawyer on the platform.
const EGYPT_LAW_SYSTEM = `You are a customer service assistant for "Wakeel" (وكيل), an Egyptian legal services marketplace.

Your ONLY responsibilities are to help users with:
- Booking and scheduling consultation appointments
- Payment issues, charges, and refund requests
- Complaints about lawyer behavior or professionalism
- Account access, login, profile, and settings issues
- Technical problems with the mobile app
- General questions about how the Wakeel platform works

STRICT RULES — follow these without exception:
1. If the user asks ANY legal question — even a seemingly simple one about their rights, a contract, a law, a legal procedure, or any legal topic — you must REFUSE to answer it.
   Respond with: "That's a legal question ⚖️ and I'm only able to help with platform support. To get proper legal advice, please use the 'Lawyers' tab to find a specialist — we have verified Egyptian lawyers available for consultation right now."
   In Arabic: "هذا سؤال قانوني ⚖️ ولا يمكنني الإجابة عليه — أنا هنا فقط للمساعدة في مشاكل المنصة. تفضل بزيارة تبويب 'المحامون' للتواصل مع محامٍ متخصص الآن."

2. NEVER give legal advice, legal interpretations, explain laws, or comment on legal rights or obligations — even casually.

3. Respond in the same language the user writes (Arabic or English). Default to Arabic.

4. Be friendly, concise, and solution-focused. For booking/payment issues, give exact actionable steps.

5. End every response with: "Did this help? هل ساعدك ذلك؟"

6. If the issue cannot be resolved by the AI, offer to escalate to a human support agent.`;

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
