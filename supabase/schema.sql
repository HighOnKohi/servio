-- ============================================================
-- VELOCITY POS — Supabase Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- ENUM TYPES ----------
CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'STUDENT');
CREATE TYPE item_status AS ENUM ('ACTIVE', 'SOLD OUT');
CREATE TYPE table_status AS ENUM ('EMPTY', 'OCCUPIED', 'RESERVED');
CREATE TYPE order_status AS ENUM ('PENDING', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');
CREATE TYPE order_item_status AS ENUM ('PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED');
CREATE TYPE order_type AS ENUM ('DINE-IN', 'TAKEOUT');

-- ---------- PROFILES ----------
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  role user_role NOT NULL DEFAULT 'STUDENT',
  status TEXT NOT NULL DEFAULT 'Active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- CATEGORIES ----------
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- MENU ITEMS ----------
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  status item_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- RESTAURANT TABLES ----------
CREATE TABLE restaurant_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 4,
  status table_status NOT NULL DEFAULT 'EMPTY',
  current_bill NUMERIC(10,2) NOT NULL DEFAULT 0,
  guests_count INTEGER NOT NULL DEFAULT 0,
  occupied_since TIMESTAMPTZ
);

-- ---------- ORDERS ----------
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number INTEGER REFERENCES restaurant_tables(table_number),
  server_name TEXT,
  order_type order_type NOT NULL DEFAULT 'DINE-IN',
  status order_status NOT NULL DEFAULT 'PENDING',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- ORDER ITEMS ----------
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL,
  modifiers JSONB DEFAULT '[]'::JSONB,
  status order_item_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- INGREDIENTS (Inventory) ----------
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL DEFAULT 'pcs',
  stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 10,
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- RECIPE INGREDIENTS (links menu items → ingredients) ----------
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_needed NUMERIC(10,2) NOT NULL DEFAULT 1,
  UNIQUE(menu_item_id, ingredient_id)
);

-- ---------- INDEXES ----------
CREATE INDEX idx_orders_table ON orders(table_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_status ON menu_items(status);
CREATE INDEX idx_recipe_ingredients_menu ON recipe_ingredients(menu_item_id);
CREATE INDEX idx_recipe_ingredients_ing ON recipe_ingredients(ingredient_id);

-- ---------- ROW LEVEL SECURITY ----------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Allow ALL access for anon role (demo/thesis — no real auth)
CREATE POLICY "anon_all" ON profiles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON menu_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON restaurant_tables FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON order_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON ingredients FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON recipe_ingredients FOR ALL TO anon USING (true) WITH CHECK (true);

-- Also keep authenticated policies for completeness
CREATE POLICY "auth_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON recipe_ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- ENABLE REALTIME ----------
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;

-- ---------- SEED DATA ----------
INSERT INTO categories (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Appetizers'),
  ('00000000-0000-0000-0000-000000000002', 'Mains'),
  ('00000000-0000-0000-0000-000000000003', 'Desserts'),
  ('00000000-0000-0000-0000-000000000004', 'Beverages');

INSERT INTO restaurant_tables (table_number, capacity) VALUES
  (1, 4), (2, 2), (3, 6), (4, 4), (5, 2),
  (6, 8), (7, 4), (8, 2), (9, 6), (10, 4),
  (11, 2), (12, 4);
