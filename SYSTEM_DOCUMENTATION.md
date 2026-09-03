# Servio POS System Documentation

This document provides a comprehensive overview of the Servio Point-of-Sale (POS) system. It explains the system architecture, database schema, real-time synchronization, UI scaling system, and detailed workflows for each terminal interface.

---

## 1. System Architecture

Servio is a real-time, touch-optimized web-based POS system designed for restaurant operations:
- **Frontend**: React (bootstrapped with Vite) for responsive, touch-friendly interfaces.
- **Routing**: `react-router-dom` for navigation between role-specific terminals (Cashier, Kitchen, Waiter, Customer, Admin, Inventory, Restaurant Management) and authentication guards.
- **Backend & Database**: Supabase (PostgreSQL) handles relational data persistence, Row-Level Security (RLS), and Realtime WebSocket subscriptions (`postgres_changes` and peer `broadcast`).
- **Serverless API**: A serverless function (`/api/protocol-assistant`) powers the AI Protocol Assistant, hosted on Vercel.
- **State Management**: Centralized React Contexts (`POSContext.jsx` and `AuthContext.jsx`) manage live tables, orders, inventory, customer requests, payment selections, and cross-tab communication.
- **Thermal Printing**: Direct 80mm thermal receipt generation engine configured for standard POS thermal printers.
- **Deployment**: Hosted on **Vercel** with SPA rewrites (`vercel.json`). Build output is generated in `dist/` via `npm run build`.

---

## 2. Database Schema

Hosted on Supabase PostgreSQL:

- **`profiles`**: Staff credentials, assigned roles (`Admin`, `Cashier`, `Waiter`, `Kitchen`), and active status.
- **`categories`**: Menu categories (e.g., Appetizers, Food, Drinks, Desserts, Meals & Combos).
- **`menu_items`**: Menu catalog items with price, category link, description, image URL, and stock status (`AVAILABLE`, `SOLD_OUT`).
- **`restaurant_tables`**: Physical table registry tracking table number, seating capacity, current status (`EMPTY`, `OCCUPIED`, `RESERVED`), current bill, discount flags, session start timestamps, and `bill_out_requested` flag.
- **`orders`**: Active and archived table orders tracking table number, server name, order type (Dine-in / Takeout), total amount, and lifecycle status (`PENDING`, `IN_PROGRESS`, `READY`, `COMPLETED`, `CANCELLED`).
- **`order_items`**: Itemized lines per order including quantity, item price, individual discount flags, and item preparation status.
- **`customer_requests`**: Self-service guest order batches from QR code ordering. Tracks table number, items JSON, subtotal, status (`PENDING`, `ACCEPTED`, `UNAVAILABLE`, `CANCELLED`), kitchen rejection details, and bill-out requests with customer payment method choice.
- **`ingredients`**: Raw inventory tracking current stock quantity, low-stock threshold, unit of measurement, and unit cost.
- **`recipe_ingredients`**: Relational mapping linking menu items to ingredients for automated recipe-based inventory deductions upon order punch.

---

## 3. Core State & Real-time Architecture

### `AuthContext.jsx`
Manages user authentication and session persistence with Supabase Auth.
- Eagerly initializes session on startup via `supabase.auth.getSession()` to eliminate routing race conditions.
- Subscribes to `onAuthStateChange` for real-time multi-tab session coordination.
- Exposes `user`, `profile`, `isAuthenticated`, `authLoading`, `login`, and `logout`.

### `POSContext.jsx`
The primary operational state engine of the system:
1. **Eager & Fallback Data Synchronization**:
   - Subscribes to Supabase Realtime channels for instant updates on `orders`, `order_items`, `restaurant_tables`, `menu_items`, `ingredients`, and `customer_requests`.
   - Utilizes peer-to-peer WebSocket broadcast events (e.g., `bill-out-requested`) for instant sub-millisecond sync across terminals.
   - Features a 3-second polling fallback ensuring data integrity across network drops or background tab throttling.
2. **Bill-Out & Payment State (`tableBillOutPayments`)**:
   - Tracks customer-requested payment methods (`cash`, `credit`, `qr` / InstaPay QR) per table.
   - Synchronized across browsers via Supabase Realtime broadcast and local storage persistence.
   - Automatically cleaned up when tables are cleared or billed out.
3. **Inventory Auto-Deduction**:
   - Order submission automatically queries `recipe_ingredients` and decrements stock levels in `ingredients`.

---

## 4. UI Sizing & Touch Screen System (`SIZE: Std | Large | XL`)

Servio includes a dedicated UI scaling engine built for touch screen POS terminals (tablets, touch monitors, all-in-one POS units):

- **Scale Modes**:
  - `Std` (Standard layout, high information density)
  - `Large` (+12% to +18% font and button sizing, generous touch targets)
  - `XL` (+25% to +35% font and button sizing, high visibility for wall-mounted or high-pace stations)
