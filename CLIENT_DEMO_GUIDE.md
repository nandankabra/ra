# RentAppliance Pro — Client Demonstration & Handover Guide
**Enterprise On-Demand Appliance & Tool Rental Marketplace**  
*Compliance Specification: NFR v3.0 (Fixed 15% Commission, 20% Escrow Custody, Multi-Lender Cart Splitting, Dispute Arbitration)*

---

## 🎯 Executive Summary

RentAppliance Pro is a full-stack, enterprise-grade rental marketplace specifically tailored for **portable, high-demand appliances and utility tools** (hair dryers, robot vacuums, pressure washers, power tools, espresso makers, etc.).

Unlike generic rental prototypes, this platform enforces strict business rules defined in the **NFR v3.0 Specification**:
1. **Mathematical Financial Transparency**:
   - Fixed **15% Platform Commission** on Product Market Value.
   - Fixed **20% Refundable Security Deposit** held in an isolated **Escrow Custody Ledger**.
   - Dynamic Multi-Lender Delivery Logistics (₹350 per unique origin hub).
2. **Order Architecture**:
   - Single checkout splits into a **Parent Order** and distinct **Lender Sub-Orders**.
   - Independent tracking, dispatch statuses, and escrow ledger records for each sub-order.
3. **End-to-End Dispute & Arbitration Workflow**:
   - Post-return damage inspection with condition grading and claim proposal.
   - Borrower right to dispute claims, freezing escrow funds.
   - Admin Arbitration Panel with authoritative settlement release.

---

## 🔑 Demo Login Credentials (All 3 Roles)

Manual credential entry is enforced in the login system:

| Role | User Name | Email Address | Password | Portal Features & Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **🛍️ Borrower** | Aarav Mehta | `aarav@example.com` | `Borrower@123` | • Browse 28 appliances with real Amazon CDN photos<br>• Filter by 7 categories & live search<br>• Transparent pricing modal (daily, weekly, monthly rates)<br>• Multi-Lender Cart with automatic formula breakdown<br>• One-click checkout generating sub-orders<br>• Active rentals timeline with delivery tracking & dispute triggers |
| **🏪 Lender** | Rohit Sharma | `rohit@example.com` | `Lender@123` | • Lender earnings & active sub-order dashboard<br>• Incoming rental dispatch management<br>• Appliance inventory manager (add listing with auto 20% deposit)<br>• Return damage inspection form (condition grade, checklist, claim) |
| **🛡️ Admin Arbitrator** | Admin Officer | `admin@rentappliances.com` | `Admin@123` | • Platform KPI overview (Commission revenue, Escrow in custody)<br>• Real-time Escrow Deposit Ledger<br>• Live Dispute Arbitration Panel with damage claim adjustment<br>• Tamper-evident Platform Audit Trail |

---

## 🎬 Recommended 5-Minute Client Walkthrough Script

Follow these 4 sequential steps to demonstrate the end-to-end capabilities to your client:

### Step 1: The Borrower Journey (Browsing & Multi-Lender Cart Checkout)
1. Open **[http://localhost:3000](http://localhost:3000)** in your browser.
2. In the top-right header, click **Sign In / Register**.
3. Type:
   - **Email:** `aarav@example.com`
   - **Password:** `Borrower@123`
   - Click **Sign In**.
4. Notice the header displays **Aarav Mehta (BORROWER)**.
5. Browse the catalog:
   - Filter by categories (*Personal Grooming*, *Car & Outdoor Cleaning*, *Kitchen Appliances*, etc.).
   - Click on any appliance (e.g. **Dyson Supersonic Hair Dryer** or **Kärcher K3 High-Pressure Car Washer**) to view the real Amazon product photos, condition grade, and fee breakdown (Rent, 15% Platform Commission, 20% Deposit).
6. Go to **Cart & Transparent Breakdown**:
   - Review the multi-lender order splitting notice and the escrow protection guarantee badge.
   - Click **Confirm & Pay** to execute checkout.
   - Note the resulting **Parent Order ID**, distinct **Lender Sub-Orders**, and automated courier tracking numbers.

### Step 2: The Lender Experience (Dispatches, Inventory & Return Inspection)
1. In the top-right header, click the **Key icon** (or click the **Lender** role tab).
2. Type the Lender credentials:
   - **Email:** `rohit@example.com`
   - **Password:** `Lender@123`
   - Click **Sign In**.
3. Notice the header updates to **Rohit Sharma (LENDER)**.
4. Review the **Lender Dashboard**:
   - View gross rental earnings and incoming sub-orders.
   - Click **Appliance Inventory** to see current listings. Click **+ List Appliance for Rent** to demonstrate the automatic 20% deposit calculation.
5. Return damage inspection:
   - Click **Conduct Post-Return Damage Inspection** on an active rental.
   - Select condition grade, propose a damage deduction (e.g., ₹1,500), add photos, and submit the inspection report.

### Step 3: Borrower Damage Claim Dispute
1. Switch back to Borrower account (`aarav@example.com` / `Borrower@123`).
2. Go to **My Active Rentals**.
3. Notice the alert: *"Lender proposed a damage claim of ₹1,500"*.
4. Click **Dispute Damage Claim** to freeze escrow custody and escalate the claim directly to Admin arbitration.

### Step 4: Admin Arbitration & Escrow Ledger Settlement
1. Switch to Admin account (`admin@rentappliances.com` / `Admin@123`).
2. Open **Dispute Arbitration Panel**:
   - Review the lender's damage statement versus the borrower's dispute.
   - Arbitrate a fair settlement (e.g. authorize ₹800 deduction and release ₹4,200 back to borrower).
   - Click **Arbitrate & Release Settlements**.
3. Open **Escrow Deposit Ledger**:
   - Observe the live escrow ledger transition to `SETTLED` with mathematical audit accuracy.
4. Open **Platform Overview & Audit Trail**:
   - View updated GMV, platform commission, and the chronological audit log.

---

## 🏗️ Technical Architecture

- **Backend**: Node.js, Express, `node:sqlite` in WAL mode (zero external database configuration required). Runs on port `5001`.
- **Frontend**: React 18, Vite, Lucide Icons, responsive Vanilla CSS with dark glassmorphism design tokens. Runs on port `3000`.
- **Catalog Dataset**: 28 authentic on-demand appliances across 7 distinct categories with high-resolution authentic Amazon CDN product photography (`m.media-amazon.com/images/I/...`).
- **Automated Test Suite**: 12 comprehensive end-to-end test cases in `scripts/test-flows.js` (`npm test`) verifying all mathematical formulas and workflows with a 100% pass rate.

---

## ⚡ How to Run Locally

If presenting from a fresh terminal or restarting services:
```bash
# 1. Run the backend API server
node backend/src/server.js

# 2. Run the Vite frontend dev server (in another terminal)
cd frontend && npm run dev

# 3. Run automated end-to-end verification tests
npm test
```
