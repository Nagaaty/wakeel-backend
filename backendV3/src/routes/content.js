const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ─── Static/semi-static content: FAQ, Blog, Glossary, Contracts, Leaderboard ─

const FAQ_DATA = [
  { q:"How do I book a lawyer?", a:"Browse lawyers by specialization, view their profile and availability, then click 'Book Consultation'. Choose your service type, pick a time slot and pay securely." },
  { q:"Are all lawyers licensed?", a:"Yes. Every lawyer on Wakeel.eg is verified against the Egyptian Bar Association registry. You can see their Bar ID and verification badge on their profile." },
  { q:"What service types are available?", a:"We offer 6 service types: Text Consultation, Voice Call (30 min), Video Consultation (45 min), Case Study, Contract Drafting/Review, and Legal Memo." },
  { q:"How much does a consultation cost?", a:"Prices are set by each lawyer. Text consultations start from 150 EGP, voice and video calls from 200 EGP, and case studies/contracts from 500 EGP." },
  { q:"Is my consultation confidential?", a:"Completely. Your consultation details, documents and chat history are end-to-end encrypted and only accessible to you and your lawyer." },
  { q:"What payment methods are accepted?", a:"We accept Visa, Mastercard, Meeza, Fawry, and Vodafone Cash. All payments are processed securely through Paymob." },
  { q:"Can I cancel or reschedule?", a:"Yes. You can cancel or reschedule up to 2 hours before a scheduled voice/video call for a full refund." },
  { q:"What if I'm not satisfied?", a:"If a lawyer doesn't respond within 24 hours of a text consultation, you receive an automatic full refund. Contact support within 7 days for other disputes." },
  { q:"How do lawyers join the platform?", a:"Lawyers apply, submit their Bar Association ID for verification, complete their profile, and choose a subscription plan. Approval takes 1-2 business days." },
  { q:"Is there a free consultation?", a:"Some lawyers offer a free 15-minute initial consultation. You can also post a question on the Q&A board for free community answers." },
];

const GLOSSARY_DATA = [
  { term:"نيابة عامة", ar:"نيابة عامة", en:"Public Prosecution", def:"The state authority responsible for criminal investigations and prosecution in Egypt under the Ministry of Justice.", cat:"Criminal" },
  { term:"وقف تنفيذ", ar:"وقف تنفيذ", en:"Stay of Execution", def:"A court order temporarily halting enforcement of a judgment pending appeal or review.", cat:"Civil" },
  { term:"حكم غيابي", ar:"حكم غيابي", en:"Default Judgment", def:"A judgment issued when the defendant fails to appear or respond. Can be appealed within 30 days under Egyptian Civil Procedure Law.", cat:"Civil" },
  { term:"النفقة", ar:"النفقة", en:"Alimony / Nafaqa", def:"Financial support owed by a husband to his wife and children after divorce under Egyptian Personal Status Law.", cat:"Family" },
  { term:"حق الحبس", ar:"حق الحبس", en:"Right of Retention", def:"The right to retain another's property until a debt owed in connection with that property is paid.", cat:"Commercial" },
  { term:"الإجراءات الوقتية", ar:"الإجراءات الوقتية", en:"Interim Measures", def:"Temporary court orders issued to preserve rights pending final judgment, such as asset freezes or injunctions.", cat:"Civil" },
  { term:"خلع", ar:"خلع", en:"Khul' Divorce", def:"A form of divorce initiated by the wife in return for waiving financial rights, available under Law No. 1 of 2000.", cat:"Family" },
  { term:"عقد الإذعان", ar:"عقد الإذعان", en:"Contract of Adhesion", def:"A standard-form contract where one party has no power to negotiate terms (e.g. utility contracts). Egyptian courts may moderate unfair terms.", cat:"Commercial" },
  { term:"التقادم", ar:"التقادم", en:"Statute of Limitations", def:"Time limits for bringing legal claims under Egyptian Civil Code. General prescription period is 15 years; shorter for specific claims.", cat:"Civil" },
  { term:"الحراسة القضائية", ar:"الحراسة القضائية", en:"Judicial Custodianship", def:"Court-appointed management of disputed assets or property pending resolution of ownership disputes.", cat:"Civil" },
  { term:"براءة الذمة", ar:"براءة الذمة", en:"Discharge / Acquittance", def:"A legal release or receipt confirming that a debt or obligation has been fully settled.", cat:"Commercial" },
  { term:"الدية", ar:"الدية", en:"Blood Money / Diya", def:"Financial compensation paid to a victim's family in cases of wrongful death or bodily harm, governed by Islamic law principles in Egypt.", cat:"Criminal" },
];