- **Non-Scrolling Architecture**:
  - Scaling specifically enlarges typography, interactive badges, touch buttons, and tap targets without introducing full-page scrollbars or breaking flex/grid layouts.
- **Persistence**:
  - Sizing preferences are saved per terminal in `localStorage` (`servio_ui_scale`) and apply immediately on load.
- **Touch-Friendly Modals**:
  - Logout confirmation and critical dialogs feature thickened vertical action buttons designed for fingertip activation.

---

## 5. Thermal Receipt Printing (Standard 80mm Roll Format)

The system includes a dedicated receipt printing pipeline designed specifically for POS thermal printers (Epson, Star Micronics, Rongta, Munbyn, Xprinter, Sunmi, etc.):

1. **Standard 80mm Paper Specifications**:
   - Page dimensions defined as `@page { size: 80mm auto; margin: 0; }`.
   - Printable body constrained to `80mm` width with `4mm 3mm` thermal padding.
   - High-contrast pure black `#000000` on `#ffffff` background with dashed dividers for crisp thermal head burning.
2. **Isolated Print Iframe Engine**:
   - Bypasses parent DOM styling and React tree encapsulation by generating an isolated hidden iframe with thermal-specific HTML/CSS.
   - Eliminates blank paper output caused by SPA layout clipping or print style conflicts.
   - Automatic fallback to `window.print()` if iframe printing is restricted.
3. **Authentic Thermal Content Layout**:
   - **Header**: Store title (`SERVIO`), POS identification, and official receipt label.
   - **Metadata**: Table number, date/time, selected payment method, and completion status.
   - **Itemized Columns**: Formatted columns (`ITEM`, `QTY`, `PRICE`, `TOTAL`) with indented item discount tags.
   - **Totals**: Subtotal, item discounts, table-level discounts, double-dashed divider, and bold grand total.
   - **Footer**: Appreciation message, visit note, and `*** CUSTOMER COPY ***`.
4. **On-Screen Thermal Preview**:
   - Displays an authentic 80mm receipt roll modal (`360px` preview width) with monospace typography before printing.

---

## 6. Application Interfaces

### 🔐 Login Interface (`/login`)
- Authenticates staff via Supabase credentials.
- Persists session and redirects authenticated users to the central selector.

### 🎛️ Interface Selector (`/`)
- Central launcher displaying tiles for Cashier, Kitchen, Waiter, Admin, Inventory, and Restaurant Management.
- Features touch size selector (`Std`, `Large`, `XL`) and secure logout confirmation.

### 🛒 Customer Self-Service Interface (`/customer/:tableId`) — *Public*
- Accessed via table QR codes without staff authentication.
- **Menu Browsing & Search**: Filter by category, real-time search, item customization notes, and quantity selectors.
- **Real-Time Sold-Out Sync**: Sold-out items are visually crossed out and disabled from cart addition.
- **Live Order Tracking**: Displays live preparation progress (`Preparing`, `Ready`, `Food Served`).
- **Bill Out Request Modal**:
  - Once food is served, guests can request the bill and choose their preferred payment method:
    - 💵 **Cash**
    - 💳 **Credit Card**
    - 📱 **InstaPay QR**
  - Confirmed requests immediately alert the cashier and update the guest banner.

### 👨‍🍳 Kitchen Display System (KDS) (`/kitchen/active-orders`)
- Touch-screen order rail displaying incoming tickets in real-time.
- Visual wait timers, item checklist, and one-tap order completion.
- Quick stock drawer to toggle menu item availability (`AVAILABLE` / `SOLD OUT`).

### 💵 Cashier Interface (`/cashier/overview`)
- **Tables Grid**: Overview of all tables with occupancy timers and bill-out alerts (`🧾 QR`, `🧾 Card`, `🧾 Cash`).
- **Counter Menu Ordering**: Full ordering workflow for walk-in or counter service.
- **Order Summary**: Displays detailed charges, applied discounts, and the customer's **Requested Payment Method**.
- **Auto-Selected Bill Out**:
  - Opening the payment modal automatically pre-selects the customer's requested payment method with a `Customer Choice` badge.
  - Supports Cash, Credit Card, and InstaPay QR.
- **80mm Thermal Receipt Printing**: Instant print trigger producing standard 80mm thermal receipts.

### 🍽️ Waiter Interface (`/waiter/menu-ordering`)
- Floor terminal for table-side order entry, table switching, and fast item punching.

### 📋 Restaurant Management (`/restaurant-management/edit-menu`)
- Menu catalog editor for adding, modifying, and pricing menu items and categories.
- Table layout manager for configuring table capacities and counts.

### 📦 Inventory Interface (`/inventory`)
- Stock control dashboard for raw ingredients.
- Low-stock visual thresholds, unit management, and cost tracking.

