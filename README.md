# RentAppliance Pro — On-Demand Appliance & Utility Rental Marketplace
*Full-stack responsive rental marketplace compliant with **NFR v3.0 Specification***

A high-performance web platform featuring **28 on-demand portable appliances and utility tools** (hair dryers, robot vacuums, pressure washers, power tools, espresso makers, etc.) with real Amazon CDN product imagery, multi-lender order splitting, 15% platform commission, 20% security deposit escrow custody, and damage arbitration.

---

## 🚀 Live Demonstration URLs

| Service | Port | Local URL | Description |
| :--- | :--- | :--- | :--- |
| **Web Application (Vite Dev)** | `3000` | [http://localhost:3000](http://localhost:3000) | Interactive React Web UI with manual login system |
| **Fullstack Server (Express API)** | `5001` | [http://localhost:5001](http://localhost:5001) | REST API & Database engine (`node:sqlite`) |

---

## 🔑 Login Credentials for Client Demo

Manual entry is enforced on the Sign In page:

| Role | User Name | Email Address | Password | Primary Workspace |
| :--- | :--- | :--- | :--- | :--- |
| **🛍️ Borrower** | Aarav Mehta | `aarav@example.com` | `Borrower@123` | Marketplace Catalog, Cart, Transparent Calculations, Active Rentals |
| **🏪 Lender** | Rohit Sharma | `rohit@example.com` | `Lender@123` | Lender Hub, Inventory Management, Sub-Orders, Return Damage Inspection |
| **🛡️ Admin Arbitrator** | Admin Officer | `admin@rentappliances.com` | `Admin@123` | Platform Overview Metrics, Escrow Custody Ledger, Dispute Arbitration |

*Complete walkthrough script available in [CLIENT_DEMO_GUIDE.md](./CLIENT_DEMO_GUIDE.md).*

---

## 🧰 Catalog: 28 Portable & On-Demand Utility Items

1. **Personal Grooming & Styling**: Dyson Supersonic Hair Dryer, Shark FlexStyle 5-in-1, Philips Prestige Pro 2300W, Homedics Shiatsu Foot Massager
2. **Car & Outdoor Cleaning**: Kärcher K3 High-Pressure Washer (120 Bar), Bosch EasyAquatak 120, Black+Decker BXPW1600E 125-Bar, Bosch UniversalGardenTidy Leaf Blower
3. **Vacuum Cleaners & Floorcare**: Dyson V12 Detect Slim Cordless, Bissell SpotClean Pro Carpet Washer, Eureka Forbes Wet & Dry, Kärcher WD3 Multi-Purpose, Dreame D10s Pro Robot Vacuum
4. **Garment & Fabric Care**: Philips ComfortTouch Stand Steamer, Black+Decker 1600W Handheld Steamer, Singer Heavy Duty 4423 Sewing Machine
5. **Kitchen Appliances & Gourmet**: De'Longhi Dedica Deluxe Espresso Maker, Philips Digital XXL Airfryer (7.3L), Nutribullet Pro 900W Blender, Instant Pot Duo 7-in-1, Cuisinart Ice Cream Maker
6. **DIY & Power Tools**: Bosch GSB 500W Impact Drill Kit, DeWalt 20V MAX Cordless Drill, Wagner Control Pro 150 Paint Sprayer, EcoFlow River 2 Max Power Station
7. **Entertainment & Gadgets**: XGIMI MoGo 2 Smart Projector, JBL PartyBox 110 Speaker, DJI Mini 2 SE 4K Drone

---

## 📋 NFR v3.0 Core Business Rules Implemented

- **Fixed 15% Platform Commission**: 15% of product market value calculated transparently per rental item.
- **Fixed 20% Security Deposit**: 20% of product market value held in an isolated **Escrow Custody Ledger** and released post-inspection.
- **Multi-Lender Cart Splitting**: Single checkout automatically splits into a **Parent Order** and distinct **Lender Sub-Orders** (with ₹350 delivery fee per lender hub).
- **Damage Inspection & Disputes**: Post-return condition checklist, photo evidence upload, damage deduction proposal, and Admin arbitration.

---

## 🧪 Automated Verification Suite

Run all 12 end-to-end tests:
```bash
npm test
```
All 12 core business flows and authentication mechanisms pass with a 100% pass rate.
# ra
