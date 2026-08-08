# Servio POS System Documentation

This document provides a comprehensive overview of the Servio Point-of-Sale (POS) system. It explains the architecture, database schema, state management, and how each interface functions.

---

## 1. System Architecture

Servio is a real-time, web-based POS system built with modern web technologies:
- **Frontend**: React (bootstrapped with Vite) for building the user interfaces.
- **Routing**: `react-router-dom` for navigation between different interfaces (Waiter, Cashier, etc.).
- **Backend/Database**: Supabase (PostgreSQL) handles data persistence, authentication, and real-time data synchronization.
- **State Management**: React Context API (`POSContext.jsx`) acts as the central hub, managing state and coordinating API calls.

---

## 2. Database Schema

The system relies on a relational database hosted on Supabase. Here are the primary entities:

- **`profiles`**: Stores user/staff information, their roles (e.g., Admin, Cashier, Waiter), and account status.
- **`categories`**: Menu categories (e.g., Meals, Drinks, Desserts).
- **`menu_items`**: The items available for order. Linked to `categories`. Includes price, description, and status.
- **`restaurant_tables`**: Represents physical tables. Tracks their status (`EMPTY`, `OCCUPIED`, `RESERVED`), current guest count, and since when they've been occupied.
- **`orders`**: A group of items ordered for a specific table. Tracks the server, order type (Dine-in/Takeout), total amount, and status (`PENDING`, `IN_PROGRESS`, `READY`, `COMPLETED`, `CANCELLED`).
- **`order_items`**: The individual items within an order. Tracks quantity, historical price, and specific item status.
- **`ingredients`**: Inventory items used to prepare menu items. Tracks stock levels, low-stock thresholds, units, and cost.
- **`recipe_ingredients`**: (Future expansion) Maps `menu_items` to `ingredients` to automatically deduct stock when an item is ordered.

---

## 3. Core State & Logic (`POSContext.jsx`)

`POSContext.jsx` is the "brain" of the frontend. It connects to Supabase and provides data and functions to the rest of the app via the `usePOS()` hook.

### Key Responsibilities:
1. **Data Fetching**: Loads all initial data (tables, menu items, orders, inventory) when the app starts.
2. **Real-time Subscriptions**: Listens for changes in the Supabase database. If another terminal updates an order or table, the context instantly updates the local state, ensuring all screens (Waiter, Kitchen, Cashier) stay perfectly in sync.
3. **Exposed Functions**: Provides helper functions that interfaces call to modify data.

### Core Functions provided by `usePOS()`:
- `createOrder(tableNumber, serverName, items, orderType)`: Punches a new order.
- `addItemsToOrder(orderId, newItems)`: Adds more items to an existing active order.
- `updateOrderStatus(orderId, status)`: Moves an order through its lifecycle (e.g., used by the Kitchen).
- `billOutTable(tableNumber)`: Completes all active orders for a table and resets the table to `EMPTY`.
- `addMenuItem()`, `updateMenuItem()`, `deleteMenuItem()`: Menu management CRUD operations.
- `addCategory()`, `updateCategory()`, `deleteCategory()`: Category management CRUD operations.
- `addIngredient()`, `updateIngredient()`, `deleteIngredient()`: Inventory management CRUD operations.

---

## 4. Application Interfaces (What Stuff Does)

The application is split into specialized interfaces designed for different staff roles.

### 🍽️ Waiter Interface (`/waiter/menu-ordering`)
**Purpose**: For floor staff to take orders directly at the table.
- **Functionality**: 
  - Browse the menu by category or search.
  - Add items to a local cart.
  - "Punch Order" sends the cart to the database and alerts the kitchen.
  - Switch between tables to handle multiple guests simultaneously.
- **Data Flow**: Reads menu data; Writes to `orders` and `order_items` (via `createOrder`).

### 👨‍🍳 Kitchen Interface (`/kitchen/active-orders`)
**Purpose**: For kitchen staff to see what needs to be cooked.
- **Functionality**:
  - Displays incoming tickets in real-time.
  - Tracks how long an order has been waiting.
  - Mark orders as "Complete" (food is ready) or "Cancel" (if an item is unavailable).
- **Data Flow**: Reads active `orders`; Writes status updates (via `updateOrderStatus`).

### 💵 Cashier Interface (`/cashier/overview`)
**Purpose**: For processing payments, adding items at the counter, and printing receipts.
- **Functionality**:
  - **Overview Tab**: Shows a bird's-eye view of all tables, indicating which are occupied and their current bill totals.
  - **Menu Ordering Tab**: Functions identically to the Waiter interface for taking counter orders.
  - **Billing**: Apply custom or preset discounts (PWD, Senior), select payment methods (Cash, Credit, QR), bill out tables, and print receipts.
- **Data Flow**: Full read/write access to orders and tables. Bills out tables (via `billOutTable`).

### 📋 Restaurant Management (`/restaurant-management`)
**Purpose**: For managers to configure the restaurant setup.
- **Functionality**:
  - **Edit Menu**: Add, update, or remove menu items and categories.
  - **Manage Tables**: Adjust the total number of tables in the restaurant and manually override table statuses if necessary.
- **Data Flow**: CRUD operations on `menu_items`, `categories`, and `restaurant_tables`.

### 📦 Inventory Interface (`/inventory`)
**Purpose**: To track raw ingredients and stock levels.
- **Functionality**:
  - View all ingredients, their current stock, and cost.
  - Visual indicators for items that fall below their "Low Stock Threshold".
  - Add, edit, or remove ingredients.
- **Data Flow**: CRUD operations on the `ingredients` table.

### 📊 Admin Dashboard (`/admin`)
**Purpose**: For owners/admins to get a high-level overview of business performance.
- **Functionality**:
  - Real-time statistics: Today's revenue, active/completed order counts, occupied tables.
  - Quick alerts for low inventory stock.
  - View a log of recent orders.
  - View registered staff profiles.
- **Data Flow**: Primarily read-only, aggregating data across multiple tables for reporting.

---

## 5. The Core Workflow (Order Lifecycle)

Here is how data flows through the system during a typical customer visit:

1. **Ordering**: A Waiter takes an order and presses **"Punch Order"**.
2. **Database Update**: The system creates an `order` (status: `PENDING`) and `order_items` in Supabase. It updates the table status to `OCCUPIED`.
3. **Kitchen Sync**: Supabase broadcasts the new order. The **Kitchen Interface** instantly receives the ticket.
4. **Cooking**: Kitchen staff prepare the food. Once done, they click **"Complete"** on the ticket. The order status changes to `READY`.
5. **Payment**: The customer is ready to pay. The Cashier selects the table on the **Cashier Interface**, applies any discounts, and clicks **"Bill Out"**.
6. **Completion**: The system marks all orders for that table as `COMPLETED` and resets the table status back to `EMPTY`, making it available for the next customer.
