const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

// ─── Anthropic AI Proxy ──────────────────────────────────────────────────────
// All AI calls from the frontend go through here — keeps the API key server-side
//
// Add to backend/.env:
//   ANTHROPIC_API_KEY=sk-ant-...
//
// Get your key at: https://console.anthropic.com
// Free tier: $5 credit on signup — enough for hundreds of test conversations
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

async function callClaude(messages, system, maxTokens = 1000) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your_anthropic_api_key') {
    return { reply: '⚠️ AI not configured. Add ANTHROPIC_API_KEY to backend/.env to enable AI features.' };
  }

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Claude API error');
  return { reply: data.content?.[0]?.text || 'No response.' };
}

const EGYPT_LAW_SYSTEM = `You are Justice Advisor, an expert AI legal assistant specialized exclusively in Egyptian law.
You have deep knowledge of: Civil Code (Law 131/1948), Criminal/Penal Code, Commercial Code (Law 17/1999),
Family & Personal Status Law (Laws 1/2000 and 10/2004), Labor Law (Law 12/2003), Real Estate laws,
Company Law (Law 159/1981), and Administrative Law.
Always clarify you are an AI and recommend consulting a licensed Egyptian lawyer for specific legal advice.
Be concise, practical, and cite relevant Egyptian law articles when possible.
Respond in the same language the user writes in (Arabic or English).`;

const CASE_ANALYSIS_SYSTEM = `You are a senior Egyptian legal analyst. Analyze the legal case described and provide:
1. CASE TYPE: What area of Egyptian law applies
2. KEY LEGAL ISSUES: Main legal questions
3. STRENGTHS: Arguments in the client's favor (based on Egyptian law)
4. WEAKNESSES: Potential challenges
5. SIMILAR CASES: How Egyptian courts typically rule on similar matters
6. RECOMMENDED ACTIONS: Practical next steps
7. URGENCY: Any time-sensitive legal deadlines

Format as clear sections. Be specific about Egyptian law articles. 
End with: "This analysis is for informational purposes. Consult a licensed Egyptian lawyer for advice specific to your situation."`;

const DOC_ANALYSIS_SYSTEM = `You are an expert Egyptian legal document reviewer. Analyze the document and provide:
1. DOCUMENT TYPE: What kind of legal document this is
2. PARTIES: Who is involved and their roles
3. KEY TERMS: Important clauses and their implications under Egyptian law
4. RED FLAGS: Unusual, unfair, or potentially problematic clauses
5. MISSING CLAUSES: Important protections that should be included
6. OVERALL ASSESSMENT: Is this document fair and legally sound under Egyptian law?

Be specific and practical. Flag any clauses that violate Egyptian law.`;

// POST /api/ai/chat  — general Egyptian law Q&A
router.post('/chat', async (req, res, next) => {
  try {
    const { messages, system } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages array required' });
    }
    const result = await callClaude(messages, system || EGYPT_LAW_SYSTEM);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/ai/analyze-case  — case strength analyzer
router.post('/analyze-case', async (req, res, next) => {
  try {
    const { caseText } = req.body;
    if (!caseText) return res.status(400).json({ message: 'caseText required' });
    const result = await callClaude(
      [{ role: 'user', content: `Please analyze this legal case:\n\n${caseText}` }],
      CASE_ANALYSIS_SYSTEM,
      1500
    );
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/ai/analyze-doc  — document analyzer
router.post('/analyze-doc', async (req, res, next) => {
  try {
    const { docText, docType } = req.body;
    if (!docText) return res.status(400).json({ message: 'docText required' });
    const result = await callClaude(
      [{ role: 'user', content: `Document type: ${docType || 'Unknown'}\n\nDocument content:\n${docText}` }],
      DOC_ANALYSIS_SYSTEM,
      1500
    );
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/ai/match-lawyer  — smart lawyer matching
router.post('/match-lawyer', async (req, res, next) => {
  try {
    const { issue, lawyers } = req.body;
    if (!issue) return res.status(400).json({ message: 'issue required' });
    const lawyerList = (lawyers || []).map(l =>
      `- ${l.name}, specializes in: ${l.specialization}, city: ${l.city}, rating: ${l.rating}/5, price: ${l.price} EGP`
    ).join('\n');
    const result = await callClaude([{
      role: 'user',
      content: `Client's legal issue: "${issue}"\n\nAvailable lawyers:\n${lawyerList}\n\nWhich lawyers are the best match and why? Return top 3 with brief explanation.`
    }], 'You are a legal matching assistant. Recommend the most suitable lawyers for the client\'s specific legal issue based on specialization, rating, and relevance. Be concise.', 600);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
