const pptxgen = require("pptxgenjs");

let pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';

// Define master slide / styling
const primaryGold = 'D4AF37';
const boxColor = '27272A';

pptx.defineSlideMaster({
  title: 'MASTER_SLIDE',
  bkgd: '18181B', // Modern dark slate
  objects: [
    { rect: { x: 0, y: 0, w: '100%', h: 0.15, fill: { color: primaryGold } } }, // Thin Gold top bar
    { text: { text: "WAKEEL ⚖️", options: { x: 0.3, y: 0.3, fontSize: 12, color: 'FFFFFF', bold: true, letterSpacing: 2 } } }
  ]
});

// Helper variables
const titleStyle = { x: 0.5, y: 0.8, w: '90%', fontSize: 36, color: primaryGold, bold: true };
const subtitleStyle = { x: 0.5, y: 1.4, w: '90%', fontSize: 16, color: 'A1A1AA', italic: true };

// ------------------------------------------------------------------
// Slide 1: The Hook (Title)
let slide1 = pptx.addSlide({ bkgd: '09090B' });
slide1.addText('WAKEEL ⚖️', { x: 0, y: 1.8, w: '100%', align: 'center', fontSize: 72, color: primaryGold, bold: true });
slide1.addText('Digitizing Egypt\'s Legal Market', { x: 0, y: 3.0, w: '100%', align: 'center', fontSize: 28, color: 'FFFFFF' });
slide1.addShape(pptx.ShapeType.line, { x: 4.5, y: 3.8, w: 1, h: 0, line: { color: primaryGold, width: 2 } });
slide1.addText('INVESTOR PITCH DECK', { x: 0, y: 4.2, w: '100%', align: 'center', fontSize: 14, color: 'A1A1AA', letterSpacing: 4 });

// ------------------------------------------------------------------
// Slide 2: The Problem
let slide2 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide2.addText('The Problem', titleStyle);
slide2.addText('The Egyptian legal industry is stuck in the 1990s.', subtitleStyle);

slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.2, w: 4.2, h: 2.5, fill: { color: boxColor }, roundness: 5 });
slide2.addText('For Clients: Zero Trust & Access', { x: 0.6, y: 2.4, w: 4.0, fontSize: 20, color: 'FF5555', bold: true });
slide2.addText('• Rely entirely on blind word-of-mouth.\n• No transparent pricing.\n• High friction to find a specialized lawyer.', { x: 0.6, y: 3.2, w: 4.0, fontSize: 16, color: 'FFFFFF', bullet: true });

slide2.addShape(pptx.ShapeType.rect, { x: 5.3, y: 2.2, w: 4.2, h: 2.5, fill: { color: boxColor }, roundness: 5 });
slide2.addText('For Lawyers: Zero Digital Growth', { x: 5.4, y: 2.4, w: 4.0, fontSize: 20, color: 'FF5555', bold: true });
slide2.addText('• No digital channels to acquire new clients.\n• High overhead costs for physical networking.\n• Wasted time on unverified leads.', { x: 5.4, y: 3.2, w: 4.0, fontSize: 16, color: 'FFFFFF', bullet: true });

// ------------------------------------------------------------------
// Slide 3: The Solution
let slide3 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide3.addText('The Solution: Wakeel', titleStyle);
slide3.addText('A seamless, transparent booking marketplace that bridges the gap.', subtitleStyle);

slide3.addText('1. Instant Digital Booking', { x: 0.5, y: 2.2, w: 9.0, fontSize: 22, color: primaryGold, bold: true });
slide3.addText('Clients can browse, filter, and instantly book consultations directly through the app. Zero friction.', { x: 0.5, y: 2.6, w: 9.0, fontSize: 16, color: 'FFFFFF' });

slide3.addText('2. Verified Trust & Ratings', { x: 0.5, y: 3.2, w: 9.0, fontSize: 22, color: primaryGold, bold: true });
slide3.addText('Every lawyer is vetted. Real client reviews force transparency and elevate the quality of service across the entire platform.', { x: 0.5, y: 3.6, w: 9.0, fontSize: 16, color: 'FFFFFF' });

slide3.addText('3. Transparent Pricing & Payments', { x: 0.5, y: 4.2, w: 9.0, fontSize: 22, color: primaryGold, bold: true });
slide3.addText('In-app payments guarantee lawyers get paid, and clients know exactly what a consultation will cost before they book.', { x: 0.5, y: 4.6, w: 9.0, fontSize: 16, color: 'FFFFFF' });

