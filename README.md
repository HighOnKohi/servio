# Servio — Modern Restaurant Point of Sale System

Servio is a real-time, touch-optimized web Point of Sale (POS) and restaurant management system. Designed for dynamic restaurant environments, Servio connects floor staff, kitchen operations, cashiers, administrators, and dining guests into a synchronized operational ecosystem.

---

## Key Features

- **Multi-Terminal Role Architecture**:
  - **💵 Cashier Terminal**: Bird's-eye table grid, live occupancy timers, discount management, order punching, customer bill-out alerts, and payment checkout.
  - **👨‍🍳 Kitchen Display System (KDS)**: Real-time incoming ticket rail, item checklists, wait timers, one-tap order completion, and live stock toggling (`AVAILABLE` / `SOLD OUT`).
  - **🛒 Customer Self-Service (QR Code)**: Mobile-responsive menu browsing, live preparation progress, sold-out item indicators, and table bill-out request with payment method selection (**Cash**, **Credit Card**, **InstaPay QR**).
  - **🍽️ Waiter Terminal**: Mobile and tablet table-side order entry and item punching.
  - **📊 Admin Dashboard**: Daily sales metrics, active table metrics, inventory low-stock alerts, and staff account management.
  - **📦 Inventory Management**: Ingredient tracking, unit costs, and low-stock threshold monitoring.
  - **📋 Restaurant Management**: Menu catalog editor, item pricing, category management, and physical table layout configuration.
  - **🤖 AI Protocol Assistant**: Natural language assistant providing instant guidance on restaurant safety, hygiene, and emergency protocols.

- **Touch Screen UI Scaling (`SIZE: Std | Large | XL`)**:
  - Universal size selector built for POS hardware and touch screens.
  - Non-scrolling scaling architecture: enlarges typography, touch buttons, and tap targets proportionally without introducing full-page scrollbars.
  - Sizing preferences persist locally across reloads (`localStorage`).

- **Real-Time Synchronization**:
  - Powered by Supabase PostgreSQL Realtime subscriptions (`postgres_changes`) and sub-millisecond WebSocket peer broadcasting.
  - Instant updates when tickets are punched, items marked sold out, or bill-out requests placed.

- **Standard 80mm Thermal Receipt Printing**:
  - Direct 80mm thermal roll print engine using an isolated print iframe to eliminate blank page output.
  - Formatted strictly to standard thermal roll dimensions (`@page { size: 80mm auto; margin: 0; }`).
  - High-contrast pure black layout with itemized pricing, discount lines, grand total, and customer copy footer.
  - Realistic on-screen thermal ticket preview.

---

## Tech Stack

- **Frontend**: React 18, Vite
- **Styling**: Vanilla CSS with CSS custom properties, container queries, and responsive grid layouts
- **Routing**: `react-router-dom` v6
- **Backend & Database**: Supabase (PostgreSQL, Realtime WebSockets, Authentication)
- **Serverless API**: Vercel Serverless Functions (`/api/protocol-assistant`)
- **Hosting**: Vercel

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)
- A [Supabase](https://supabase.com/) project with the Servio schema applied

### Environment Configuration

Create a `.env.local` file in the project root with the following variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional (for AI Protocol Assistant):
LLM_API_KEY=your-llm-api-key
LLM_BASE_URL=https://apimaster.ai/v1
LLM_MODEL=gpt-5.4
```

### Installation & Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to:
   - **Staff Interface**: `http://localhost:5173/`
   - **Customer Self-Service (e.g. Table 02)**: `http://localhost:5173/customer/2`

### Production Build

To build the static production bundle:

```bash
npm run build
```

The compiled bundle will be output to the `dist/` directory.

---

## Detailed Documentation

For an in-depth architectural breakdown, database entity relationships, route definitions, and end-to-end operational lifecycles, please refer to:

📖 **[SYSTEM_DOCUMENTATION.md](./SYSTEM_DOCUMENTATION.md)**