const BLOG_POSTS = [
  { id:1, title:"Your Rights as an Egyptian Employee: What the Labor Law Actually Says", cat:"Labor Law", icon:"💼", author:"Dr. Ahmed Hassan", initials:"AH", date:"March 10, 2026", readTime:"5 min", likes:47, comments:12, excerpt:"Egyptian Labor Law No. 12 of 2003 provides comprehensive protections for workers. Most employees don't know these rights exist — here's what you're entitled to." },
  { id:2, title:"Divorce in Egypt: The Complete Legal Guide for 2026", cat:"Family Law", icon:"👨‍👩‍👧", author:"Dr. Nadia El-Masri", initials:"NE", date:"March 5, 2026", readTime:"8 min", likes:92, comments:31, excerpt:"Whether you're considering divorce or already in proceedings, understanding Egypt's Personal Status Law is essential. We explain every step clearly." },
  { id:3, title:"How to Register a Company in Egypt: Step-by-Step 2026", cat:"Corporate", icon:"🏢", author:"Khaled Mansour", initials:"KM", date:"Feb 28, 2026", readTime:"6 min", likes:63, comments:8, excerpt:"Starting a business in Egypt requires navigating GAFI, the Commercial Registry, and tax registration. This guide walks you through every step and cost." },
  { id:4, title:"Tenant Rights in Egypt: What Landlords Can and Cannot Do", cat:"Real Estate", icon:"🏠", author:"Sara Fouad", initials:"SF", date:"Feb 20, 2026", readTime:"4 min", likes:118, comments:44, excerpt:"Egyptian rental law heavily protects tenants — sometimes too much. Understanding both sides of the law helps avoid disputes before they start." },
  { id:5, title:"Criminal Defense in Egypt: How the Process Works", cat:"Criminal", icon:"⚖️", author:"Dr. Ahmed Hassan", initials:"AH", date:"Feb 12, 2026", readTime:"7 min", likes:35, comments:6, excerpt:"From arrest to verdict, the Egyptian criminal justice process has specific stages. Knowing your rights at each stage can be the difference between conviction and acquittal." },
];

const CONTRACT_TEMPLATES = [
  { id:1, name:"Employment Contract (Standard)", cat:"Labor", icon:"💼", description:"Full-time employment contract compliant with Egyptian Labor Law No. 12 of 2003. Includes probation period, benefits, and termination clauses.", pages:4, downloads:2847 },
  { id:2, name:"Residential Lease Agreement", cat:"Real Estate", icon:"🏠", description:"Apartment rental contract for Egyptian law. Covers rent, deposits, maintenance responsibilities, and termination conditions.", pages:3, downloads:4123 },
  { id:3, name:"Commercial Partnership Agreement", cat:"Corporate", icon:"🏢", description:"Business partnership agreement for Egyptian commercial entities. Covers profit sharing, decision-making, and dissolution terms.", pages:6, downloads:1205 },
  { id:4, name:"Freelance Service Agreement", cat:"Commercial", icon:"💻", description:"Contract for freelance and consulting services. Includes payment terms, intellectual property rights, and dispute resolution.", pages:3, downloads:3891 },
  { id:5, name:"Non-Disclosure Agreement (NDA)", cat:"Corporate", icon:"🔒", description:"Confidentiality agreement for business relationships. Bilateral and unilateral versions included.", pages:2, downloads:5672 },
  { id:6, name:"Divorce Settlement Agreement", cat:"Family", icon:"👨‍👩‍👧", description:"Template for negotiating and documenting divorce terms including alimony, custody, and asset division under Egyptian Personal Status Law.", pages:5, downloads:892 },
  { id:7, name:"Property Sale Contract", cat:"Real Estate", icon:"🏡", description:"Real estate purchase and sale agreement compliant with Egyptian property registration requirements.", pages:4, downloads:2156 },
  { id:8, name:"Business Loan Agreement", cat:"Commercial", icon:"💰", description:"Private loan agreement between businesses or individuals. Includes interest, payment schedule, and default provisions.", pages:3, downloads:1478 },
];