// ------------------------------------------------------------------
// Slide 4: Market Opportunity (TAM)
let slide4 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide4.addText('Massive Market Opportunity', titleStyle);
slide4.addText('Egypt represents the largest untapped digital legal market in MENA.', subtitleStyle);

slide4.addText('100M+ Citizens', { x: 0.5, y: 2.5, w: 3.0, align: 'center', fontSize: 36, color: 'FFFFFF', bold: true });
slide4.addText('A massive, underserved population requiring daily legal services (contracts, disputes, advice).', { x: 0.5, y: 3.2, w: 3.0, align: 'center', fontSize: 14, color: 'A1A1AA' });

slide4.addText('150,000+ Lawyers', { x: 3.5, y: 2.5, w: 3.0, align: 'center', fontSize: 36, color: 'FFFFFF', bold: true });
slide4.addText('One of the highest lawyer-to-citizen ratios globally, hungry for modern client acquisition channels.', { x: 3.5, y: 3.2, w: 3.0, align: 'center', fontSize: 14, color: 'A1A1AA' });

slide4.addText('Multi-Billion EGP', { x: 6.5, y: 2.5, w: 3.0, align: 'center', fontSize: 36, color: '4ade80', bold: true });
slide4.addText('Total Addressable Market (TAM). The first platform to capture this network effect will monopolize the industry.', { x: 6.5, y: 3.2, w: 3.0, align: 'center', fontSize: 14, color: 'A1A1AA' });

// ------------------------------------------------------------------
// Slide 5: The Business Model
let slideEcon = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slideEcon.addText('The Business Model', titleStyle);
slideEcon.addText('A highly lean, instantly profitable, high-margin booking model.', subtitleStyle);

slideEcon.addShape(pptx.ShapeType.rect, { x: 1.0, y: 2.5, w: 2.5, h: 1.5, fill: { color: boxColor }, line: { color: 'FFFFFF', width: 1 }, roundness: 10 });
slideEcon.addText('Avg. Consultation', { x: 1.0, y: 2.8, w: 2.5, align: 'center', fontSize: 14, color: 'A1A1AA' });
slideEcon.addText('500 EGP', { x: 1.0, y: 3.3, w: 2.5, align: 'center', fontSize: 28, color: 'FFFFFF', bold: true });

slideEcon.addShape(pptx.ShapeType.rect, { x: 3.75, y: 2.5, w: 2.5, h: 1.5, fill: { color: boxColor }, line: { color: primaryGold, width: 2 }, roundness: 10 });
slideEcon.addText('Wakeel Commission', { x: 3.75, y: 2.8, w: 2.5, align: 'center', fontSize: 14, color: 'A1A1AA' });
slideEcon.addText('10%', { x: 3.75, y: 3.3, w: 2.5, align: 'center', fontSize: 32, color: primaryGold, bold: true });

slideEcon.addShape(pptx.ShapeType.rect, { x: 6.5, y: 2.5, w: 2.5, h: 1.5, fill: { color: boxColor }, line: { color: '4ade80', width: 2 }, roundness: 10 });
slideEcon.addText('Gross Profit / Booking', { x: 6.5, y: 2.8, w: 2.5, align: 'center', fontSize: 14, color: 'A1A1AA' });
slideEcon.addText('50 EGP', { x: 6.5, y: 3.3, w: 2.5, align: 'center', fontSize: 32, color: '4ade80', bold: true });

// ------------------------------------------------------------------
// Slide 6: Validation (Avvo)
let slideAvvo = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slideAvvo.addText('Case Study: Avvo 🇺🇸', titleStyle);
slideAvvo.addText('Acquired for $650M. The perfect US comparable for a pure lawyer marketplace.', subtitleStyle);
slideAvvo.addText([
  { text: 'The Playbook: ', options: { bold: true, color: primaryGold } },
  { text: 'Launched by aggressively rating 90% of US lawyers via public records. Sued by lawyers, won lawsuit, generated massive free PR.' }
], { x: 0.5, y: 2.2, w: '90%', fontSize: 18, color: 'FFFFFF' });
slideAvvo.addText([
  { text: 'The Result: ', options: { bold: true, color: primaryGold } },
  { text: 'Hit extreme profitability once the network effect of Q&A forums and direct booking took over.' }
], { x: 0.5, y: 3.2, w: '90%', fontSize: 18, color: 'FFFFFF' });
slideAvvo.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.5, w: 9.0, h: 0.6, fill: { color: boxColor }, roundness: 5 });
slideAvvo.addText('Their Flaw: Charged an exorbitant ~25% cut per booking (framed as a "Marketing Fee").', { x: 0.6, y: 4.6, w: 8.8, fontSize: 16, color: 'FF5555', bold: true });

