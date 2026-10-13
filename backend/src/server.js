import express from 'express';
import cors from 'cors';
import { db, initDatabase } from './db.js';

initDatabase();

const app = express();
app.use(cors());
app.use(express.json());

// --- AUTHENTICATION & SESSIONS ---
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    city: user.city,
    avatar_url: user.avatar_url,
    created_at: user.created_at
  };

  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details_json)
    VALUES (?, ?, ?, ?, 'USER_LOGIN', 'user', ?, ?)
  `).run(`aud_${Date.now()}`, user.id, user.name, user.role, user.id, JSON.stringify({ email: user.email }));

  res.json({
    message: 'Login successful',
    user: safeUser,
    token: `token_${user.id}_${Date.now()}`
  });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role = 'borrower', phone = '', city = 'Bengaluru' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email address already exists' });
  }

  const newId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const avatarUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

  db.prepare(`
    INSERT INTO users (id, name, email, password, role, phone, city, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(newId, name.trim(), email.trim().toLowerCase(), password, role, phone, city, avatarUrl);

  const safeUser = {
    id: newId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    phone,
    city,
    avatar_url: avatarUrl
  };

  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details_json)
    VALUES (?, ?, ?, ?, 'USER_REGISTER', 'user', ?, ?)
  `).run(`aud_${Date.now()}`, newId, name, role, newId, JSON.stringify({ email }));

  res.status(201).json({
    message: 'Account created successfully',
    user: safeUser,
    token: `token_${newId}_${Date.now()}`
  });
});

app.get('/api/auth/me', (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  const user = db.prepare('SELECT id, name, email, role, phone, city, avatar_url, created_at FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// --- USERS & PERSONAS ---
app.get('/api/users', (req, res) => {
  const users = db.prepare(`SELECT * FROM users`).all();
  res.json(users);
});

// --- APPLIANCES & CATALOG ---
app.get('/api/appliances', (req, res) => {
  const { category, search, minPrice, maxPrice, lenderId } = req.query;
  let sql = `
    SELECT a.*, u.name as lender_name, u.avatar_url as lender_avatar, u.city as lender_city
    FROM appliances a
    JOIN users u ON a.lender_id = u.id
    WHERE a.status = 'active'
  `;
  const params = [];

  if (category && category !== 'All') {
    sql += ' AND a.category = ?';
    params.push(category);
  }
  if (lenderId) {
    sql += ' AND a.lender_id = ?';
    params.push(lenderId);
  }
  if (search) {
    sql += ' AND (a.title LIKE ? OR a.brand LIKE ? OR a.description LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (minPrice) {
    sql += ' AND a.monthly_rate >= ?';
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    sql += ' AND a.monthly_rate <= ?';
    params.push(Number(maxPrice));
  }

  sql += ' ORDER BY a.created_at DESC';

  const rows = db.prepare(sql).all(...params);
  const formatted = rows.map(r => ({
    ...r,
    images: JSON.parse(r.images_json || '[]'),
    features: JSON.parse(r.features_json || '[]')
  }));
  res.json(formatted);
});

app.get('/api/appliances/:id', (req, res) => {
  const row = db.prepare(`
    SELECT a.*, u.name as lender_name, u.email as lender_email, u.phone as lender_phone, u.avatar_url as lender_avatar, u.city as lender_city
    FROM appliances a
    JOIN users u ON a.lender_id = u.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Appliance not found' });

  const formatted = {
    ...row,
    images: JSON.parse(row.images_json || '[]'),
    features: JSON.parse(row.features_json || '[]'),
    // Transparent calculations per NFR
    calculated_commission: row.market_value * 0.15,
    calculated_deposit: row.market_value * 0.20
  };
  res.json(formatted);
});

app.post('/api/appliances', (req, res) => {
  const {
    lender_id, title, category, brand, description, condition,
    market_value, daily_rate, weekly_rate, monthly_rate, location,
    images, features
  } = req.body;

  if (!title || !market_value || !monthly_rate || !lender_id) {
    return res.status(400).json({ error: 'Missing required listing fields' });
  }

  const id = `app_${Date.now()}`;
  const deposit = Number(market_value) * 0.20; // 20% Rule

  db.prepare(`
    INSERT INTO appliances (
      id, lender_id, title, category, brand, description, condition,
      market_value, daily_rate, weekly_rate, monthly_rate, deposit_amount,
      commission_rate, location, images_json, features_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.15, ?, ?, ?)
  `).run(
    id, lender_id, title, category || 'Appliances', brand || 'Standard',
    description || '', condition || 'Good', Number(market_value),
    Number(daily_rate || Math.round(monthly_rate / 15)),
    Number(weekly_rate || Math.round(monthly_rate / 3)),
    Number(monthly_rate), deposit, location || 'Bengaluru',
    JSON.stringify(images && images.length ? images : ['https://m.media-amazon.com/images/I/619NJGBXTvL.jpg']),
    JSON.stringify(features || [])
  );

  res.status(201).json({ id, message: 'Appliance listed successfully' });
});