// GET /api/content/faq
router.get('/faq', (req, res) => res.json({ faqs: FAQ_DATA }));

// GET /api/content/glossary
router.get('/glossary', (req, res) => {
  const { search, cat } = req.query;
  let terms = GLOSSARY_DATA;
  if (cat)    terms = terms.filter(t => t.cat === cat);
  if (search) terms = terms.filter(t => t.term.includes(search) || t.en.toLowerCase().includes(search.toLowerCase()) || t.def.toLowerCase().includes(search.toLowerCase()));
  res.json({ terms });
});

// GET /api/content/blog
router.get('/blog', (req, res) => {
  const { cat } = req.query;
  let posts = BLOG_POSTS;
  if (cat) posts = posts.filter(p => p.cat === cat);
  res.json({ posts });
});

// GET /api/content/blog/:id
router.get('/blog/:id', (req, res) => {
  const post = BLOG_POSTS.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json({ post });
});

// GET /api/content/contracts
router.get('/contracts', (req, res) => {
  const { cat, search } = req.query;
  let templates = CONTRACT_TEMPLATES;
  if (cat)    templates = templates.filter(t => t.cat === cat);
  if (search) templates = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  res.json({ templates });
});

// GET /api/content/leaderboard
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { period } = req.query; // week|month|all
    const { rows } = await pool.query(`
      SELECT u.id, u.name, lp.specialization, lp.city, lp.avg_rating, lp.wins, lp.losses,
             lp.total_reviews, lp.response_time_hours,
             (lp.avg_rating * 20 + lp.wins * 2 + lp.total_reviews) as score
      FROM users u
      JOIN lawyer_profiles lp ON lp.user_id = u.id
      WHERE u.role='lawyer' AND lp.is_verified=true
      ORDER BY score DESC
      LIMIT 20
    `);
    if (rows.length === 0) {
      // Return demo data
      return res.json({ lawyers: [
        { id:1, name:'Dr. Ahmed Hassan', specialization:'Criminal Law', city:'Cairo', avg_rating:4.9, wins:287, losses:25, total_reviews:312, score:6814 },
        { id:5, name:'Dr. Omar Shafik',  specialization:'IP Law',       city:'Cairo', avg_rating:4.9, wins:231, losses:25, total_reviews:256, score:5732 },
        { id:2, name:'Dr. Nadia El-Masri', specialization:'Family Law', city:'Alexandria', avg_rating:4.8, wins:165, losses:33, total_reviews:198, score:4158 },
        { id:3, name:'Khaled Mansour',   specialization:'Corporate',    city:'Cairo', avg_rating:4.7, wins:118, losses:25, total_reviews:143, score:2619 },
        { id:4, name:'Sara Fouad',       specialization:'Real Estate',  city:'Giza',  avg_rating:4.6, wins:71,  losses:16, total_reviews:87,  score:1669 },
      ]});
    }
    res.json({ lawyers: rows });
  } catch (err) { next(err); }
});

module.exports = router;