// ------------------------------------------------------------------
// Slide 7: Validation (Vezeeta)
let slideVezeeta = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slideVezeeta.addText('Case Study: Vezeeta 🇪🇬', titleStyle);
slideVezeeta.addText('Raised $70M+. The dominant professional booking app in MENA.', subtitleStyle);
slideVezeeta.addText([
  { text: 'The Playbook: ', options: { bold: true, color: primaryGold } },
  { text: 'Pivoted from failing EMR software into a B2C patient booking marketplace.' }
], { x: 0.5, y: 2.2, w: '90%', fontSize: 18, color: 'FFFFFF' });
slideVezeeta.addText([
  { text: 'The Result: ', options: { bold: true, color: primaryGold } },
  { text: 'Booking model exploded. Solved the exact same trust and discovery problems in MENA healthcare that Wakeel is solving in Law.' }
], { x: 0.5, y: 3.2, w: '90%', fontSize: 18, color: 'FFFFFF' });
slideVezeeta.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.5, w: 9.0, h: 0.6, fill: { color: boxColor }, roundness: 5 });
slideVezeeta.addText('Their Flaw: Extremely expensive for providers (~15-20% fee + Monthly SaaS subscriptions).', { x: 0.6, y: 4.6, w: 8.8, fontSize: 16, color: 'FF5555', bold: true });

// ------------------------------------------------------------------
// Slide 8: Validation (Bynh)
let slideBynh = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slideBynh.addText('Case Study: Bynh 🇸🇦', titleStyle);
slideBynh.addText('The Saudi legal app that proves MENA lawyers and clients will adopt a booking app.', subtitleStyle);
slideBynh.addText([
  { text: 'The Playbook: ', options: { bold: true, color: primaryGold } },
  { text: 'Aggressive B2B lawyer acquisition in Year 1, followed by heavy B2C client marketing in Year 2.' }
], { x: 0.5, y: 2.2, w: '90%', fontSize: 18, color: 'FFFFFF' });
slideBynh.addText([
  { text: 'The Result: ', options: { bold: true, color: primaryGold } },
  { text: 'Successfully raised institutional VC money (Flat6Labs), proving that local investors see massive profit potential in this specific model.' }
], { x: 0.5, y: 3.2, w: '90%', fontSize: 18, color: 'FFFFFF' });
slideBynh.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.5, w: 9.0, h: 0.6, fill: { color: boxColor }, roundness: 5 });
slideBynh.addText('Their Flaw: Hidden commission margins estimated at 15-20% built into fixed pricing.', { x: 0.6, y: 4.6, w: 8.8, fontSize: 16, color: 'FF5555', bold: true });

// ------------------------------------------------------------------
// Slide 9: Why Egyptian Apps Failed
let slideFailed = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slideFailed.addText('Why Early Egyptian Legal Apps Failed', titleStyle);
slideFailed.addText('And exactly how Wakeel exploits their fatal flaws.', subtitleStyle);

slideFailed.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.0, w: 9.0, h: 0.8, fill: { color: boxColor }, roundness: 5 });
slideFailed.addText('1. The "Yellow Pages" Trap (Poor UX)', { x: 0.6, y: 2.1, w: 8.8, fontSize: 18, color: 'FF5555', bold: true });
slideFailed.addText('Early apps forced users to manually call lawyers. Wakeel uses instant slot-booking and in-app payment, creating zero friction.', { x: 0.6, y: 2.4, w: 8.8, fontSize: 14, color: 'FFFFFF' });

slideFailed.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.0, w: 9.0, h: 0.8, fill: { color: boxColor }, roundness: 5 });
slideFailed.addText('2. Zero Quality Control', { x: 0.6, y: 3.1, w: 8.8, fontSize: 18, color: 'FF5555', bold: true });
slideFailed.addText('Competitors allowed anyone to sign up, destroying trust. Wakeel enforces strict vetting, verified licenses, and a transparent rating system.', { x: 0.6, y: 3.4, w: 8.8, fontSize: 14, color: 'FFFFFF' });

