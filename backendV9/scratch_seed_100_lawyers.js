require('dotenv').config();
const pool = require('./src/config/db');

const FIRST_NAMES_MALE = [
  'أحمد', 'محمد', 'محمود', 'مصطفى', 'عمرو', 'شريف', 'كريم', 'خالد', 'هاني', 'ياسر',
  'طارق', 'هشام', 'علاء', 'تامر', 'إيهاب', 'وائل', 'رامي', 'ماجد', 'شادي', 'إسلام',
  'حسن', 'حسين', 'علي', 'عمر', 'سامح', 'شريف', 'مدحت', 'حاتم', 'أيمن', 'أشرف'
];

const FIRST_NAMES_FEMALE = [
  'ياسمين', 'نهى', 'منى', 'رانيا', 'مها', 'هبة', 'مروة', 'أميرة', 'سارة', 'دينا',
  'شيرين', 'إيمان', 'داليا', 'ندى', 'آية', 'فاطمة', 'علا', 'سالي', 'يمنى', 'ريهام',
  'ندين', 'هدى', 'فريدة', 'ليلى', 'ندى', 'نور', 'مريم', 'جيهان', 'دعاء', 'سوزان'
];

const LAST_NAMES = [
  'منصور', 'عبد الرحمن', 'حجازي', 'فايد', 'سالم', 'الشناوي', 'سليم', 'البدري', 'الصاوي', 'الجارحي',
  'النجار', 'غانم', 'التهامي', 'الشافعي', 'الهواري', 'الجبالي', 'رضوان', 'زكي', 'عبد المجيد', 'الصيرفي',
  'عثمان', 'سعيد', 'حافظ', 'كامل', 'خليل', 'بكري', 'شاكر', 'مراد', 'عزمي', 'سليمان'
];

const EN_NAMES = [
  'Michael Smith', 'Sarah Johnson', 'James Williams', 'Emily Brown', 'John Davis',
  'Robert Miller', 'Linda Wilson', 'William Moore', 'Elizabeth Taylor', 'David Anderson',
  'Richard Thomas', 'Jessica Jackson', 'Joseph White', 'Karen Harris', 'Thomas Martin',
  'Nancy Thompson', 'Charles Garcia', 'Lisa Martinez', 'Daniel Robinson', 'Sandra Clark'
];

const SPECIALIZATIONS = [
  { spec: 'قانون الأسرة والأحوال الشخصية', topic: 'family', enTitle: 'Family Law Specialist' },
  { spec: 'القانون الجنائي والدفاع', topic: 'criminal', enTitle: 'Criminal Defense Attorney' },
  { spec: 'قانون الشركات والتجارة والاستثمار', topic: 'corporate', enTitle: 'Corporate & Business Counsel' },
  { spec: 'قانون العقارات والأراضي والشهر العقاري', topic: 'realestate', enTitle: 'Real Estate & Property Attorney' },
  { spec: 'قانون العمل والمنازعات العمالية', topic: 'labor', enTitle: 'Labor & Employment Lawyer' },
  { spec: 'القانون المدني والتعويضات', topic: 'civil', enTitle: 'Civil Litigation Lawyer' }
];

const CITIES = ['Cairo', 'Alexandria', 'Giza', 'Mansoura', 'Tanta'];
const SUB_PLANS = ['basic', 'pro', 'elite'];
const PRICES = [150, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200];

