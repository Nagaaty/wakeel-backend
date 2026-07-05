require('dotenv').config();
const pool = require('./src/config/db');

async function seedFirms() {
  console.log('🌱 Seeding Law Firms & Linking Lawyers...');
  try {
    // 1. Insert 5 corporate firms
    const firmsRes = await pool.query(`
      INSERT INTO firms (name, bio, logo_url, city, rating, review_count, office_hours, phone, website)
      VALUES
        (
          'الناصر للمحاماة والاستشارات القانونية',
          'We are a full-service corporate law firm specializing in company formation, contract negotiation, taxation, and international investment in Cairo.',
          'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop',
          'Cairo',
          4.8,
          24,
          'Sun-Thu 9AM-6PM',
          '0227901234',
          'https://elnasr-law.com'
        ),
        (
          'مجموعة الإسكندرية الدولية للمحاماة البحرية والتجارية',
          'Top-tier maritime, shipping, customs, and international trade law group based in Alexandria. Offering 30+ years of legal counsel.',
          'https://images.unsplash.com/photo-1497366216548-37526070297c?w=150&h=150&fit=crop',
          'Alexandria',
          4.7,
          18,
          'Sun-Thu 10AM-5PM',
          '034829302',
          'https://alex-maritime-law.com'
        ),
        (
          'مكتب الجيزة للأحوال الشخصية وقضايا الأسرة',
          'Specialized legal firm for family disputes, alimony, divorce, custody, and inheritance issues in Giza. Direct personal assistance.',
          'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=150&h=150&fit=crop',
          'Giza',
          4.9,
          32,
          'Sat-Thu 11AM-8PM',
          '0237402910',
          'https://giza-family-law.com'
        ),
        (
          'مجموعة الدلتا للاستشارات التجارية والشركات',
          'A leading regional firm in Mansoura advising small and medium enterprises (SMEs) on commercial contracts, litigation, and labor law.',
          'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=150&h=150&fit=crop',
          'Mansoura',
          4.6,
          12,
          'Sun-Thu 10AM-4PM',
          '0502283920',
          'https://delta-corp-law.com'
        ),
        (
          'مكتب أسيوط والوجه القبلي للمحاماة الجنائية والمدنية',
          'Providing premium litigation support, criminal defense, and civil liability claims in Asyut and all Upper Egypt governorates.',
          'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=150&h=150&fit=crop',
          'Asyut',
          4.8,
          15,
          'Sat-Thu 1PM-9PM',
          '0882390192',
          'https://asyut-litigation.com'
        )
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `);

    const firms = firmsRes.rows;
    if (firms.length === 0) {
      // Fetch existing firms if already inserted
      const existing = await pool.query('SELECT id, name FROM firms LIMIT 5');
      firms.push(...existing.rows);
    }
    console.log(`✅ Loaded ${firms.length} Law Firms.`);

    // 2. Select individual lawyer profiles (exclude demo lawyer to keep clean)
    const lawyersRes = await pool.query(`
      SELECT lp.id, lp.specialization, u.email
      FROM lawyer_profiles lp
      JOIN users u ON lp.user_id = u.id
      WHERE u.email != 'lawyer@demo.com'
      ORDER BY lp.created_at ASC
      LIMIT 15
    `);

    const lawyers = lawyersRes.rows;
    console.log(`🔍 Found ${lawyers.length} lawyers to link to firms.`);

    // 3. Link them to the 5 firms evenly (3 lawyers per firm)
    for (let i = 0; i < lawyers.length; i++) {
      const lawyer = lawyers[i];
      const firm = firms[i % firms.length];
      
      await pool.query(`
        UPDATE lawyer_profiles
        SET practitioner_type = 'firm_member',
            firm_id = $1
        WHERE id = $2
      `, [firm.id, lawyer.id]);
      
      console.log(`   🔗 Linked lawyer [${lawyer.email}] to firm [${firm.name}]`);
    }

    console.log('🎉 Seeding firms & linking completed successfully!');
  } catch (err) {
    console.error('❌ Seeding firms failed:', err.message);
  } finally {
    pool.end();
  }
}

seedFirms();