// --- PRICING & CART CALCULATION ENGINE ---
app.post('/api/calculate', (req, res) => {
  const { items } = req.body;
  if (!items || !items.length) {
    return res.json({
      items: [],
      subOrdersPreview: [],
      summary: { totalRent: 0, totalCommission: 0, totalDeposit: 0, deliveryFee: 0, grandTotal: 0 }
    });
  }

  const computedItems = [];
  const lenderMap = new Map();

  for (const item of items) {
    const appliance = db.prepare(`SELECT * FROM appliances WHERE id = ?`).get(item.appliance_id);
    if (!appliance) continue;

    const duration = Number(item.duration) || 1;
    const plan = item.plan || 'monthly';
    let unitRate = appliance.monthly_rate;
    if (plan === 'daily') unitRate = appliance.daily_rate;
    if (plan === 'weekly') unitRate = appliance.weekly_rate;

    const itemRent = unitRate * duration;
    // NFR Rule: Commission = Fixed 15% of Market Value
    const itemCommission = appliance.market_value * 0.15;
    // NFR Rule: Security Deposit = Fixed 20% of Market Value
    const itemDeposit = appliance.market_value * 0.20;

    const computed = {
      appliance_id: appliance.id,
      title: appliance.title,
      category: appliance.category,
      brand: appliance.brand,
      lender_id: appliance.lender_id,
      market_value: appliance.market_value,
      plan,
      duration,
      unit_rate: unitRate,
      rent_amount: itemRent,
      commission_amount: itemCommission,
      deposit_amount: itemDeposit,
      image: JSON.parse(appliance.images_json || '[]')[0] || ''
    };
    computedItems.push(computed);

    if (!lenderMap.has(appliance.lender_id)) {
      const lenderUser = db.prepare(`SELECT id, name, city FROM users WHERE id = ?`).get(appliance.lender_id);
      lenderMap.set(appliance.lender_id, {
        lender: lenderUser,
        items: [],
        rentSubtotal: 0,
        commissionSubtotal: 0,
        depositSubtotal: 0,
        deliveryFee: 350 // Rs 350 per distinct lender logistics batch
      });
    }

    const lenderGroup = lenderMap.get(appliance.lender_id);
    lenderGroup.items.push(computed);
    lenderGroup.rentSubtotal += itemRent;
    lenderGroup.commissionSubtotal += itemCommission;
    lenderGroup.depositSubtotal += itemDeposit;
  }

  const subOrdersPreview = Array.from(lenderMap.values());
  const totalRent = computedItems.reduce((acc, i) => acc + i.rent_amount, 0);
  const totalCommission = computedItems.reduce((acc, i) => acc + i.commission_amount, 0);
  const totalDeposit = computedItems.reduce((acc, i) => acc + i.deposit_amount, 0);
  const deliveryFee = subOrdersPreview.reduce((acc, l) => acc + l.deliveryFee, 0);
  const grandTotal = totalRent + totalCommission + totalDeposit + deliveryFee;

  res.json({
    items: computedItems,
    subOrdersPreview,
    summary: {
      totalRent,
      totalCommission,
      totalDeposit,
      deliveryFee,
      grandTotal,
      notes: {
        commissionRule: '15% of product market value per item',
        depositRule: '20% refundable deposit of product market value',
        logisticsRule: 'Rs 350 per lender origin hub'
      }
    }
  });
});

