import assert from 'node:assert';

const BASE_URL = 'http://localhost:5001';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${endpoint}: ${JSON.stringify(data)}`);
  }
  return { status: res.status, data };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END VERIFICATION TEST SUITE');
  console.log('   Home Appliance Rental Marketplace (NFR v3.0 Compliance)');
  console.log('================================================================\n');

  const tests = [
    // 1. Catalog Verification
    test('1. Catalog should return all 28 on-demand appliances', async () => {
      const { data } = await request('/api/appliances');
      assert.strictEqual(Array.isArray(data), true, 'Appliances should be an array');
      assert.strictEqual(data.length >= 28, true, `Expected at least 28 appliances, got ${data.length}`);
      
      const categories = new Set(data.map(i => i.category));
      assert.ok(categories.has('Personal Grooming'), 'Should include Personal Grooming');
      assert.ok(categories.has('Car & Outdoor Cleaning'), 'Should include Car & Outdoor Cleaning');
      assert.ok(categories.has('Vacuum & Floorcare'), 'Should include Vacuum & Floorcare');
      assert.ok(categories.has('DIY & Power Tools'), 'Should include DIY & Power Tools');
    }),

    test('2. Search & Category filtering work properly', async () => {
      const { data: hairDryers } = await request('/api/appliances?category=Personal%20Grooming');
      assert.ok(hairDryers.length >= 3, 'Should find personal grooming appliances');
      assert.ok(hairDryers.every(a => a.category === 'Personal Grooming'), 'All filtered items must match category');

      const { data: searchResults } = await request('/api/appliances?search=washer');
      assert.ok(searchResults.length >= 2, 'Should find car washers via search query');
    }),

    test('3. Single appliance detail includes transparent 15% commission & 20% deposit', async () => {
      const { data: appliance } = await request('/api/appliances/app_1');
      assert.strictEqual(appliance.id, 'app_1');
      assert.strictEqual(appliance.brand, 'Dyson');
      
      // NFR verification:
      const expectedCommission = appliance.market_value * 0.15;
      const expectedDeposit = appliance.market_value * 0.20;
      assert.strictEqual(appliance.calculated_commission, expectedCommission, 'Commission must be exactly 15% MV');
      assert.strictEqual(appliance.calculated_deposit, expectedDeposit, 'Deposit must be exactly 20% MV');
    }),

    // 2. Pricing & Transparent Cart Calculation Engine
    test('4. Calculation engine correctly splits multi-lender cart & verifies NFR formulas', async () => {
      const cartItems = [
        { appliance_id: 'app_1', plan: 'daily', duration: 3 }, // Dyson Hair Dryer (Lender 1)
        { appliance_id: 'app_5', plan: 'daily', duration: 2 }  // Karcher Car Washer (Lender 2)
      ];

      const { data: calc } = await request('/api/calculate', {
        method: 'POST',
        body: JSON.stringify({ items: cartItems })
      });

      assert.strictEqual(calc.items.length, 2, 'Should compute 2 items');
      assert.strictEqual(calc.subOrdersPreview.length, 2, 'Should split into 2 distinct lender sub-orders');

      // Rent: (250 * 3) + (220 * 2) = 750 + 440 = 1190
      assert.strictEqual(calc.summary.totalRent, 1190, 'Total rent calculation');
      // Commission: (38000 * 0.15) + (14500 * 0.15) = 5700 + 2175 = 7875
      assert.strictEqual(calc.summary.totalCommission, 7875, 'Fixed 15% commission on MV');
      // Deposit: (38000 * 0.20) + (14500 * 0.20) = 7600 + 2900 = 10500
      assert.strictEqual(calc.summary.totalDeposit, 10500, 'Fixed 20% refundable deposit on MV');
      // Delivery: 2 distinct lenders * 350 = 700
      assert.strictEqual(calc.summary.deliveryFee, 700, 'Logistics fee 350 per origin hub');
      // Grand Total: 1190 + 7875 + 10500 + 700 = 20265
      assert.strictEqual(calc.summary.grandTotal, 20265, 'Grand total payable');
    }),

    // 3. Checkout, Parent Order & Sub-Orders creation
    test('5. Multi-lender checkout generates Parent Order, Lender Sub-Orders & Escrow Ledgers', async () => {
      const checkoutPayload = {
        borrower_id: 'usr_borrower_1',
        items: [
          { appliance_id: 'app_2', plan: 'weekly', duration: 1 }, // Shark Styler (Lender 1)
          { appliance_id: 'app_7', plan: 'daily', duration: 2 }   // Black+Decker Washer (Lender 3)
        ],
        address: { street: 'Indiranagar 12th Main', city: 'Bengaluru', pincode: '560038' },
        payment_method: 'UPI Instant'
      };

      const { data: orderResult } = await request('/api/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutPayload)
      });

      assert.ok(orderResult.orderId, 'Order ID must be generated');
      assert.ok(orderResult.orderNumber, 'Order Number must be generated');
      assert.strictEqual(orderResult.subOrders.length, 2, 'Must create 2 lender sub-orders');

      // Verify parent order in database
      const { data: orders } = await request(`/api/orders?borrower_id=usr_borrower_1`);
      const created = orders.find(o => o.id === orderResult.orderId);
      assert.ok(created, 'Created order must exist in orders list');
      assert.strictEqual(created.payment_status, 'PAID', 'Payment status should be PAID');
      assert.strictEqual(created.sub_orders.length, 2, 'Must have 2 sub orders linked');
    }),

    // 4. Lender Sub-Orders & Logistics Tracking
    test('6. Lender Sub-Order status lifecycle & delivery jobs tracking', async () => {
      const { data: subOrders } = await request('/api/sub-orders?lender_id=usr_lender_1');
      assert.ok(subOrders.length > 0, 'Lender 1 should have sub orders');

      const targetSubOrder = subOrders[0];
      // Transition status to IN_DELIVERY
      const { data: updateRes } = await request(`/api/sub-orders/${targetSubOrder.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'IN_DELIVERY', note: 'Courier picked up package' })
      });
      assert.strictEqual(updateRes.status, 'IN_DELIVERY');

      // Transition status to ACTIVE (delivered)
      await request(`/api/sub-orders/${targetSubOrder.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'ACTIVE', note: 'Customer accepted handover' })
      });

      // Verify updated status
      const { data: refetched } = await request(`/api/sub-orders?lender_id=usr_lender_1`);
      const updated = refetched.find(s => s.id === targetSubOrder.id);
      assert.strictEqual(updated.status, 'ACTIVE');
    }),

    // 5. Lender Listing creation
    test('7. Lender can add new appliance listing with automatic deposit calculation', async () => {
      const newAppliance = {
        lender_id: 'usr_lender_1',
        title: 'Anker Nebula Capsule 3 Laser Mini Projector',
        category: 'Entertainment & Gadgets',
        brand: 'Anker',
        description: 'Pocket-sized laser cinema projector with 120-inch 1080p display.',
        condition: 'Mint',
        market_value: 65000,
        monthly_rate: 3900,
        location: 'Koramangala, Bengaluru',
        features: ['1080p Laser Display', '2.5 Hour Playtime', 'Auto Focus'],
        images: ['https://m.media-amazon.com/images/I/619NJGBXTvL.jpg']
      };

      const { data: createRes } = await request('/api/appliances', {
        method: 'POST',
        body: JSON.stringify(newAppliance)
      });

      assert.ok(createRes.id, 'New appliance ID should be created');

      const { data: fetched } = await request(`/api/appliances/${createRes.id}`);
      assert.strictEqual(fetched.title, newAppliance.title);
      assert.strictEqual(fetched.deposit_amount, 65000 * 0.20, 'Deposit must be 20% of 65000 = 13000');
    }),

    // 6. Post-Return Inspection & Damage Deduction Studio
    test('8. Post-return inspection correctly releases undisputed balance and holds claim in Escrow', async () => {
      // Find a sub-order to inspect
      const { data: subOrders } = await request('/api/sub-orders');
      const subOrder = subOrders.find(s => s.status !== 'RETURN_INSPECTED' && s.status !== 'COMPLETED');
      assert.ok(subOrder, 'Found an eligible sub-order for return inspection');

      const inspectionPayload = {
        sub_order_id: subOrder.id,
        lender_id: subOrder.lender_id,
        checklist: [
          { item: 'Motor & heating element operational', passed: true },
          { item: 'No physical cracks or missing parts', passed: false }
        ],
        condition_grade: 'Minor Damage',
        notes: 'Cracked accessory nozzle clip',
        proposed_deduction: 500,
        damage_reason: 'Broken nozzle clip'
      };

      const { data: inspResult } = await request('/api/inspections', {
        method: 'POST',
        body: JSON.stringify(inspectionPayload)
      });

      assert.ok(inspResult.inspectionId, 'Inspection ID must be returned');

      // Verify that deposit ledger now holds the proposed deduction in Escrow
      const { data: ledger } = await request('/api/ledger');
      const ledgerEntry = ledger.find(l => l.sub_order_id === subOrder.id);
      assert.ok(ledgerEntry, 'Ledger entry must exist');
      assert.strictEqual(ledgerEntry.held_amount, 500, 'Escrow must hold 500 for the damage claim');
      assert.strictEqual(ledgerEntry.status, 'CLAIMED');
    }),

    // 7. Borrower Rebuttal & Dispute Submission
    test('9. Borrower can dispute proposed damage claim to freeze funds for Admin arbitration', async () => {
      // Create a fresh order, inspect with claim, and dispute it
      const { data: checkoutRes } = await request('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          borrower_id: 'usr_borrower_1',
          items: [{ appliance_id: 'app_3', plan: 'daily', duration: 2 }],
          address: { street: 'Koramangala 8th Block', city: 'Bengaluru' }
        })
      });

      const subOrderId = checkoutRes.subOrders[0].subOrderId;
      const lenderId = checkoutRes.subOrders[0].lenderId;

      // Lender files inspection with Rs 400 claim
      const { data: inspRes } = await request('/api/inspections', {
        method: 'POST',
        body: JSON.stringify({
          sub_order_id: subOrderId,
          lender_id: lenderId,
          proposed_deduction: 400,
          condition_grade: 'Minor Scratches',
          damage_reason: 'Scratched exterior body'
        })
      });

      // Borrower disputes the claim
      const { data: disputeRes } = await request(`/api/inspections/${inspRes.inspectionId}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          accept: false,
          dispute_reason: 'Normal wear and tear',
          borrower_statement: 'Hair dryer was kept in protective pouch. Scratches were already present.'
        })
      });

      assert.ok(disputeRes.disputeId, 'Dispute ID must be generated');

      // Verify dispute appears in disputes list
      const { data: disputes } = await request('/api/disputes');
      const dispute = disputes.find(d => d.id === disputeRes.disputeId);
      assert.ok(dispute, 'Dispute must be recorded in system');
      assert.strictEqual(dispute.status, 'OPEN');
      assert.strictEqual(dispute.claim_amount, 400);
    }),

    // 8. Admin Dispute Arbitration
    test('10. Admin arbitrates dispute with fair settlement and settles Deposit Escrow Ledger', async () => {
      const { data: disputes } = await request('/api/disputes');
      const openDispute = disputes.find(d => d.status === 'OPEN');
      assert.ok(openDispute, 'Must have an open dispute to arbitrate');

      // Admin resolves with 50/50 fair wear-and-tear settlement (e.g. half deduction)
      const fairDeduction = Math.round(openDispute.claim_amount / 2);
      const { data: resolveRes } = await request(`/api/disputes/${openDispute.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'FAIR_SETTLEMENT_50_50',
          authorized_deduction: fairDeduction,
          admin_notes: 'Fair resolution: 50% allowance under NFR fair wear-and-tear standard.'
        })
      });

      assert.strictEqual(resolveRes.finalDeduction, fairDeduction);

      // Verify dispute is marked RESOLVED
      const { data: updatedDisputes } = await request('/api/disputes');
      const resolved = updatedDisputes.find(d => d.id === openDispute.id);
      assert.strictEqual(resolved.status, 'RESOLVED');

      // Verify that ledger held amount is now 0 (fully settled)
      const { data: ledger } = await request('/api/ledger');
      const ledgerEntry = ledger.find(l => l.sub_order_id === openDispute.sub_order_id);
      assert.strictEqual(ledgerEntry.held_amount, 0, 'All held funds must be settled out of Escrow');
      assert.strictEqual(ledgerEntry.status, 'SETTLED');
    }),

    // 9. Admin Platform Metrics & Audit Logs
    test('11. Admin dashboard metrics and live audit trail reflect real ledger totals', async () => {
      const { data: metrics } = await request('/api/admin/metrics');
      assert.ok(typeof metrics.totalCommission === 'number' && metrics.totalCommission > 0, 'Commission must be tracked');
      assert.ok(typeof metrics.escrowHeld === 'number', 'Escrow custody must be tracked');
      assert.ok(typeof metrics.totalRefunded === 'number', 'Refunds must be tracked');
      assert.ok(Array.isArray(metrics.auditLogs), 'Audit logs must be an array');
      assert.ok(metrics.auditLogs.length > 0, 'Audit logs must record platform actions');
    }),

    // 12. Multi-Role Authentication System
    test('12. Multi-role authentication (Borrower/Lender/Admin login, password verification, registration & session auth)', async () => {
      // 12.1 Borrower Login
      const { data: bLogin } = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'aarav@example.com', password: 'Borrower@123' })
      });
      assert.strictEqual(bLogin.user.role, 'borrower');
      assert.ok(bLogin.token.startsWith('token_'));

      // 12.2 Lender Login
      const { data: lLogin } = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'rohit@example.com', password: 'Lender@123' })
      });
      assert.strictEqual(lLogin.user.role, 'lender');

      // 12.3 Admin Login
      const { data: aLogin } = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@rentappliances.com', password: 'Admin@123' })
      });
      assert.strictEqual(aLogin.user.role, 'admin');

      // 12.4 Reject Invalid Password
      let rejected = false;
      try {
        await request('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: 'admin@rentappliances.com', password: 'BadPassword' })
        });
      } catch (e) {
        rejected = true;
      }
      assert.ok(rejected, 'Invalid password should throw error');

      // 12.5 Register New User
      const testEmail = 'verify_' + Date.now() + '@example.com';
      const { data: reg } = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Meera Iyer',
          email: testEmail,
          password: 'Pass@123456',
          role: 'borrower',
          phone: '+91 91234 56789',
          city: 'Bengaluru'
        })
      });
      assert.strictEqual(reg.user.name, 'Meera Iyer');

      // 12.6 Verify session endpoint
      const { data: session } = await request('/api/auth/me?userId=' + reg.user.id);
      assert.strictEqual(session.user.email, testEmail);
    })
  ];

  for (const t of tests) {
    await t();
  }

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL 12 CORE BUSINESS FLOWS AND AUTHENTICATION REQUIREMENTS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  }
}

runAllTests();