slideFailed.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.0, w: 9.0, h: 0.8, fill: { color: boxColor }, roundness: 5 });
slideFailed.addText('3. Flawed Monetization', { x: 0.6, y: 4.1, w: 8.8, fontSize: 18, color: 'FF5555', bold: true });
slideFailed.addText('Competitors demanded huge upfront lawyer fees. Wakeel uses a clean 10% commission on successful bookings. A "No-Brainer" for lawyers.', { x: 0.6, y: 4.4, w: 8.8, fontSize: 14, color: 'FFFFFF' });

// ------------------------------------------------------------------
// Slide 10: 3-Year Financial Growth
let slideGrowth = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slideGrowth.addText('3-Year Financial Projections', titleStyle);
slideGrowth.addText('A timeline to exponential profitability and market dominance.', subtitleStyle);

// Year 1 Col
slideGrowth.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.0, w: 2.8, h: 3.2, fill: { color: boxColor }, roundness: 5 });
slideGrowth.addText('YEAR 1', { x: 0.5, y: 2.2, w: 2.8, align: 'center', fontSize: 24, color: primaryGold, bold: true });
slideGrowth.addText('30k Clients\n1.5k Lawyers', { x: 0.5, y: 2.8, w: 2.8, align: 'center', fontSize: 16, color: 'FFFFFF' });
slideGrowth.addText('Revenue: 2.25M EGP', { x: 0.5, y: 3.6, w: 2.8, align: 'center', fontSize: 16, color: 'A1A1AA' });
slideGrowth.addText('Profit: +750k EGP', { x: 0.5, y: 4.2, w: 2.8, align: 'center', fontSize: 20, color: '4ade80', bold: true });

// Year 2 Col
slideGrowth.addShape(pptx.ShapeType.rect, { x: 3.6, y: 2.0, w: 2.8, h: 3.2, fill: { color: boxColor }, roundness: 5 });
slideGrowth.addText('YEAR 2', { x: 3.6, y: 2.2, w: 2.8, align: 'center', fontSize: 24, color: primaryGold, bold: true });
slideGrowth.addText('100k Clients\n4k Lawyers', { x: 3.6, y: 2.8, w: 2.8, align: 'center', fontSize: 16, color: 'FFFFFF' });
slideGrowth.addText('Revenue: 7.5M EGP', { x: 3.6, y: 3.6, w: 2.8, align: 'center', fontSize: 16, color: 'A1A1AA' });
slideGrowth.addText('Profit: +4.5M EGP', { x: 3.6, y: 4.2, w: 2.8, align: 'center', fontSize: 20, color: '4ade80', bold: true });

// Year 3 Col
slideGrowth.addShape(pptx.ShapeType.rect, { x: 6.7, y: 2.0, w: 2.8, h: 3.2, fill: { color: boxColor }, roundness: 5 });
slideGrowth.addText('YEAR 3', { x: 6.7, y: 2.2, w: 2.8, align: 'center', fontSize: 24, color: primaryGold, bold: true });
slideGrowth.addText('300k Clients\n10k Lawyers', { x: 6.7, y: 2.8, w: 2.8, align: 'center', fontSize: 16, color: 'FFFFFF' });
slideGrowth.addText('Revenue: 22.5M EGP', { x: 6.7, y: 3.6, w: 2.8, align: 'center', fontSize: 16, color: 'A1A1AA' });
slideGrowth.addText('Profit: +16.5M EGP', { x: 6.7, y: 4.2, w: 2.8, align: 'center', fontSize: 20, color: '4ade80', bold: true });

// ------------------------------------------------------------------
// Slide 11: The Ask
let slideAsk = pptx.addSlide({ bkgd: '09090B' });
slideAsk.addText('The Ask', { x: 0, y: 1.8, w: '100%', align: 'center', fontSize: 60, color: primaryGold, bold: true });
slideAsk.addText('Seeking Seed Investment to execute our Year 1 strategy, aggressively acquire lawyer supply, and capture the Egyptian market.', { x: 1.0, y: 3.0, w: '80%', align: 'center', fontSize: 20, color: 'FFFFFF' });
slideAsk.addText("Let's build the future together.", { x: 0, y: 4.5, w: '100%', align: 'center', fontSize: 24, color: primaryGold, bold: true });

pptx.writeFile({ fileName: 'Wakeel_Pitch_Deck.pptx' }).then(fileName => {
    console.log('Successfully created: ' + fileName);
});