// --- CHECKOUT & ORDER CREATION ---
app.post('/api/checkout', (req, res) => {
  const { borrower_id, items, address, payment_method } = req.body;
  if (!borrower_id || !items || !items.length) {
    return res.status(400).json({ error: 'Missing borrower or items' });
  }

  // Calculate financials safely server-side
  const orderId = `ord_${Date.now()}`;
  const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  let totalRent = 0;
  let totalCommission = 0;
  let totalDeposit = 0;

  const lenderBuckets = new Map();

  for (const item of items) {
    const appliance = db.prepare(`SELECT * FROM appliances WHERE id = ?`).get(item.appliance_id);
    if (!appliance) continue;

    const duration = Number(item.duration) || 1;
    const plan = item.plan || 'monthly';
    let unitRate = appliance.monthly_rate;
    if (plan === 'daily') unitRate = appliance.daily_rate;
    if (plan === 'weekly') unitRate = appliance.weekly_rate;

    const rent = unitRate * duration;
    const commission = appliance.market_value * 0.15;
    const deposit = appliance.market_value * 0.20;

    totalRent += rent;
    totalCommission += commission;
    totalDeposit += deposit;

    if (!lenderBuckets.has(appliance.lender_id)) {
      lenderBuckets.set(appliance.lender_id, []);
    }
    lenderBuckets.get(appliance.lender_id).push({
      appliance,
      plan,
      duration,
      rent,
      commission,
      deposit,
      startDate: item.startDate || new Date().toISOString().split('T')[0],
      endDate: item.endDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    });
  }

  const deliveryFee = lenderBuckets.size * 350;
  const grandTotal = totalRent + totalCommission + totalDeposit + deliveryFee;

  // Insert Parent Order
  db.prepare(`
    INSERT INTO orders (
      id, order_number, borrower_id, total_rent, total_commission,
      total_deposit, delivery_fee, grand_total, payment_status,
      payment_method, gateway_txn_id, shipping_address_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?, ?)
  `).run(
    orderId, orderNumber, borrower_id, totalRent, totalCommission,
    totalDeposit, deliveryFee, grandTotal,
    payment_method || 'Razorpay UPI',
    `pay_mock_${Date.now()}`,
    JSON.stringify(address || { street: '100 Feet Rd, Indiranagar', city: 'Bengaluru', pincode: '560038' })
  );

  const createdSubOrders = [];

  // Create Sub-orders per lender
  let subIndex = 1;
  for (const [lenderId, bucketItems] of lenderBuckets.entries()) {
    const subOrderId = `sub_${orderId}_${subIndex++}`;
    const subRent = bucketItems.reduce((acc, i) => acc + i.rent, 0);
    const subComm = bucketItems.reduce((acc, i) => acc + i.commission, 0);
    const subDep = bucketItems.reduce((acc, i) => acc + i.deposit, 0);
    const trackingCode = `QS-LND-${Math.floor(10000 + Math.random() * 90000)}`;

    db.prepare(`
      INSERT INTO sub_orders (
        id, parent_order_id, lender_id, status, rent_subtotal,
        commission_subtotal, deposit_subtotal, delivery_fee, tracking_number
      ) VALUES (?, ?, ?, 'CONFIRMED', ?, ?, ?, 350, ?)
    `).run(subOrderId, orderId, lenderId, subRent, subComm, subDep, trackingCode);

    // Order items
    for (const item of bucketItems) {
      const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      db.prepare(`
        INSERT INTO order_items (
          id, sub_order_id, parent_order_id, appliance_id, plan,
          duration, start_date, end_date, rent_amount, commission_amount,
          deposit_amount, market_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId, subOrderId, orderId, item.appliance.id, item.plan,
        item.duration, item.startDate, item.endDate, item.rent,
        item.commission, item.deposit, item.appliance.market_value
      );
    }

    // Initialize Escrow Deposit Ledger
    const ledgerId = `dep_led_${subOrderId}`;
    const initialTimeline = [
      {
        time: new Date().toISOString().replace('T', ' ').substring(0, 16),
        event: `Collected 20% Security Deposit (Rs ${subDep.toLocaleString()}) via Gateway`,
        amount: subDep,
        balance: subDep,
        status: 'HELD'
      }
    ];

    db.prepare(`
      INSERT INTO deposit_ledger (
        id, parent_order_id, sub_order_id, borrower_id, lender_id,
        total_deposit, held_amount, status, timeline_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'HELD', ?)
    `).run(ledgerId, orderId, subOrderId, borrower_id, lenderId, subDep, subDep, JSON.stringify(initialTimeline));

    // Initialize Delivery Job
    const deliveryJobId = `del_${subOrderId}`;
    const borrower = db.prepare(`SELECT name, city FROM users WHERE id = ?`).get(borrower_id);
    const lender = db.prepare(`SELECT name, city FROM users WHERE id = ?`).get(lenderId);

    db.prepare(`
      INSERT INTO delivery_jobs (
        id, sub_order_id, tracking_code, provider_name, status,
        pickup_address, delivery_address, notes
      ) VALUES (?, ?, ?, 'QuickShift Logistics', 'ASSIGNED', ?, ?, 'Pickup vehicle dispatched')
    `).run(
      deliveryJobId, subOrderId, trackingCode,
      `${lender.name} Hub, ${lender.city || 'Bengaluru'}`,
      `${borrower.name}, ${address?.city || 'Bengaluru'}`
    );

    createdSubOrders.push({
      subOrderId,
      lenderId,
      subRent,
      subComm,
      subDep,
      trackingCode
    });
  }

  // Audit event
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details_json)
    VALUES (?, ?, 'Borrower', 'borrower', 'CREATE_ORDER', 'order', ?, ?)
  `).run(
    `aud_${Date.now()}`, borrower_id, orderId,
    JSON.stringify({ orderNumber, grandTotal, subOrdersCount: createdSubOrders.length })
  );

  res.status(201).json({
    orderId,
    orderNumber,
    grandTotal,
    subOrders: createdSubOrders,
    message: 'Order placed successfully! Sub-orders created for each lender with automated deposit ledger.'
  });
});

// --- ORDERS LISTING & DETAILS ---
app.get('/api/orders', (req, res) => {
  const { borrower_id } = req.query;
  let sql = `
    SELECT o.*, u.name as borrower_name, u.email as borrower_email
    FROM orders o
    JOIN users u ON o.borrower_id = u.id
  `;
  const params = [];
  if (borrower_id) {
    sql += ' WHERE o.borrower_id = ?';
    params.push(borrower_id);
  }
  sql += ' ORDER BY o.created_at DESC';

  const orders = db.prepare(sql).all(...params);

  const enriched = orders.map(order => {
    const subOrders = db.prepare(`
      SELECT s.*, u.name as lender_name, u.city as lender_city, d.status as delivery_status, d.tracking_code
      FROM sub_orders s
      JOIN users u ON s.lender_id = u.id
      LEFT JOIN delivery_jobs d ON d.sub_order_id = s.id
      WHERE s.parent_order_id = ?
    `).all(order.id);

    return {
      ...order,
      shipping_address: JSON.parse(order.shipping_address_json || '{}'),
      sub_orders: subOrders
    };
  });

  res.json(enriched);
});

app.get('/api/sub-orders', (req, res) => {
  const { lender_id, status } = req.query;
  let sql = `
    SELECT s.*, o.order_number, o.created_at as order_date,
           b.name as borrower_name, b.phone as borrower_phone, b.city as borrower_city,
           l.name as lender_name,
           d.status as delivery_status, d.tracking_code,
           dl.status as deposit_status, dl.held_amount, dl.refunded_amount, dl.deducted_amount
    FROM sub_orders s
    JOIN orders o ON s.parent_order_id = o.id
    JOIN users b ON o.borrower_id = b.id
    JOIN users l ON s.lender_id = l.id
    LEFT JOIN delivery_jobs d ON d.sub_order_id = s.id
    LEFT JOIN deposit_ledger dl ON dl.sub_order_id = s.id
  `;
  const params = [];
  if (lender_id) {
    sql += ' WHERE s.lender_id = ?';
    params.push(lender_id);
  }
  if (status) {
    sql += (params.length ? ' AND' : ' WHERE') + ' s.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY s.created_at DESC';

  const subOrders = db.prepare(sql).all(...params);

  const enriched = subOrders.map(so => {
    const items = db.prepare(`
      SELECT oi.*, a.title, a.brand, a.images_json
      FROM order_items oi
      JOIN appliances a ON oi.appliance_id = a.id
      WHERE oi.sub_order_id = ?
    `).all(so.id);

    const inspection = db.prepare(`SELECT * FROM return_inspections WHERE sub_order_id = ?`).get(so.id);

    return {
      ...so,
      items: items.map(i => ({
        ...i,
        images: JSON.parse(i.images_json || '[]')
      })),
      inspection: inspection ? {
        ...inspection,
        checklist: JSON.parse(inspection.checklist_json || '[]'),
        proof_photos: JSON.parse(inspection.proof_photos_json || '[]')
      } : null
    };
  });

  res.json(enriched);
});

// Update Sub Order Status (Handover / In Transit / Completed)
app.post('/api/sub-orders/:id/status', (req, res) => {
  const { status, note } = req.body;
  const subOrderId = req.params.id;

  db.prepare(`UPDATE sub_orders SET status = ? WHERE id = ?`).run(status, subOrderId);

  // Sync delivery status if relevant
  if (status === 'IN_DELIVERY') {
    db.prepare("UPDATE delivery_jobs SET status = 'IN_TRANSIT' WHERE sub_order_id = ?").run(subOrderId);
  } else if (status === 'ACTIVE') {
    db.prepare("UPDATE delivery_jobs SET status = 'DELIVERED' WHERE sub_order_id = ?").run(subOrderId);
  } else if (status === 'RETURN_INITIATED') {
    db.prepare("UPDATE delivery_jobs SET status = 'RETURN_IN_TRANSIT' WHERE sub_order_id = ?").run(subOrderId);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, actor_name, actor_role, action, target_type, target_id, details_json)
    VALUES (?, 'System / User', 'operator', 'UPDATE_SUB_ORDER_STATUS', 'sub_order', ?, ?)
  `).run(`aud_${Date.now()}`, subOrderId, JSON.stringify({ status, note }));

  res.json({ message: 'Sub-order status updated', status });
});

// --- DEPOSIT LEDGER & ESCROW ---
app.get('/api/ledger', (req, res) => {
  const rows = db.prepare(`
    SELECT dl.*, o.order_number, b.name as borrower_name, l.name as lender_name
    FROM deposit_ledger dl
    JOIN orders o ON dl.parent_order_id = o.id
    JOIN users b ON dl.borrower_id = b.id
    JOIN users l ON dl.lender_id = l.id
    ORDER BY dl.created_at DESC
  `).all();

  const formatted = rows.map(r => ({
    ...r,
    timeline: JSON.parse(r.timeline_json || '[]')
  }));
  res.json(formatted);
});

// --- RETURN INSPECTION & DAMAGE DEDUCTIONS ---
app.post('/api/inspections', (req, res) => {
  const { sub_order_id, lender_id, checklist, condition_grade, notes, proof_photos, proposed_deduction, damage_reason } = req.body;

  const subOrder = db.prepare(`SELECT s.*, o.borrower_id FROM sub_orders s JOIN orders o ON s.parent_order_id = o.id WHERE s.id = ?`).get(sub_order_id);
  if (!subOrder) return res.status(404).json({ error: 'Sub-order not found' });

  const inspectionId = `insp_${Date.now()}`;
  const deduction = Number(proposed_deduction) || 0;

  db.prepare(`
    INSERT INTO return_inspections (
      id, sub_order_id, lender_id, borrower_id, checklist_json,
      condition_grade, notes, proof_photos_json, proposed_deduction,
      damage_reason, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inspectionId, sub_order_id, lender_id, subOrder.borrower_id,
    JSON.stringify(checklist || []),
    condition_grade || 'Normal',
    notes || '',
    JSON.stringify(proof_photos || []),
    deduction,
    damage_reason || '',
    deduction > 0 ? 'PENDING_BORROWER_REVIEW' : 'COMPLETED_NO_DAMAGE'
  );

  // Update sub-order state
  db.prepare("UPDATE sub_orders SET status = 'RETURN_INSPECTED' WHERE id = ?").run(sub_order_id);

  const ledger = db.prepare(`SELECT * FROM deposit_ledger WHERE sub_order_id = ?`).get(sub_order_id);
  if (ledger) {
    const timeline = JSON.parse(ledger.timeline_json || '[]');
    if (deduction === 0) {
      // 100% full refund immediately if pristine condition
      timeline.push({
        time: new Date().toISOString().replace('T', ' ').substring(0, 16),
        event: `Pristine Return Verified: Full deposit refund of Rs ${ledger.total_deposit.toLocaleString()} initiated`,
        amount: ledger.total_deposit,
        balance: 0,
        status: 'REFUNDED'
      });
      db.prepare(`
        UPDATE deposit_ledger
        SET held_amount = 0, refunded_amount = total_deposit, status = 'REFUNDED', timeline_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(timeline), ledger.id);
    } else {
      // Release undisputed balance if proposed deduction is less than total deposit
      const undisputedRefund = Math.max(0, ledger.total_deposit - deduction);
      if (undisputedRefund > 0) {
        timeline.push({
          time: new Date().toISOString().replace('T', ' ').substring(0, 16),
          event: `Lender claimed Rs ${deduction.toLocaleString()} damage deduction. Undisputed balance of Rs ${undisputedRefund.toLocaleString()} released to Borrower`,
          amount: undisputedRefund,
          balance: deduction,
          status: 'PARTIALLY_REFUNDED'
        });
      }
      timeline.push({
        time: new Date().toISOString().replace('T', ' ').substring(0, 16),
        event: `Rs ${deduction.toLocaleString()} held in Escrow awaiting Borrower acceptance or dispute`,
        amount: deduction,
        balance: deduction,
        status: 'CLAIMED'
      });

      db.prepare(`
        UPDATE deposit_ledger
        SET held_amount = ?, refunded_amount = ?, status = 'CLAIMED', timeline_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(deduction, undisputedRefund, JSON.stringify(timeline), ledger.id);
    }
  }

  res.status(201).json({ inspectionId, message: 'Inspection checklist recorded' });
});

// Borrower response to inspection (Accept claim or raise Dispute)
app.post('/api/inspections/:id/respond', (req, res) => {
  const { accept, dispute_reason, borrower_statement } = req.body;
  const inspection = db.prepare(`SELECT * FROM return_inspections WHERE id = ?`).get(req.params.id);
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const ledger = db.prepare(`SELECT * FROM deposit_ledger WHERE sub_order_id = ?`).get(inspection.sub_order_id);
  const timeline = ledger ? JSON.parse(ledger.timeline_json || '[]') : [];

  if (accept) {
    // Borrower accepts proposed deduction
    db.prepare(`UPDATE return_inspections SET status = 'ACCEPTED' WHERE id = ?`).run(inspection.id);
    db.prepare("UPDATE sub_orders SET status = 'COMPLETED' WHERE id = ?").run(inspection.sub_order_id);

    if (ledger) {
      timeline.push({
        time: new Date().toISOString().replace('T', ' ').substring(0, 16),
        event: `Borrower accepted damage claim of Rs ${inspection.proposed_deduction.toLocaleString()}. Deducted from deposit and paid to Lender.`,
        amount: inspection.proposed_deduction,
        balance: 0,
        status: 'SETTLED'
      });

      db.prepare(`
        UPDATE deposit_ledger
        SET held_amount = 0, deducted_amount = ?, status = 'SETTLED', timeline_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(inspection.proposed_deduction, JSON.stringify(timeline), ledger.id);
    }
    return res.json({ message: 'Damage deduction accepted. Ledger settled.' });
  } else {
    // Borrower raises a dispute -> escrow freeze for Admin review
    db.prepare(`UPDATE return_inspections SET status = 'DISPUTED' WHERE id = ?`).run(inspection.id);

    const disputeId = `disp_${Date.now()}`;
    db.prepare(`
      INSERT INTO disputes (
        id, inspection_id, sub_order_id, borrower_id, lender_id,
        claim_amount, dispute_reason, borrower_statement, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
    `).run(
      disputeId, inspection.id, inspection.sub_order_id, inspection.borrower_id,
      inspection.lender_id, inspection.proposed_deduction,
      dispute_reason || 'Disputed damage assessment',
      borrower_statement || 'Claimed damage was pre-existing or normal wear and tear'
    );

    if (ledger) {
      timeline.push({
        time: new Date().toISOString().replace('T', ' ').substring(0, 16),
        event: `Borrower disputed Rs ${inspection.proposed_deduction.toLocaleString()} claim. Funds locked in Escrow for Admin arbitration.`,
        amount: inspection.proposed_deduction,
        balance: ledger.held_amount,
        status: 'DISPUTED'
      });
      db.prepare(`
        UPDATE deposit_ledger
        SET status = 'DISPUTED', timeline_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(timeline), ledger.id);
    }

    return res.json({ disputeId, message: 'Dispute submitted. Admin has been notified for evidence review.' });
  }
});

// --- DISPUTES LISTING & ADMIN ARBITRATION ---
app.get('/api/disputes', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, o.order_number, b.name as borrower_name, b.email as borrower_email,
           l.name as lender_name, l.email as lender_email,
           ri.notes as inspection_notes, ri.proof_photos_json, ri.checklist_json
    FROM disputes d
    JOIN sub_orders s ON d.sub_order_id = s.id
    JOIN orders o ON s.parent_order_id = o.id
    JOIN users b ON d.borrower_id = b.id
    JOIN users l ON d.lender_id = l.id
    LEFT JOIN return_inspections ri ON d.inspection_id = ri.id
    ORDER BY d.created_at DESC
  `).all();

  const formatted = rows.map(r => ({
    ...r,
    proof_photos: JSON.parse(r.proof_photos_json || '[]'),
    checklist: JSON.parse(r.checklist_json || '[]')
  }));
  res.json(formatted);
});

app.post('/api/disputes/:id/resolve', (req, res) => {
  const { decision, authorized_deduction, admin_notes } = req.body;
  const dispute = db.prepare(`SELECT * FROM disputes WHERE id = ?`).get(req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

  const finalDeduction = Number(authorized_deduction) || 0;
  const refundToBorrower = Math.max(0, dispute.claim_amount - finalDeduction);

  db.prepare(`
    UPDATE disputes
    SET status = 'RESOLVED', admin_decision = ?, resolved_deduction = ?, admin_notes = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(decision || 'ADMIN_DECISION_FINAL', finalDeduction, admin_notes || 'Arbitrated under NFR Fair Wear & Tear Standard', dispute.id);

  db.prepare(`UPDATE return_inspections SET status = 'RESOLVED_BY_ADMIN' WHERE id = ?`).run(dispute.inspection_id);
  db.prepare("UPDATE sub_orders SET status = 'COMPLETED' WHERE id = ?").run(dispute.sub_order_id);

  // Settle deposit ledger
  const ledger = db.prepare(`SELECT * FROM deposit_ledger WHERE sub_order_id = ?`).get(dispute.sub_order_id);
  if (ledger) {
    const timeline = JSON.parse(ledger.timeline_json || '[]');
    timeline.push({
      time: new Date().toISOString().replace('T', ' ').substring(0, 16),
      event: `Admin Arbitration Complete: Approved deduction = Rs ${finalDeduction.toLocaleString()} (paid to Lender), Remaining refund = Rs ${refundToBorrower.toLocaleString()} (returned to Borrower). Note: ${admin_notes}`,
      amount: dispute.claim_amount,
      balance: 0,
      status: 'RESOLVED_BY_ADMIN'
    });

    db.prepare(`
      UPDATE deposit_ledger
      SET held_amount = 0,
          deducted_amount = deducted_amount + ?,
          refunded_amount = refunded_amount + ?,
          status = 'SETTLED',
          timeline_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(finalDeduction, refundToBorrower, JSON.stringify(timeline), ledger.id);
  }

  // Audit event
  db.prepare(`
    INSERT INTO audit_logs (id, actor_name, actor_role, action, target_type, target_id, details_json)
    VALUES (?, 'Admin Officer', 'admin', 'RESOLVE_DISPUTE', 'dispute', ?, ?)
  `).run(`aud_${Date.now()}`, dispute.id, JSON.stringify({ finalDeduction, refundToBorrower, admin_notes }));

  res.json({ message: 'Dispute resolved and ledger settlements dispatched.', finalDeduction, refundToBorrower });
});

// --- ADMIN DASHBOARD METRICS ---
app.get('/api/admin/metrics', (req, res) => {
  const totalCommission = db.prepare(`SELECT COALESCE(SUM(total_commission), 0) as val FROM orders`).get().val;
  const escrowHeld = db.prepare(`SELECT COALESCE(SUM(held_amount), 0) as val FROM deposit_ledger`).get().val;
  const totalRefunded = db.prepare(`SELECT COALESCE(SUM(refunded_amount), 0) as val FROM deposit_ledger`).get().val;
  const activeOrders = db.prepare(`SELECT COUNT(*) as count FROM orders`).get().count;
  const activeSubOrders = db.prepare(`SELECT COUNT(*) as count FROM sub_orders WHERE status != 'COMPLETED'`).get().count;
  const openDisputes = db.prepare(`SELECT COUNT(*) as count FROM disputes WHERE status = 'OPEN'`).get().count;
  const totalAppliances = db.prepare(`SELECT COUNT(*) as count FROM appliances`).get().count;

  res.json({
    totalCommission,
    escrowHeld,
    totalRefunded,
    activeOrders,
    activeSubOrders,
    openDisputes,
    totalAppliances,
    auditLogs: db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10`).all()
  });
});


import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../../frontend/dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Rental Marketplace API running on http://localhost:${PORT}`);
});
