require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const cheerio = require('cheerio');
const pool = require('../config/db');

const TARGETS = [
  { id: 'civil_code', url: 'https://manshurat.org/node/14675', nameAr: 'القانون المدني (رقم 131 لسنة 1948)', nameEn: 'Civil Code' },
  { id: 'penal_code', url: 'https://manshurat.org/node/14677', nameAr: 'قانون العقوبات (رقم 58 لسنة 1937)', nameEn: 'Penal Code' },
  { id: 'criminal_proc', url: 'https://manshurat.org/node/14676', nameAr: 'قانون الإجراءات الجنائية', nameEn: 'Criminal Procedure Code' },
  { id: 'civil_proc', url: 'https://manshurat.org/node/14678', nameAr: 'قانون المرافعات المدنية والتجارية', nameEn: 'Civil and Commercial Procedures Code' },
  { id: 'commercial_code', url: 'https://manshurat.org/node/11468', nameAr: 'قانون التجارة (رقم 17 لسنة 1999)', nameEn: 'Commercial Code' },
  { id: 'labor_law', url: 'https://manshurat.org/node/11448', nameAr: 'قانون العمل (رقم 12 لسنة 2003)', nameEn: 'Labor Law' }
];

async function parseAndInsert(target, text) {
  console.log(`[${target.id}] Parsing text...`);
  
  // Clean text and normalize spaces
  let cleanText = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  
  // Advanced regex to split by "مادة X" or "مادة (X)" or "مادة X مكرر"
  // It looks for the word "مادة" followed by numbers, optionally wrapped in parens, optionally followed by letters or "مكرر"
  const articleRegex = /مادة\s*\(?(\d+[أ-ي]?\s*(?:مكرر[اً]?)?)\)?\s*-?/g;
  
  let match;
  const articles = [];
  let lastIndex = 0;
  let currentArticleNumber = null;

  // We iterate through the text, slicing it chunk by chunk
  while ((match = articleRegex.exec(cleanText)) !== null) {
    if (currentArticleNumber !== null) {
      // The content of the previous article is everything between the last match and this match
      const content = cleanText.substring(lastIndex, match.index).trim();
      if (content.length > 5) {
        articles.push({
          number: currentArticleNumber,
          content: content
        });
      }
    }
    currentArticleNumber = match[1].trim(); // e.g. "163" or "1 مكرر"
    lastIndex = match.index + match[0].length;
  }
  
  // Push the very last article
  if (currentArticleNumber !== null) {
    const content = cleanText.substring(lastIndex).trim();
    if (content.length > 5) {
      articles.push({
        number: currentArticleNumber,
        content: content
      });
    }
  }

  console.log(`[${target.id}] Found ${articles.length} articles. Inserting into DB...`);

  // Bulk Insert
  let insertedCount = 0;
  for (const article of articles) {
    const law_id = `${target.id}_${article.number.replace(/\s+/g, '_')}`;
    const article_number = `مادة ${article.number}`;
    const article_number_en = `Article ${article.number}`;

    try {
      await pool.query(
        `INSERT INTO laws 
          (law_id, law_name, law_name_en, article_number, article_number_en, content, content_en) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (law_id) DO UPDATE 
         SET content = EXCLUDED.content`,
        [
          law_id, 
          target.nameAr, 
          target.nameEn, 
          article_number, 
          article_number_en, 
          article.content, 
          'Automatic Translation Pending' // English content can be added later via AI bulk translation
        ]
      );
      insertedCount++;
    } catch (err) {
      console.error(`[${target.id}] Error inserting article ${article.number}:`, err.message);
    }
  }
  
  console.log(`✅ [${target.id}] Successfully inserted ${insertedCount} articles!`);
}

async function runScraper() {
  console.log('🚀 Starting Comprehensive Legal Scraping Engine...\n');
  
  for (const target of TARGETS) {
    console.log(`⏳ Fetching ${target.nameEn}... (${target.url})`);
    try {
      const response = await axios.get(target.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 15000 // 15 seconds
      });
      
      const $ = cheerio.load(response.data);
      
      // Manshurat usually places the main law text inside .field-name-body
      let rawText = $('.field-name-body').text();
      
      if (!rawText || rawText.length < 500) {
         rawText = $('article').text(); // Fallback
      }
      
      if (!rawText || rawText.length < 500) {
        console.warn(`⚠️ [${target.id}] Could not find sufficient text on page.`);
        continue;
      }
      
      await parseAndInsert(target, rawText);
      
    } catch (err) {
      console.error(`❌ [${target.id}] Request failed:`, err.message);
    }
    
    // Polite delay between massive scrapes
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n🎉 Legal Scraping Engine completed successfully!');
  process.exit(0);
}

runScraper();
