import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, 'marketplace.db');
const db = new DatabaseSync(dbFile);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT 'Pass@123',
      role TEXT NOT NULL DEFAULT 'borrower',
      phone TEXT,
      city TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appliances (
      id TEXT PRIMARY KEY,
      lender_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      description TEXT,
      condition TEXT NOT NULL,
      market_value REAL NOT NULL,
      daily_rate REAL NOT NULL,
      weekly_rate REAL NOT NULL,
      monthly_rate REAL NOT NULL,
      deposit_amount REAL NOT NULL,
      commission_rate REAL DEFAULT 0.15,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      images_json TEXT NOT NULL,
      features_json TEXT,
      rating REAL DEFAULT 4.8,
      total_reviews INT DEFAULT 12,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      borrower_id TEXT NOT NULL,
      total_rent REAL NOT NULL,
      total_commission REAL NOT NULL,
      total_deposit REAL NOT NULL,
      delivery_fee REAL NOT NULL,
      grand_total REAL NOT NULL,
      commission_payer TEXT DEFAULT 'borrower',
      payment_status TEXT NOT NULL DEFAULT 'PAID',
      payment_method TEXT DEFAULT 'UPI / NetBanking',
      gateway_txn_id TEXT,
      shipping_address_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (borrower_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sub_orders (
      id TEXT PRIMARY KEY,
      parent_order_id TEXT NOT NULL,
      lender_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      rent_subtotal REAL NOT NULL,
      commission_subtotal REAL NOT NULL,
      deposit_subtotal REAL NOT NULL,
      delivery_fee REAL NOT NULL,
      tracking_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_order_id) REFERENCES orders(id),
      FOREIGN KEY (lender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      sub_order_id TEXT NOT NULL,
      parent_order_id TEXT NOT NULL,
      appliance_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      duration INT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      rent_amount REAL NOT NULL,
      commission_amount REAL NOT NULL,
      deposit_amount REAL NOT NULL,
      market_value REAL NOT NULL,
      FOREIGN KEY (sub_order_id) REFERENCES sub_orders(id),
      FOREIGN KEY (appliance_id) REFERENCES appliances(id)
    );

    CREATE TABLE IF NOT EXISTS deposit_ledger (
      id TEXT PRIMARY KEY,
      parent_order_id TEXT NOT NULL,
      sub_order_id TEXT NOT NULL,
      borrower_id TEXT NOT NULL,
      lender_id TEXT NOT NULL,
      total_deposit REAL NOT NULL,
      held_amount REAL NOT NULL,
      refunded_amount REAL DEFAULT 0,
      deducted_amount REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'HELD',
      timeline_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_order_id) REFERENCES orders(id),
      FOREIGN KEY (sub_order_id) REFERENCES sub_orders(id)
    );

    CREATE TABLE IF NOT EXISTS delivery_jobs (
      id TEXT PRIMARY KEY,
      sub_order_id TEXT NOT NULL,
      tracking_code TEXT NOT NULL,
      provider_name TEXT NOT NULL DEFAULT 'QuickShift Logistics',
      status TEXT NOT NULL DEFAULT 'ASSIGNED',
      pickup_address TEXT,
      delivery_address TEXT,
      proof_photo_url TEXT,
      estimated_delivery TEXT,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sub_order_id) REFERENCES sub_orders(id)
    );

    CREATE TABLE IF NOT EXISTS return_inspections (
      id TEXT PRIMARY KEY,
      sub_order_id TEXT NOT NULL,
      lender_id TEXT NOT NULL,
      borrower_id TEXT NOT NULL,
      inspected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      checklist_json TEXT NOT NULL,
      condition_grade TEXT NOT NULL,
      notes TEXT,
      proof_photos_json TEXT,
      proposed_deduction REAL DEFAULT 0,
      damage_reason TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      FOREIGN KEY (sub_order_id) REFERENCES sub_orders(id)
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      sub_order_id TEXT NOT NULL,
      borrower_id TEXT NOT NULL,
      lender_id TEXT NOT NULL,
      claim_amount REAL NOT NULL,
      dispute_reason TEXT NOT NULL,
      borrower_statement TEXT,
      admin_decision TEXT,
      resolved_deduction REAL DEFAULT 0,
      admin_notes TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (inspection_id) REFERENCES return_inspections(id),
      FOREIGN KEY (sub_order_id) REFERENCES sub_orders(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Ensure password column exists on users table
  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  if (!userColumns.some(c => c.name === 'password')) {
    db.exec(`ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT 'Pass@123'`);
  }
  // Ensure standard demo passwords
  db.prepare(`UPDATE users SET password = 'Admin@123' WHERE id = 'usr_admin'`).run();
  db.prepare(`UPDATE users SET password = 'Borrower@123' WHERE id = 'usr_borrower_1'`).run();
  db.prepare(`UPDATE users SET password = 'Lender@123' WHERE id IN ('usr_lender_1', 'usr_lender_2', 'usr_lender_3')`).run();

  seedData();
}

function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  console.log('Seeding 28 on-demand portable appliances (Hair Dryers, Vacuum Cleaners, Car Washers, Tools, etc)...');

  const users = [
    { id: 'usr_admin', name: 'Admin Officer', email: 'admin@rentappliances.com', password: 'Admin@123', role: 'admin', phone: '+91 98765 00000', city: 'Bengaluru', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
    { id: 'usr_borrower_1', name: 'Aarav Mehta', email: 'aarav@example.com', password: 'Borrower@123', role: 'borrower', phone: '+91 98123 45678', city: 'Indiranagar, Bengaluru', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
    { id: 'usr_lender_1', name: 'Rohit Sharma', email: 'rohit@example.com', password: 'Lender@123', role: 'lender', phone: '+91 98234 56789', city: 'Koramangala, Bengaluru', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80' },
    { id: 'usr_lender_2', name: 'Priya Nair', email: 'priya@example.com', password: 'Lender@123', role: 'lender', phone: '+91 98345 67890', city: 'HSR Layout, Bengaluru', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
    { id: 'usr_lender_3', name: 'Sunil Verma', email: 'sunil@example.com', password: 'Lender@123', role: 'lender', phone: '+91 98456 78901', city: 'Whitefield, Bengaluru', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80' },
  ];

  const insertUser = db.prepare('INSERT INTO users (id, name, email, password, role, phone, city, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const u of users) {
    insertUser.run(u.id, u.name, u.email, u.password || 'Pass@123', u.role, u.phone, u.city, u.avatar_url);
  }

  // 28 Portable & Utility Appliances
    const appliances = [
    // --- 1. PERSONAL GROOMING & STYLING ---
    {
      id: 'app_1',
      lender_id: 'usr_lender_1',
      title: 'Dyson Supersonic Ionic Professional Hair Dryer',
      category: 'Personal Grooming',
      brand: 'Dyson',
      description: 'Engineered for fast drying with intelligent heat control to protect natural shine. Features digital motor V9, negative ion technology to reduce static, and 5 magnetic styling attachments including Diffuser and Styling Concentrator.',
      condition: 'Like New (Mint Condition)',
      market_value: 38000,
      daily_rate: 250,
      weekly_rate: 1100,
      monthly_rate: 2600,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/614EeMiaM7L._SX466_.jpg',
        'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=800&q=80'
      ]),
      features_json: JSON.stringify(['V9 high-speed digital motor', 'Intelligent heat sensor 40x/sec', '5 magnetic styling nozzles', 'Acoustically tuned low noise']),
      rating: 4.9,
      total_reviews: 42
    },
    {
      id: 'app_2',
      lender_id: 'usr_lender_1',
      title: 'Shark FlexStyle 5-in-1 Air Styler & High-Velocity Dryer',
      category: 'Personal Grooming',
      brand: 'Shark',
      description: 'With a single twist, transforms from a powerful hair dryer to an ultra-versatile 5-in-1 styler. Uses Coanda air-wrap technology for bouncy curls without heat damage. Includes auto-wrap curlers and round volumizing brush.',
      condition: 'Excellent',
      market_value: 28000,
      daily_rate: 200,
      weekly_rate: 850,
      monthly_rate: 2100,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71eb8TlL3zL._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['Rotatable wand design', 'Coanda air curlers L/R', 'Zero extreme heat damage', 'Lightweight ergonomic body']),
      rating: 4.8,
      total_reviews: 19
    },
    {
      id: 'app_3',
      lender_id: 'usr_lender_2',
      title: 'Philips Prestige Pro Salon 2300W AC Motor Hair Dryer',
      category: 'Personal Grooming',
      brand: 'Philips',
      description: 'Heavy-duty 2300W salon-grade AC motor produces up to 130 km/h air velocity for 50% faster drying. Features 2x ionic conditioning for frizz-free glossy results and two ultra-narrow 6mm & 9mm styling nozzles.',
      condition: 'Like New',
      market_value: 8500,
      daily_rate: 90,
      weekly_rate: 380,
      monthly_rate: 950,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/61dNl92Y1jL._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['2300W high-performance AC motor', '130 km/h airspeed', 'Dual ionic conditioning', 'Cold shot lock-in']),
      rating: 4.7,
      total_reviews: 28
    },
    {
      id: 'app_4',
      lender_id: 'usr_lender_3',
      title: 'Homedics Shiatsu Deep-Kneading Heated Foot & Calf Massager',
      category: 'Personal Grooming',
      brand: 'Homedics',
      description: 'Full-coverage foot and calf massager equipped with deep-kneading shiatsu rollers and soothing infrared heat. Rejuvenates sore feet and relieves plantar fasciitis and work-related muscle tension.',
      condition: 'Like New',
      market_value: 15000,
      daily_rate: 140,
      weekly_rate: 590,
      monthly_rate: 1350,
      location: 'Whitefield Inner Circle, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/51XA1PpO43L._AC_SL1000_.jpg'
      ]),
      features_json: JSON.stringify(['Deep kneading shiatsu rollers', 'Soothing infrared heat', 'Adjustable angle tilt stand', 'Removable washable zip liners']),
      rating: 4.8,
      total_reviews: 15
    },

    // --- 2. CAR & OUTDOOR CLEANING (Pressure Washers) ---
    {
      id: 'app_5',
      lender_id: 'usr_lender_2',
      title: 'Kärcher K3 High-Pressure Car & Patio Washer (120 Bar)',
      category: 'Car & Outdoor Cleaning',
      brand: 'Kärcher',
      description: 'The industry-standard car washer with 120 bar water blast pressure. Includes Vario Power spray lance for adjustable pressure, Dirt Blaster turbo nozzle, foam cannon bottle for thick snow-foam car washing, and 6m pressure hose.',
      condition: 'Like New (Includes Car Shampoo Kit)',
      market_value: 14500,
      daily_rate: 220,
      weekly_rate: 900,
      monthly_rate: 2200,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/710L9+RQmLL._AC_SS450_.jpg',
        'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80'
      ]),
      features_json: JSON.stringify(['120 Bar max water pressure', 'Vario Power pressure adjustment', 'Snow foam cannon lance', 'Integrated detergent tank']),
      rating: 4.9,
      total_reviews: 54
    },
    {
      id: 'app_6',
      lender_id: 'usr_lender_1',
      title: 'Bosch EasyAquatak 120 High-Pressure Car Wash System',
      category: 'Car & Outdoor Cleaning',
      brand: 'Bosch',
      description: 'Compact 1500W all-metal motor pressure washer ideal for washing cars, SUVs, bikes, and driveways. Features a 3-in-1 fan jet, rotary pencil jet, high-pressure foam bottle, and 5-meter hose with quick-connect fittings.',
      condition: 'Excellent',
      market_value: 11500,
      daily_rate: 180,
      weekly_rate: 750,
      monthly_rate: 1800,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/S/aplus-media/vc/297fe6d0-2202-4fb5-8bc9-bbefcb4950be.__CR0,0,1464,600_PT0_SX1464_V1___.png'
      ]),
      features_json: JSON.stringify(['120 Bar all-metal pump', '3-in-1 rotary and fan nozzle', 'High-pressure foam detergent gun', 'Auto-stop system']),
      rating: 4.7,
      total_reviews: 31
    },
    {
      id: 'app_7',
      lender_id: 'usr_lender_3',
      title: 'Black+Decker BXPW1600E 125-Bar Heavy Duty Car Pressure Washer',
      category: 'Car & Outdoor Cleaning',
      brand: 'Black+Decker',
      description: '1600W power washer engineered for rapid vehicle detailing and patio restoration. Delivers 420 liters/hour water flow at 125 bar pressure with click-fast lance connection and rotating turbo wash head.',
      condition: 'Good',
      market_value: 10500,
      daily_rate: 160,
      weekly_rate: 680,
      monthly_rate: 1600,
      location: 'Whitefield Inner Circle, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/41SMKcMzLzL.jpg'
      ]),
      features_json: JSON.stringify(['125 Bar water blast pressure', '420 L/hr maximum flow', 'Rotary turbo nozzle', 'Total stop safety system']),
      rating: 4.6,
      total_reviews: 22
    },
    {
      id: 'app_8',
      lender_id: 'usr_lender_2',
      title: 'Bosch UniversalGardenTidy 1800W Leaf Blower & Lawn Vacuum',
      category: 'Car & Outdoor Cleaning',
      brand: 'Bosch',
      description: 'Versatile 3-in-1 electric outdoor maintenance tool for blowing, vacuuming, and shredding dry or wet leaves and garden debris. Features 285 km/h variable air speed and 12:1 metal shredding impellor.',
      condition: 'Like New',
      market_value: 11800,
      daily_rate: 150,
      weekly_rate: 620,
      monthly_rate: 1450,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71vTYg9QZ-L._AC_SX679_.jpg'
      ]),
      features_json: JSON.stringify(['1800W variable speed motor', '285 km/h blowing velocity', '45L debris collection bag', 'Integrated metal shredder 12:1']),
      rating: 4.8,
      total_reviews: 14
    },

    // --- 3. VACUUM CLEANERS & FLOORCARE ---
    {
      id: 'app_9',
      lender_id: 'usr_lender_1',
      title: 'Dyson V12 Detect Slim Total Clean Cordless Vacuum',
      category: 'Vacuum & Floorcare',
      brand: 'Dyson',
      description: 'Ultra-lightweight cordless stick vacuum with a precisely-angled laser that reveals invisible dust on hard floors. Acoustic piezo sensor counts particles and automatically increases suction power. Includes anti-tangle Hair Screw tool.',
      condition: 'Like New (Sanitized & Serviced)',
      market_value: 49000,
      daily_rate: 320,
      weekly_rate: 1450,
      monthly_rate: 3500,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/61nenVBHu+L._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['Laser dust detection', 'Piezo particle counter LCD', 'Anti-tangle Hair Screw tool', 'Whole-machine HEPA filtration']),
      rating: 4.9,
      total_reviews: 63
    },
    {
      id: 'app_10',
      lender_id: 'usr_lender_2',
      title: 'Bissell SpotClean Pro Portable Carpet & Sofa Washer',
      category: 'Vacuum & Floorcare',
      brand: 'Bissell',
      description: 'The gold standard in portable deep stain extraction. Combines powerful motorized suction, pressurized cleaning spray, and scrubbing brushes to permanently erase stains from sofas, car seats, mattresses, and rugs.',
      condition: 'Like New (Includes Cleaning Solution)',
      market_value: 24000,
      daily_rate: 250,
      weekly_rate: 1050,
      monthly_rate: 2400,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71PAzA-FKIL._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['Deep stain extraction spray', 'Dual clean/dirty water tanks', 'Tough stain brush head', 'Heatwave water technology']),
      rating: 4.9,
      total_reviews: 38
    },
    {
      id: 'app_11',
      lender_id: 'usr_lender_3',
      title: 'Eureka Forbes Bold Wet & Dry Heavy Duty Vacuum Cleaner (1400W)',
      category: 'Vacuum & Floorcare',
      brand: 'Eureka Forbes',
      description: 'Heavy duty 1400W industrial-grade vacuum cleaner with wet liquid absorption and dry dust suction. Features massive 16-liter impact-proof drum and high-velocity blower function for post-renovation or deep house cleaning.',
      condition: 'Excellent',
      market_value: 9500,
      daily_rate: 120,
      weekly_rate: 520,
      monthly_rate: 1250,
      location: 'Whitefield Inner Circle, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/61R47KdVbjL.jpg'
      ]),
      features_json: JSON.stringify(['1400W dual wet & dry motor', '16L capacity steel drum', 'High-pressure blower function', '360 degree castor wheels']),
      rating: 4.7,
      total_reviews: 29
    },
    {
      id: 'app_12',
      lender_id: 'usr_lender_1',
      title: 'Kärcher WD3 Multi-Purpose Workshop Wet & Dry Vacuum',
      category: 'Vacuum & Floorcare',
      brand: 'Kärcher',
      description: 'Super-powerful yet energy-efficient wet and dry vacuum with a 17-liter robust plastic container. Special cartridge filter allows wet and dry suction without changing filters. Includes blower mode and crevice tool.',
      condition: 'Good',
      market_value: 8900,
      daily_rate: 110,
      weekly_rate: 490,
      monthly_rate: 1180,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/51A2PKY6MkL._SL1080_.jpg'
      ]),
      features_json: JSON.stringify(['17L impact-resistant tank', 'Single cartridge wet/dry filter', 'Integrated blower port', 'Ergonomic pull handle']),
      rating: 4.6,
      total_reviews: 20
    },
    {
      id: 'app_13',
      lender_id: 'usr_lender_2',
      title: 'Dreame D10s Pro Smart LiDAR Robot Vacuum & Auto-Mop',
      category: 'Vacuum & Floorcare',
      brand: 'Dreame',
      description: 'Automated hands-free floor cleaning with 5000Pa immense suction and AI obstacle avoidance. Uses high-precision LiDAR laser navigation to map apartments and seamlessly mop tiles and vacuum carpets in one pass.',
      condition: 'Like New',
      market_value: 32000,
      daily_rate: 220,
      weekly_rate: 950,
      monthly_rate: 2300,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71Swy0K6JDL._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['5000Pa extreme suction', 'LiDAR LDS room mapping', 'Electronically controlled mop', '280 min long-life battery']),
      rating: 4.8,
      total_reviews: 24
    },

    // --- 4. GARMENT & FABRIC CARE ---
    {
      id: 'app_14',
      lender_id: 'usr_lender_3',
      title: 'Philips ComfortTouch Advanced Stand Garment Steamer',
      category: 'Garment & Fabric Care',
      brand: 'Philips',
      description: 'Professional upright clothes steamer equipped with FlexHead and extra-long StyleBoard support. Produces 40g/min continuous high-temperature steam that penetrates fabrics to eliminate creases and de-odorize garments without burning.',
      condition: 'Like New',
      market_value: 12500,
      daily_rate: 140,
      weekly_rate: 580,
      monthly_rate: 1400,
      location: 'Whitefield Inner Circle, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/S/aplus-media-library-service-media/433f1c1b-7fb4-4bbe-bf10-bbbb5a84797e.__CR0,0,970,600_PT0_SX970_V1___.jpg'
      ]),
      features_json: JSON.stringify(['2000W heating element', '40g/min continuous steam', 'FlexHead ergonomic head', 'Safe on silk, wool & cashmere']),
      rating: 4.8,
      total_reviews: 32
    },
    {
      id: 'app_15',
      lender_id: 'usr_lender_1',
      title: 'Black+Decker 1600W Handheld Travel Garment Steamer',
      category: 'Garment & Fabric Care',
      brand: 'Black+Decker',
      description: 'Compact 1600W handheld fabric steamer heats up in just 35 seconds. Features ceramic steam plate, continuous steam trigger lock, and anti-calc system. Perfect for wedding attire, formal suits, and travel touch-ups.',
      condition: 'Excellent',
      market_value: 4800,
      daily_rate: 70,
      weekly_rate: 290,
      monthly_rate: 700,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/61pH8eJKx9S._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['Rapid 35s instant steam', 'Continuous lock trigger', 'Ceramic coated heating plate', 'Lint remover brush attachment']),
      rating: 4.7,
      total_reviews: 18
    },
    {
      id: 'app_16',
      lender_id: 'usr_lender_2',
      title: 'Singer Heavy Duty 4423 Mechanical Sewing Machine',
      category: 'Garment & Fabric Care',
      brand: 'Singer',
      description: 'Engineered with a heavy-duty stainless steel bedplate and powerful motor producing 1,100 stitches per minute. Handles denim, canvas, upholstery, and leather with ease. Comes with 23 built-in stitch patterns.',
      condition: 'Excellent',
      market_value: 21000,
      daily_rate: 180,
      weekly_rate: 750,
      monthly_rate: 1800,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/61fH5jawTLL._AC_.jpg'
      ]),
      features_json: JSON.stringify(['1100 stitches/min high speed', '23 built-in stitches', 'Stainless steel bedplate', 'Automatic 1-step buttonhole']),
      rating: 4.9,
      total_reviews: 27
    },

    // --- 5. KITCHEN APPLIANCES & GOURMET GADGETS ---
    {
      id: 'app_17',
      lender_id: 'usr_lender_1',
      title: "De'Longhi Dedica Deluxe Pump Espresso & Cappuccino Maker",
      category: 'Kitchen Appliances',
      brand: "De'Longhi",
      description: 'Professional 15-bar Italian espresso pump in a slim 6-inch stainless steel chassis. Fast 40-second thermoblock heating and manual Panarello steam wand for authentic velvety lattes, cappuccinos, and espresso shots.',
      condition: 'Like New (Includes Tamper & Portafilter)',
      market_value: 26000,
      daily_rate: 220,
      weekly_rate: 920,
      monthly_rate: 2200,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/61ZhjaVsE5L.jpg'
      ]),
      features_json: JSON.stringify(['15-bar professional pump', 'Thermoblock fast heating', 'Panarello milk frother', 'Ultra-compact 6-inch body']),
      rating: 4.9,
      total_reviews: 48
    },
    {
      id: 'app_18',
      lender_id: 'usr_lender_2',
      title: 'Philips Digital Airfryer XXL with Rapid Air Technology (7.3L)',
      category: 'Kitchen Appliances',
      brand: 'Philips',
      description: 'Extra-large 7.3L capacity air fryer with Twin TurboStar technology that captures excess rendered fat. Cooks family-sized meals, french fries, chicken wings, and baked desserts with up to 90% less oil.',
      condition: 'Like New',
      market_value: 18500,
      daily_rate: 150,
      weekly_rate: 650,
      monthly_rate: 1550,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/615cz-ER2VL._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['7.3L XXL family basket', 'Twin TurboStar fat removal', '5 one-touch preset menus', 'QuickClean non-stick basket']),
      rating: 4.8,
      total_reviews: 36
    },
    {
      id: 'app_19',
      lender_id: 'usr_lender_3',
      title: 'Nutribullet Pro 900W High-Speed Nutrient Extractor Blender',
      category: 'Kitchen Appliances',
      brand: 'Nutribullet',
      description: 'Compact 900W motor with cyclonic action and specialized stainless steel extractor blades that pulverize hard seeds, nuts, whole fruits, and greens into silky smooth nutrient-dense smoothies in 60 seconds.',
      condition: 'Excellent',
      market_value: 7500,
      daily_rate: 80,
      weekly_rate: 350,
      monthly_rate: 820,
      location: 'Whitefield Inner Circle, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71m9FMl99uL._AC_.jpg'
      ]),
      features_json: JSON.stringify(['900W cyclonic extractor motor', 'Stainless steel nutrient blade', '2x BPA-free colossal cups', 'To-go sip lids included']),
      rating: 4.7,
      total_reviews: 19
    },
    {
      id: 'app_20',
      lender_id: 'usr_lender_1',
      title: 'Instant Pot Duo 7-in-1 Smart Electric Multi-Cooker (6 Quart)',
      category: 'Kitchen Appliances',
      brand: 'Instant Pot',
      description: 'Replaces 7 everyday kitchen appliances: pressure cooker, slow cooker, rice cooker, steamer, sauté pan, yogurt maker, and warmer. Cooks stews, biryanis, and curries up to 70% faster with 10+ safety certifications.',
      condition: 'Like New',
      market_value: 11000,
      daily_rate: 120,
      weekly_rate: 490,
      monthly_rate: 1190,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71V1LrY1MSL._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['7-in-1 versatile cooking', '13 one-touch smart programs', 'Food-grade stainless steel pot', 'Advanced safety lid lock']),
      rating: 4.9,
      total_reviews: 31
    },
    {
      id: 'app_21',
      lender_id: 'usr_lender_2',
      title: 'Cuisinart 2-Quart Automatic Frozen Yogurt & Ice Cream Maker',
      category: 'Kitchen Appliances',
      brand: 'Cuisinart',
      description: 'Commercial quality dessert churner makes 2 quarts of artisan gelato, frozen yogurt, or fruit sorbet in just 25 minutes. Features heavy-duty motor, double-insulated freezer bowl, and large ingredient pouring funnel.',
      condition: 'Like New',
      market_value: 13000,
      daily_rate: 140,
      weekly_rate: 580,
      monthly_rate: 1350,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71TVQQkpGzL._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['2-Quart bowl capacity', 'Ready in 25 minutes', 'Double-insulated freezer core', 'Large ingredient mix spout']),
      rating: 4.8,
      total_reviews: 17
    },

    // --- 6. DIY & POWER TOOLS ---
    {
      id: 'app_22',
      lender_id: 'usr_lender_3',
      title: 'Bosch GSB 500W Impact Drill & 100-Piece Home Tool Kit',
      category: 'DIY & Power Tools',
      brand: 'Bosch',
      description: 'Reversible 500W impact drill with dual drilling and hammer modes for concrete, masonry, wood, and metal. Includes robust contractor case filled with 100 accessories: drill bits, screws, anchors, claw hammer, pliers, and tape measure.',
      condition: 'Excellent',
      market_value: 6500,
      daily_rate: 90,
      weekly_rate: 380,
      monthly_rate: 850,
      location: 'Whitefield Inner Circle, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71rDK+hDmHL._AC_.jpg'
      ]),
      features_json: JSON.stringify(['500W forward/reverse drill', 'Hammer impact mechanism', '100-piece accessory kit', 'Heavy duty storage case']),
      rating: 4.7,
      total_reviews: 23
    },
    {
      id: 'app_23',
      lender_id: 'usr_lender_1',
      title: 'DeWalt 20V MAX Cordless Drill Driver Kit with 2 Batteries',
      category: 'DIY & Power Tools',
      brand: 'DeWalt',
      description: 'Heavy duty high-performance 20V MAX cordless drill driver with 2-speed transmission (0-450 & 0-1,500 RPM). Compact and lightweight for tight spaces. Includes 2x 20V Lithium-ion batteries, fast charger, and heavy-duty tool bag.',
      condition: 'Like New',
      market_value: 16500,
      daily_rate: 170,
      weekly_rate: 720,
      monthly_rate: 1700,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/715+r4lU6mL._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['20V Max cordless motor', '2x Lithium-ion batteries', '16 clutch torque settings', 'Bright LED work spotlight']),
      rating: 4.9,
      total_reviews: 35
    },
    {
      id: 'app_24',
      lender_id: 'usr_lender_2',
      title: 'Wagner Control Pro 150 High-Efficiency Airless Paint Sprayer',
      category: 'DIY & Power Tools',
      brand: 'Wagner',
      description: 'Professional High Efficiency Airless (HEA) spray system that reduces paint overspray by up to 55%. Draws paint directly from a 20-liter bucket. Perfect for painting interior walls, wooden fences, exterior siding, and furniture in minutes.',
      condition: 'Excellent',
      market_value: 29000,
      daily_rate: 280,
      weekly_rate: 1200,
      monthly_rate: 2800,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71fl8ypsIZL._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['55% less overspray HEA', 'Draws direct from paint can', '7.5m high-pressure hose', 'Covers 15m² in 2 minutes']),
      rating: 4.8,
      total_reviews: 16
    },
    {
      id: 'app_25',
      lender_id: 'usr_lender_3',
      title: 'EcoFlow River 2 Max 512Wh Portable Power Station',
      category: 'DIY & Power Tools',
      brand: 'EcoFlow',
      description: '512Wh premium LiFePO4 battery pack designed for 3,000+ full charge cycles. Ultra-fast 60-minute wall charge from 0 to 100%. Delivers 512W AC output (X-Boost up to 1000W) to power power tools, laptops, lights, and appliances on outdoor jobs.',
      condition: 'Like New',
      market_value: 42000,
      daily_rate: 320,
      weekly_rate: 1400,
      monthly_rate: 3200,
      location: 'Whitefield Inner Circle, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/61niNUcXG3L._AC_SL1500_.jpg'
      ]),
      features_json: JSON.stringify(['512Wh LiFePO4 battery', '60-minute ultra fast recharge', '512W AC output / 1000W boost', 'Smart app Bluetooth/WiFi']),
      rating: 4.9,
      total_reviews: 21
    },

    // --- 7. ENTERTAINMENT & GADGETS ---
    {
      id: 'app_26',
      lender_id: 'usr_lender_1',
      title: 'XGIMI MoGo 2 Portable Smart Movie Projector with Dual Speakers',
      category: 'Entertainment & Gadgets',
      brand: 'XGIMI',
      description: 'Compact 400 ISO lumens DLP cinema projector with official Android TV 11 and Google Play built-in. Delivers up to 120-inch 1080p display with instant autofocus, automatic obstacle avoidance, and dual 8W Harman Kardon speakers.',
      condition: 'Like New (With Carrying Case & Tripod)',
      market_value: 39000,
      daily_rate: 300,
      weekly_rate: 1300,
      monthly_rate: 3200,
      location: 'Koramangala 4th Block, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/619NJGBXTvL.jpg'
      ]),
      features_json: JSON.stringify(['400 ISO Lumens DLP display', 'Intelligent autofocus & keystone', 'Dual 8W Harman Kardon audio', 'Built-in Android TV 11']),
      rating: 4.9,
      total_reviews: 44
    },
    {
      id: 'app_27',
      lender_id: 'usr_lender_2',
      title: 'JBL PartyBox 110 Portable Bluetooth Party Speaker with RGB Lights',
      category: 'Entertainment & Gadgets',
      brand: 'JBL',
      description: 'Powerful 160-Watt portable wireless party boombox with deep adjustable bass and dynamic beat-synced RGB LED light show. Features guitar and microphone plug-in inputs, splashproof IPX4 design, and 12-hour rechargeable battery.',
      condition: 'Excellent',
      market_value: 31000,
      daily_rate: 260,
      weekly_rate: 1100,
      monthly_rate: 2600,
      location: 'HSR Layout Sector 2, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/71JPYKaBE9L._AC_SL1001_.jpg'
      ]),
      features_json: JSON.stringify(['160W JBL Original Pro Sound', 'Dynamic beat-synced light show', 'Guitar and microphone inputs', '12-hour rechargeable battery']),
      rating: 4.8,
      total_reviews: 39
    },
    {
      id: 'app_28',
      lender_id: 'usr_lender_3',
      title: 'DJI Mini 2 SE Ultralight 4K Gimbal Drone Kit',
      category: 'Entertainment & Gadgets',
      brand: 'DJI',
      description: 'Ultralight folding drone weighing under 249 grams with 3-axis motorized gimbal for silky smooth aerial video. Features 10km HD video transmission, 31-minute maximum flight time per battery, and Level 5 wind resistance. Includes 2 spare batteries.',
      condition: 'Like New (Includes 2 Spare Batteries)',
      market_value: 36000,
      daily_rate: 350,
      weekly_rate: 1500,
      monthly_rate: 3400,
      location: 'Whitefield Inner Circle, Bengaluru',
      images_json: JSON.stringify([
        'https://m.media-amazon.com/images/I/519adnodmCS._AC_SL1409_.jpg'
      ]),
      features_json: JSON.stringify(['Sub-249g ultra-lightweight', '3-axis motorized gimbal camera', '10km HD video transmission', '31 mins flight time per pack']),
      rating: 4.9,
      total_reviews: 47
    }
  ];

  const insertApp = db.prepare(`
    INSERT INTO appliances (
      id, lender_id, title, category, brand, description, condition,
      market_value, daily_rate, weekly_rate, monthly_rate, deposit_amount,
      commission_rate, location, images_json, features_json, rating, total_reviews
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const a of appliances) {
    const deposit = a.market_value * 0.20; // 20% Deposit Rule per NFR
    insertApp.run(
      a.id, a.lender_id, a.title, a.category, a.brand, a.description, a.condition,
      a.market_value, a.daily_rate, a.weekly_rate, a.monthly_rate, deposit,
      0.15, a.location, a.images_json, a.features_json, a.rating, a.total_reviews
    );
  }

  // Pre-seed sample active order with on-demand items (Dyson Hair Dryer + Kärcher Car Washer)
  const orderId = 'ord_sample_101';
  const orderNumber = 'ORD-2026-8841';
  const app1 = appliances[0]; // Dyson Hair Dryer (Lender 1)
  const app5 = appliances[4]; // Kärcher Car Washer (Lender 2)
  
  const item1Rent = app1.monthly_rate * 1;
  const item1Comm = app1.market_value * 0.15;
  const item1Dep = app1.market_value * 0.20;

  const item2Rent = app5.monthly_rate * 1;
  const item2Comm = app5.market_value * 0.15;
  const item2Dep = app5.market_value * 0.20;

  const totalRent = item1Rent + item2Rent;
  const totalComm = item1Comm + item2Comm;
  const totalDep = item1Dep + item2Dep;
  const deliveryFee = 700; // 350 per lender hub
  const grandTotal = totalRent + totalComm + totalDep + deliveryFee;

  db.prepare(`
    INSERT INTO orders (
      id, order_number, borrower_id, total_rent, total_commission,
      total_deposit, delivery_fee, grand_total, payment_status,
      payment_method, gateway_txn_id, shipping_address_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 'Razorpay UPI', 'pay_mock_99214', ?)
  `).run(
    orderId, orderNumber, 'usr_borrower_1', totalRent, totalComm,
    totalDep, deliveryFee, grandTotal,
    JSON.stringify({ street: 'Flat 402, Green Glen Apartments, Outer Ring Rd', city: 'Bengaluru', pincode: '560103' })
  );

  // Sub Order 1 (Lender 1 - Dyson Hair Dryer)
  const sub1Id = 'sub_ord_101_1';
  db.prepare(`
    INSERT INTO sub_orders (id, parent_order_id, lender_id, status, rent_subtotal, commission_subtotal, deposit_subtotal, delivery_fee, tracking_number)
    VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, 350, 'QS-LND1-77821')
  `).run(sub1Id, orderId, 'usr_lender_1', item1Rent, item1Comm, item1Dep);

  db.prepare(`
    INSERT INTO order_items (id, sub_order_id, parent_order_id, appliance_id, plan, duration, start_date, end_date, rent_amount, commission_amount, deposit_amount, market_value)
    VALUES (?, ?, ?, ?, 'monthly', 1, '2026-10-15', '2026-11-15', ?, ?, ?, ?)
  `).run('item_101_1', sub1Id, orderId, app1.id, item1Rent, item1Comm, item1Dep, app1.market_value);

  db.prepare(`
    INSERT INTO deposit_ledger (id, parent_order_id, sub_order_id, borrower_id, lender_id, total_deposit, held_amount, status, timeline_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'HELD', ?)
  `).run(
    'dep_led_101_1', orderId, sub1Id, 'usr_borrower_1', 'usr_lender_1', item1Dep, item1Dep,
    JSON.stringify([
      { time: '2026-10-13 14:30', event: 'Deposit collected via Razorpay', amount: item1Dep, balance: item1Dep, status: 'HELD' }
    ])
  );

  db.prepare(`
    INSERT INTO delivery_jobs (id, sub_order_id, tracking_code, provider_name, status, pickup_address, delivery_address, notes)
    VALUES (?, ?, 'QS-LND1-77821', 'QuickShift Express', 'DELIVERED', 'Koramangala 4th Block', 'Green Glen, Outer Ring Rd', 'Delivered & verified with OTP')
  `).run('del_job_101_1', sub1Id);

  // Sub Order 2 (Lender 2 - Kärcher Car Washer - returned with minor nozzle check)
  const sub2Id = 'sub_ord_101_2';
  db.prepare(`
    INSERT INTO sub_orders (id, parent_order_id, lender_id, status, rent_subtotal, commission_subtotal, deposit_subtotal, delivery_fee, tracking_number)
    VALUES (?, ?, ?, 'RETURN_INSPECTED', ?, ?, ?, 350, 'QS-LND2-99014')
  `).run(sub2Id, orderId, 'usr_lender_2', item2Rent, item2Comm, item2Dep);

  db.prepare(`
    INSERT INTO order_items (id, sub_order_id, parent_order_id, appliance_id, plan, duration, start_date, end_date, rent_amount, commission_amount, deposit_amount, market_value)
    VALUES (?, ?, ?, ?, 'monthly', 1, '2026-09-10', '2026-10-10', ?, ?, ?, ?)
  `).run('item_101_2', sub2Id, orderId, app5.id, item2Rent, item2Comm, item2Dep, app5.market_value);

  // Deposit ledger with dispute workflow sample
  db.prepare(`
    INSERT INTO deposit_ledger (id, parent_order_id, sub_order_id, borrower_id, lender_id, total_deposit, held_amount, refunded_amount, deducted_amount, status, timeline_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISPUTED', ?)
  `).run(
    'dep_led_101_2', orderId, sub2Id, 'usr_borrower_1', 'usr_lender_2', item2Dep,
    600, // held in escrow for dispute
    item2Dep - 600, // undisputed part already refunded
    0,
    JSON.stringify([
      { time: '2026-09-10 10:00', event: 'Initial 20% deposit held (Rs ' + item2Dep.toLocaleString() + ')', amount: item2Dep, balance: item2Dep, status: 'HELD' },
      { time: '2026-10-12 11:30', event: 'Return inspection by Lender: Minor foam cannon seal leak claimed (Rs 600)', amount: 600, balance: item2Dep, status: 'CLAIMED' },
      { time: '2026-10-12 14:00', event: 'Undisputed deposit balance refunded to Borrower: Rs ' + (item2Dep - 600).toLocaleString(), amount: item2Dep - 600, balance: 600, status: 'PARTIALLY_REFUNDED' },
      { time: '2026-10-12 16:45', event: 'Borrower submitted dispute on Rs 600 claim; Escrow frozen for Admin review', amount: 600, balance: 600, status: 'DISPUTED' }
    ])
  );

  const inspId = 'insp_101_2';
  db.prepare(`
    INSERT INTO return_inspections (
      id, sub_order_id, lender_id, borrower_id, checklist_json, condition_grade, notes, proof_photos_json, proposed_deduction, damage_reason, status
    ) VALUES (?, ?, ?, ?, ?, 'Minor Damage', 'Foam cannon quick-connector O-ring missing.', ?, 600, 'Missing O-ring seal', 'DISPUTED')
  `).run(
    inspId, sub2Id, 'usr_lender_2', 'usr_borrower_1',
    JSON.stringify([
      { item: 'Motor Pump Pressure Test (120 Bar)', passed: true, note: 'Tested 120 bar working' },
      { item: 'Spray Lance & Trigger Gun', passed: true, note: 'No leaks on main lance' },
      { item: 'Foam Cannon Quick-Connector', passed: false, note: 'O-ring missing causing slight water drip' },
      { item: 'Power Cable & Waterproof Switch', passed: true, note: 'Original intact' }
    ]),
    JSON.stringify(['https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=600&q=80'])
  );

  db.prepare(`
    INSERT INTO disputes (
      id, inspection_id, sub_order_id, borrower_id, lender_id, claim_amount, dispute_reason, borrower_statement, status
    ) VALUES (?, ?, ?, ?, ?, 600, 'Normal Wear / Pre-existing', 'The rubber O-ring was already cracked when delivered. Car washer worked fine.', 'OPEN')
  `).run('disp_101_2', inspId, sub2Id, 'usr_borrower_1', 'usr_lender_2');

  db.prepare(`
    INSERT INTO delivery_jobs (id, sub_order_id, tracking_code, provider_name, status, pickup_address, delivery_address, notes)
    VALUES (?, ?, 'QS-LND2-99014', 'QuickShift Express', 'RETURNED', 'Green Glen, Outer Ring Rd', 'HSR Layout Sector 2', 'Picked up from borrower and returned to lender')
  `).run('del_job_101_2', sub2Id);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details_json)
    VALUES (?, 'usr_borrower_1', 'Aarav Mehta', 'borrower', 'SUBMIT_DISPUTE', 'dispute', 'disp_101_2', ?)
  `).run('aud_1', JSON.stringify({ amount: 600, reason: 'Normal Wear / Pre-existing' }));

  console.log('Seeding of 28 appliances completed successfully.');
}

export { db };