### 📊 Admin Dashboard (`/admin`)
- Executive performance summary: daily revenue, order volume, occupied tables, and inventory warnings.
- Staff profile management: invite and register staff accounts securely.

### 🤖 AI Protocol Assistant
- Chat assistant accessible to staff for operational and safety guidelines (emergency response, hygiene, complaints).
- Reads protocol documents from `/Protocols` and queries the serverless assistant API.

---

## 7. End-to-End Operational Lifecycle

```mermaid
sequenceDiagram
  autonumber
  actor Guest as Customer (Table QR)
  actor Waiter as Waiter / Staff
  actor Kitchen as Kitchen Staff
  actor Cashier as Cashier
  participant DB as Supabase DB & Realtime

  Guest->>DB: Scan QR, browse menu, place order
  Note over Guest,DB: Order status: PENDING
  DB-->>Kitchen: Realtime ticket alert on KDS
  Kitchen->>DB: Tap "Cook" & "Complete" (READY)
  Waiter->>Guest: Serve food to table
  Guest->>DB: Tap "Request Bill Out" & select Payment Method (QR/Card/Cash)
  DB-->>Cashier: Realtime table badge & summary update
  Cashier->>DB: Click "Bill Out" (auto-selects chosen payment method)
  Cashier->>Cashier: Print 80mm thermal receipt
  DB-->>Guest: Table reset to EMPTY for next party
```

---

## 8. Deployment & Environment Configuration

### Environment Variables

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Client (Vite) | Supabase project endpoint URL. |
| `VITE_SUPABASE_ANON_KEY` | Client (Vite) | Public anonymous key for client requests. |
| `LLM_API_KEY` | Serverless API | Secret API key for AI Protocol Assistant. |
| `LLM_BASE_URL` | Serverless API | (Optional) LLM provider endpoint URL. |
| `LLM_MODEL` | Serverless API | (Optional) Model name (default `gpt-5.4`). |

---

## 10. System-Generated "Best Sellers" Category

### Overview
A permanent, system-generated menu category titled **`🔥 Best Sellers`** is rendered at the top/beginning of all menu views (Customer Mobile & Desktop, Cashier Menu Ordering).

### Dynamics & Features
1. **All-Time Sales Tracking & Category Representation**:
   - Every item ordered or accepted automatically increments its all-time purchase counter.
   - The permanent **"🔥 Best Sellers"** category aggregates the **top 3 items from each category** (Food, Drinks, Desserts, Appetizers, etc.), ensuring balanced representation across the full menu.
   - Only the single overall **`#1 Best Seller`** across all categories is labeled with the rank badge in the Best Sellers category.
2. **Category-Specific #1 Best Seller Indication**:
   - When browsing any specific category (e.g. Food, Drinks, Desserts, Appetizers), the single #1 best-selling item of that specific category is also indicated with the prominent **`🔥 #1 Best Seller · [count] sold`** badge and golden card highlight.
   - Other items within the category are displayed without rank numbers.
3. **Prominent Glowing Aura**:
   - Styled with radiant amber gradients (`linear-gradient(135deg, #f59e0b 0%, #ea580c 45%, #e11d48 100%)`) and continuous dual CSS keyframe animations (`customer-bestseller-glow` and `customer-bestseller-shimmer`).
   - Features elevated padding, high-contrast typography, and a glowing star indicator (`★`), ensuring maximum visual prominence.
3. **Admin Clear / Reset Control**:
   - Located in the Admin Dashboard (`/admin`), the **"🔥 Clear Best Sellers"** button allows administrators to clear all sales counters with a dedicated confirmation modal.
   - Broadcasts `best-sellers-reset` via Supabase Realtime WebSocket to synchronize across all connected cashier and customer devices immediately.
   - When cleared, interfaces display a clean empty state until new orders are placed.
   - Includes a **"Restore Defaults"** control in Admin for testing.

---

## 11. Customer Interface Mobile Layout

### Key Rules & Behaviors
1. **Sidebar Actions in Mobile Mode**:
   - On screens `<= 900px`, the right sidebar stacks below the menu grid.
   - Action buttons ("✓ Mark Pending", "🧾 Request Bill Out", and "Food has been served!") inside `.customer-sidebar` are hidden via `display: none !important;` to avoid clutter and redundancy.
   - All order placement and billing requests on mobile are exclusively handled by the fixed bottom mobile bar (`.customer-mobile-bar`).
2. **Live Order Tracking**:
   - Positioned cleanly at the top of the stacked sidebar directly below the menu, with zero gap above it.
   - A sticky header badge (`🍳 [count]/[total] ready ↓`) appears in the topbar on mobile when active orders exist, allowing customers to tap and scroll smoothly to live tracking.
   - The stacked sidebar has dynamic bottom padding (`max(220px, calc(180px + env(safe-area-inset-bottom)))`) ensuring the fixed bottom bar never overlaps cart items or order tracking details.