const BIOS_AR = {
  family: [
    'متخصص في قضايا الأسرة والأحوال الشخصية. طلاق، خلع، حضانة، ونفقة ونزاعات الميراث.',
    'مستشارة قانونية متخصصة في الأحوال الشخصية ومحاكم الأسرة. خبرة في صياغة عقود الزواج والطلاق.',
    'أقدم استشارات قانونية متكاملة في المسائل العائلية والمواريث وتوزيع التركات وصياغة تسويات الطلاق الودية.'
  ],
  criminal: [
    'محامٍ جنائي سابق بالنيابة العامة. خبرة واسعة في الدفاع في الجنايات والجنح والطعون الجنائية.',
    'متخصص في قضايا الجنايات، غسيل الأموال، والجرائم الإلكترونية والدفاع أمام الجنايات والجنح.',
    'نقدم تمثيلاً قانونياً قوياً للمتهمين في جميع القضايا الجنائية والجنح والتحقيقات الرسمية.'
  ],
  corporate: [
    'خبير في تأسيس الشركات، عقود الاستثمار، والاندماج والاستحواذ وصياغة العقود التجارية الدولية.',
    'مستشار قانوني للشركات الناشئة والمجموعات التجارية. مراجعة العقود وتأسيس الشركات في الهيئة العامة للاستثمار.',
    'متخصص في قانون الشركات، النزاعات التجارية، التحكيم التجاري، وحماية الملكية الفكرية والعلامات التجارية.'
  ],
  realestate: [
    'متخصص في قضايا العقارات، تسجيل الأراضي في الشهر العقاري، وصياغة عقود البيع والشراء والإيجار.',
    'خبرة في فحص صحة ونفاذ عقود البيع وتسجيل العقارات وحل نزاعات الملكية العقارية والطرد.',
    'مستشار قانوني في مجال التطوير العقاري، التراخيص، ونزاعات عقود الإيجار والملكية المشتركة.'
  ],
  labor: [
    'مستشار متخصص في قانون العمل المصري. نزاعات الفصل التعسفي، مستحقات الموظفين وصياغة لوائح العمل.',
    'خبرة في تسوية النزاعات العمالية أمام مكتب العمل والمحاكم العمالية للشركات والأفراد.',
    'مستشارة قانونية متخصصة في عقود العمل، التأمينات الاجتماعية، وحقوق العمال ومنازعات الأجور والتعويضات.'
  ],
  civil: [
    'متخصص في القانون المدني، قضايا التعويضات، العقود المدنية ونزاعات الديون والالتزامات.',
    'مستشار قانوني في المنازعات المدنية والدعاوى القضائية وصياغة كافة أنواع العقود والاتفاقيات.',
    'خبرة طويلة في الطعون المدنية ودعاوى التعويض عن الأضرار المادية والمعنوية ونزاعات العقود والالتزامات.'
  ]
};

const BIOS_EN = {
  family: [
    'Specialized in Family & Personal Status law. Handling divorce, custody, alimony, and inheritance disputes.',
    'Expert legal counsel in family disputes, prenuptial agreements, and division of estates.',
    'Comprehensive legal support for domestic relations, child support, and probate administration.'
  ],
  criminal: [
    'Former prosecutor with over 15 years of experience in criminal defense, felonies, and appeals.',
    'Specialized in criminal law, cybercrimes, fraud defense, and police station representation.',
    'Providing aggressive representation for complex criminal charges, trials, and judicial investigations.'
  ],
  corporate: [
    'Specialized in company formations (GAFI), joint ventures, compliance, and international contract drafting.',
    'Legal advisor for startups and international businesses. Mergers, acquisitions, and corporate governance.',
    'Expert in commercial arbitration, corporate restructuring, trademark registration, and IP law.'
  ],
  realestate: [
    'Expert in Egyptian real estate registration (Notary Public), property disputes, and drafting sale agreements.',
    'Handling real estate due diligence, land ownership disputes, and commercial lease negotiations.',
    'Specialized in property litigation, building permits, and zoning regulatory compliance.'
  ],
  labor: [
    'Labor Law consultant. Handling wrongful termination claims, employee handbooks, and labor office disputes.',
    'Experienced in representation before the labor court and social insurance disputes for employers and employees.',
    'Specialized in employment contracts, compensation claims, and collective bargaining agreements.'
  ],
  civil: [
    'Expert in civil disputes, contract breach claims, debt recovery, and liability lawsuits.',
    'Drafting legal contracts, filing civil appeals, and claiming financial compensations for damages.',
    'Specialized in general civil litigation, obligations, and enforcement of judicial judgements.'
  ]
};

