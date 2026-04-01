require('dotenv').config();
const pool = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Seeding database...');

  const hash = await bcrypt.hash('demo1234', 12);

  // ── Users (UUID) ──────────────────────────────────────────────────────────
  const userRes = await pool.query(`
    INSERT INTO users (name,email,phone,password_hash,role,is_verified,email_verified,phone_verified,referral_code)
    VALUES
      ('Demo Client','client@demo.com','01012345678',$1,'client',true,true,true,'WK-CL001'),
      ('Dr. Ahmed Hassan','lawyer@demo.com','01098765432',$1,'lawyer',true,true,true,'WK-AH002'),
      ('Admin User','admin@demo.com','01000000000',$1,'admin',true,true,true,'WK-AD003'),
      ('Dr. Nadia El-Masri','nadia@demo.com','01011111111',$1,'lawyer',true,true,true,'WK-NE004'),
      ('Khaled Mansour','khaled@demo.com','01022222222',$1,'lawyer',true,true,true,'WK-KM005'),
      ('Sara Fouad','sara@demo.com','01033333333',$1,'lawyer',true,true,true,'WK-SF006'),
      ('Dr. Omar Shafik','omar@demo.com','01044444444',$1,'lawyer',true,true,true,'WK-OS007'),
      ('Demo Client 2','client2@demo.com','01055555555',$1,'client',true,true,true,'WK-CL008')
    ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
    RETURNING id
  `, [hash]);

  const ids = userRes.rows.map(r => r.id);
  const [client1, lawyer1, admin1, lawyer2, lawyer3, lawyer4, lawyer5, client2] = ids;

  // ── Categories ────────────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO categories (id,name,icon) VALUES
      (1,'Corporate','🏢'),
      (2,'Family','👨‍👩‍👧'),
      (3,'Real Estate','🏠'),
      (4,'Criminal','⚖️'),
      (5,'Labor','💼'),
      (6,'Civil','📋'),
      (7,'Immigration','🌍'),
      (8,'IP','💡')
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(`SELECT setval('categories_id_seq', 10)`);

  // ── Lawyer profiles ───────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO lawyer_profiles
      (user_id,specialization,city,price,experience,bio,bar_id,
       rating,review_count,is_verified,verification_status,
       response_time,is_visible,subscription_plan)
    VALUES
      ($1,'قانون جنائي','Cairo',500,18,
       'محامٍ جنائي سابق بالنيابة العامة. خبرة 18 عاماً في الدفاع الجنائي والطعون.',
       '12345/2006',4.9,312,true,'approved','< 1 hour',true,'pro'),
      ($2,'قانون الأسرة','Alexandria',650,14,
       'متخصصة في قانون الأسرة والأحوال الشخصية. طلاق، حضانة، ميراث.',
       '23456/2010',4.8,198,true,'approved','< 2 hours',true,'pro'),
      ($3,'شركات وتجارة','Cairo',400,9,
       'قانون الشركات والعقود التجارية وصفقات الاستحواذ.',
       '34567/2015',4.7,143,true,'approved','< 3 hours',true,'basic'),
      ($4,'عقارات','Giza',350,6,
       'متخصصة في قانون العقارات ونزاعات الملكية وعقود الإيجار.',
       '45678/2018',4.6,87,true,'approved','< 4 hours',true,'basic'),
      ($5,'ملكية فكرية','Cairo',800,22,
       'خبير في قانون الملكية الفكرية والتكنولوجيا والبراءات.',
       '56789/2002',4.9,256,true,'approved','< 1 hour',true,'pro')
    ON CONFLICT (user_id) DO UPDATE SET
      rating=EXCLUDED.rating,
      review_count=EXCLUDED.review_count,
      is_verified=EXCLUDED.is_verified,
      verification_status=EXCLUDED.verification_status
  `, [lawyer1, lawyer2, lawyer3, lawyer4, lawyer5]);

  // ── Lawyer availability ───────────────────────────────────────────────────
  for (const lawyerId of [lawyer1, lawyer2, lawyer3, lawyer4, lawyer5]) {
    for (const day of [0, 1, 2, 3, 4]) {
      for (const [start, end] of [['09:00','12:00'],['14:00','18:00']]) {
        await pool.query(
          `INSERT INTO lawyer_availability (lawyer_id, day_of_week, start_time, end_time)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [lawyerId, day, start, end]
        ).catch(() => {});
      }
    }
  }

  // ── Conversations ─────────────────────────────────────────────────────────
  const convRes = await pool.query(`
    INSERT INTO conversations (client_id,lawyer_id)
    VALUES
      ($1,$2),
      ($1,$3),
      ($4,$5)
    ON CONFLICT (client_id,lawyer_id) DO UPDATE SET client_id=EXCLUDED.client_id
    RETURNING id
  `, [client1, lawyer1, lawyer2, client2, lawyer3]);
  const convIds = convRes.rows.map(r => r.id);
  const [conv1, conv2, conv3] = convIds;

  // ── Messages ──────────────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO messages (conversation_id,sender_id,text)
    VALUES
      ($1,$4,'مرحباً! كيف يمكنني مساعدتك؟'),
      ($1,$5,'أحتاج مساعدة في قضية جنائية عاجلة.'),
      ($1,$4,'فهمت. من فضلك احجز استشارة حتى نتحدث بالتفصيل بشكل آمن.'),
      ($2,$6,'مرحباً! سأكون جاهزة للجلسة في الموعد المحدد.'),
      ($2,$5,'شكراً جزيلاً دكتورة نادية.')
    ON CONFLICT DO NOTHING
  `, [conv1, conv2, conv3, lawyer1, client1, lawyer2]).catch(() => {});

  // ── Bookings ──────────────────────────────────────────────────────────────
  const bookRes = await pool.query(`
    INSERT INTO bookings
      (client_id,lawyer_id,scheduled_at,type,amount,status,notes)
    VALUES
      ($1,$3,NOW()+INTERVAL '1 day','VIDEO',500,'confirmed','قضية جنائية تحتاج مراجعة عاجلة'),
      ($1,$4,NOW()+INTERVAL '3 days','PHONE',650,'confirmed','استشارة في قضية طلاق'),
      ($1,$5,NOW()-INTERVAL '7 days','CHAT',400,'completed','مراجعة عقد شركة'),
      ($2,$5,NOW()-INTERVAL '14 days','VIDEO',400,'completed','استشارة تأسيس شركة'),
      ($1,$7,NOW()+INTERVAL '7 days','VIDEO',800,'pending','براءة اختراع جديدة')
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [client1, client2, lawyer1, lawyer2, lawyer3, lawyer4, lawyer5]).catch(() => ({ rows: [] }));
  const bookIds = (bookRes.rows || []).map(r => r.id);
  const [bk1, bk2, bk3, bk4, bk5] = bookIds;

  // ── Payments ──────────────────────────────────────────────────────────────
  if (bk1) {
    await pool.query(`
      INSERT INTO payments (booking_id,user_id,amount,method,status)
      VALUES
        ($1,$5,500,'CARD','completed'),
        ($2,$5,650,'CARD','completed'),
        ($3,$5,400,'CARD','completed'),
        ($4,$6,400,'CARD','completed')
      ON CONFLICT DO NOTHING
    `, [bk1, bk2, bk3, bk4, client1, client2]).catch(() => {});
  }

  // ── Reviews ───────────────────────────────────────────────────────────────
  if (bk3) {
    await pool.query(`
      INSERT INTO reviews (lawyer_id,client_id,booking_id,rating,comment)
      VALUES
        ($1,$3,$5,5,'خالد محامٍ ممتاز. شرح لي كل التفاصيل بوضوح تام.'),
        ($1,$4,$6,5,'احترافية عالية جداً. أنصح به بشدة.'),
        ($2,$3,$5,5,'دكتور أحمد من أفضل المحامين الجنائيين في مصر.')
      ON CONFLICT DO NOTHING
    `, [lawyer3, lawyer1, client1, client2, bk3, bk4]).catch(() => {});
  }

  // ── Favorites ─────────────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO favorites (user_id,lawyer_id)
    VALUES ($1,$3),($1,$4),($1,$7),($2,$5)
    ON CONFLICT DO NOTHING
  `, [client1, client2, lawyer1, lawyer2, lawyer3, lawyer4, lawyer5]).catch(() => {});

  // ── Notifications ─────────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO notifications (user_id,type,title,body)
    VALUES
      ($1,'booking','تم تأكيد حجزك','حجزك مع د. أحمد حسن غداً الساعة 10 صباحاً مؤكد.'),
      ($1,'payment','تم الدفع بنجاح','تم خصم 500 جنيه. رقم الإيصال WK-000001.'),
      ($1,'message','رسالة من د. أحمد حسن','مرحباً! كيف يمكنني مساعدتك؟'),
      ($2,'booking','حجز جديد!','Demo Client حجز معك غداً الساعة 10 صباحاً.'),
      ($2,'payment','تم استلام دفعة','Demo Client دفع 500 جنيه.')
    ON CONFLICT DO NOTHING
  `, [client1, lawyer1]).catch(() => {});

  // ── Subscriptions ─────────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO subscriptions (lawyer_id,plan,price,is_active,started_at,expires_at)
    VALUES
      ($1,'pro',299,true,NOW()-INTERVAL '15 days',NOW()+INTERVAL '15 days'),
      ($2,'pro',299,true,NOW()-INTERVAL '5 days', NOW()+INTERVAL '25 days'),
      ($3,'basic',99,true,NOW()-INTERVAL '10 days',NOW()+INTERVAL '20 days'),
      ($4,'elite',599,true,NOW()-INTERVAL '3 days', NOW()+INTERVAL '27 days')
    ON CONFLICT DO NOTHING
  `, [lawyer1, lawyer2, lawyer3, lawyer5]).catch(() => {});

  // ── Support tickets ───────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO support_tickets
      (user_id,subject,category,priority,status,user_name,user_email)
    VALUES
      ($1,'لم يرد المحامي على استشارتي','lawyer_issue','high','open','Demo Client','client@demo.com'),
      ($1,'استرداد مبلغ الحجز','payment','normal','resolved','Demo Client','client@demo.com'),
      ($2,'كيف أحجز استشارة فيديو؟','general','low','open','Demo Client 2','client2@demo.com')
    ON CONFLICT DO NOTHING
  `, [client1, client2]).catch(() => {});

  // ── Forum questions ───────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO forum_questions (user_id,question,category,anonymous,views)
    VALUES
      ($1,'ما حقوقي إذا لم يدفع صاحب العمل راتبي منذ شهرين؟','عمالي',true,142),
      ($2,'كم تستغرق قضية الطلاق في المحاكم المصرية؟','أسرة وطلاق',true,310),
      ($1,'هل يمكن للمالك طردي بدون إشعار مسبق؟','عقارات',true,89)
    ON CONFLICT DO NOTHING
  `, [client1, client2]).catch(() => {});

  // ── Forum answers ─────────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO forum_answers (question_id,lawyer_id,answer,upvotes,is_accepted)
    VALUES
      (1,$1,'بموجب قانون العمل المصري رقم 12 لسنة 2003، يحق لك تقديم بلاغ لوزارة العمل وطلب التحقيق مع صاحب العمل.',15,true),
      (2,$2,'عادةً تستغرق قضايا الطلاق في مصر من 6 أشهر إلى سنتين تبعاً للظروف.',22,true),
      (3,$3,'لا يحق للمالك إخراجك إلا بحكم قضائي. قانون الإيجارات المصري يكفل حقوق المستأجر.',8,false)
    ON CONFLICT DO NOTHING
  `, [lawyer1, lawyer2, lawyer4]).catch(() => {});

  // ── Broadcast requests ────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO broadcast_requests
      (client_id,title,category,description,budget,urgency,status)
    VALUES
      ($1,'أحتاج محامي طلاق في القاهرة','أسرة وطلاق',
       'أبحث عن محامٍ متخصص في قضايا الطلاق والحضانة.','800-1500','urgent','active'),
      ($2,'مراجعة عقد شركة','شركات وتجارة',
       'أحتاج مراجعة عقد تأسيس شركة ذات مسؤولية محدودة.','500-1000','normal','active')
    ON CONFLICT DO NOTHING
  `, [client1, client2]).catch(() => {});

  // ── Jobs ──────────────────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO jobs (title,company,location,type,salary_min,salary_max,description,requirements,urgent)
    VALUES
      ('Legal Counsel – Corporate','CIB Bank','Cairo, Dokki','Full-time',25000,35000,
       'CIB Bank seeks experienced corporate lawyer for M&A and regulatory work.',
       '["5+ years corporate law","Bar Association membership","Fluent Arabic/English"]',true),
      ('Family Law Associate','El-Shafei Law Firm','Alexandria','Full-time',12000,18000,
       'Growing family law firm seeking motivated associate.',
       '["2+ years family law","Strong Arabic drafting"]',false),
      ('IP & Technology Lawyer','Telecom Egypt','Cairo, Heliopolis','Full-time',20000,28000,
       'Need IP/Tech lawyer for patents and data protection.',
       '["4+ years IP/tech law","GDPR knowledge"]',true)
    ON CONFLICT DO NOTHING
  `).catch(() => {});

  // ── Court dates ───────────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO court_dates (user_id,title,court,date,time,type,reminder,notes)
    VALUES
      ($1,'جلسة استماع أولى','محكمة القاهرة الابتدائية',
       CURRENT_DATE+10,'10:00 AM','hearing',true,'إحضار جميع المستندات الأصلية'),
      ($1,'موعد تقديم المستندات','محكمة الجيزة الجزئية',
       CURRENT_DATE+15,'12:00 PM','deadline',true,'3 نسخ من كل مستند'),
      ($1,'جلسة وساطة','مركز تسوية النزاعات',
       CURRENT_DATE+22,'2:00 PM','meeting',true,'حضور الطرفين إلزامي')
    ON CONFLICT DO NOTHING
  `, [client1]).catch(() => {});

  // ── Invoices ──────────────────────────────────────────────────────────────
  if (bk3) {
    await pool.query(`
      INSERT INTO invoices
        (booking_id,user_id,lawyer_id,invoice_no,amount,tax_amount,total_amount,status,paid_at)
      VALUES
        ($1,$3,$5,'WK-INV-2026-10001',400,56,456,'paid',NOW()-INTERVAL '7 days'),
        ($2,$4,$5,'WK-INV-2026-10002',400,56,456,'paid',NOW()-INTERVAL '14 days')
      ON CONFLICT DO NOTHING
    `, [bk3, bk4, client1, client2, lawyer3]).catch(() => {});
  }

  // ── Payout requests ───────────────────────────────────────────────────────
  await pool.query(`
    INSERT INTO payout_requests (lawyer_id,amount,method,account_num,account_name,status)
    VALUES
      ($1,2500,'bank','1234567890','Banque Misr - Dr. Ahmed Hassan','completed'),
      ($2,1800,'instapay','0987654321','CIB - Dr. Nadia El-Masri','pending')
    ON CONFLICT DO NOTHING
  `, [lawyer1, lawyer2]).catch(() => {});

  console.log('✅ All tables seeded successfully');
  console.log('   Demo accounts:');
  console.log('   client@demo.com / demo1234 (client)');
  console.log('   lawyer@demo.com / demo1234 (lawyer — Dr. Ahmed Hassan)');
  console.log('   admin@demo.com  / demo1234 (admin)');
  await pool.end();
}

seed().catch(err => { console.error('Seed error:', err.message); process.exit(1); });