async function seed() {
  console.log('🌱 Starting seed script for 100 lawyers...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Hash dummy password 'password123'
    const dummyPasswordHash = '$2b$10$tJ0gqI.aT2xHnpej9B2PiuW/t7oI6666666666666666666666666'; // Dummy hash representing 'password123'

    let count = 0;
    for (let i = 0; i < 100; i++) {
      const isEnglish = Math.random() < 0.2; // 20% English profiles
      let name, email, phone, city;
      
      phone = '+201' + Math.floor(100000000 + Math.random() * 900000000);
      city = CITIES[Math.floor(Math.random() * CITIES.length)];
      
      const specObj = SPECIALIZATIONS[Math.floor(Math.random() * SPECIALIZATIONS.length)];
      const spec = specObj.spec;
      const topic = specObj.topic;
      
      let bio, title;
      
      if (isEnglish) {
        name = EN_NAMES[i % EN_NAMES.length] + ' ' + (i + 1);
        email = `lawyer_${i + 1}@wakeel-test.com`;
        bio = BIOS_EN[topic][Math.floor(Math.random() * BIOS_EN[topic].length)];
        title = specObj.enTitle;
      } else {
        const isMale = Math.random() < 0.7;
        const first = isMale 
          ? FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)] 
          : FIRST_NAMES_FEMALE[Math.floor(Math.random() * FIRST_NAMES_FEMALE.length)];
        const last1 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const last2 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        name = `${first} ${last1} ${last2}`;
        email = `lawyer_ar_${i + 1}@wakeel-test.com`;
        bio = BIOS_AR[topic][Math.floor(Math.random() * BIOS_AR[topic].length)];
        title = isMale ? 'مستشار قانوني' : 'مستشارة قانونية';
      }

      // Check if user already exists to avoid unique constraint violations
      const existCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      let userId;
      
      if (existCheck.rows.length > 0) {
        userId = existCheck.rows[0].id;
      } else {
        const userRes = await client.query(
          `INSERT INTO users (name, email, phone, password_hash, role, city, is_verified, is_active)
           VALUES ($1, $2, $3, $4, 'lawyer', $5, true, true)
           RETURNING id`,
          [name, email, phone, dummyPasswordHash, city]
        );
        userId = userRes.rows[0].id;
      }

      const barId = `${Math.floor(10000 + Math.random() * 90000)}/${2000 + Math.floor(Math.random() * 25)}`;
      const exp = 3 + Math.floor(Math.random() * 28);
      const price = PRICES[Math.floor(Math.random() * PRICES.length)];
      const rating = parseFloat((4.3 + Math.random() * 0.7).toFixed(2));
      const reviewCount = Math.floor(Math.random() * 160);
      const subPlan = SUB_PLANS[Math.floor(Math.random() * SUB_PLANS.length)];

      await client.query(
        `INSERT INTO lawyer_profiles (
          user_id, title, bar_id, specialization, experience, price, bio, city,
          rating, review_count, is_verified, is_available, subscription_plan
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, true, $11)
         ON CONFLICT (user_id) DO UPDATE SET
          specialization = EXCLUDED.specialization,
          price = EXCLUDED.price,
          experience = EXCLUDED.experience,
          bio = EXCLUDED.bio,
          rating = EXCLUDED.rating,
          review_count = EXCLUDED.review_count,
          subscription_plan = EXCLUDED.subscription_plan,
          is_verified = true,
          is_available = true`,
        [userId, title, barId, spec, exp, price, bio, city, rating, reviewCount, subPlan]
      );
      count++;
    }

    await client.query('COMMIT');
    console.log(`🎉 Successfully seeded ${count} lawyer profiles!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
