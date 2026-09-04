-- ============================================================
-- SERVIO POS — Comprehensive Supabase Database Schema & Seed Data
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- ENUM TYPES ----------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'STUDENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE item_status AS ENUM ('ACTIVE', 'SOLD OUT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE table_status AS ENUM ('EMPTY', 'OCCUPIED', 'RESERVED', 'REQUEST');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE order_item_status AS ENUM ('PENDING', 'COOKING', 'ACTIVE', 'READY', 'SERVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE order_type AS ENUM ('DINE-IN', 'TAKEOUT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE customer_request_status AS ENUM (
    'PENDING',
    'PENDING_KITCHEN',
    'PENDING_CASHIER',
    'ACCEPTED',
    'UNAVAILABLE',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- PROFILES (Staff & Accounts) ----------
CREATE TABLE IF NOT EXISTS profiles (
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
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- MENU ITEMS ----------
CREATE TABLE IF NOT EXISTS menu_items (
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
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 4,
  status table_status NOT NULL DEFAULT 'EMPTY',
  current_bill NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_bill NUMERIC(10,2) NOT NULL DEFAULT 0,
  guests_count INTEGER NOT NULL DEFAULT 0,
  occupied_since TIMESTAMPTZ,
  reserved_since TIMESTAMPTZ,
  pwd_discount BOOLEAN NOT NULL DEFAULT FALSE,
  senior_discount BOOLEAN NOT NULL DEFAULT FALSE,
  percent_discount NUMERIC(5,2) NOT NULL DEFAULT 0,
  float_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  bill_out_requested BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------- ORDERS ----------
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number INTEGER REFERENCES restaurant_tables(table_number) ON DELETE SET NULL,
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
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL,
  modifiers JSONB DEFAULT '[]'::JSONB,
  notes TEXT,
  status order_item_status NOT NULL DEFAULT 'PENDING',
  pwd_discount BOOLEAN NOT NULL DEFAULT FALSE,
  senior_discount BOOLEAN NOT NULL DEFAULT FALSE,
  percent_discount NUMERIC(5,2) NOT NULL DEFAULT 0,
  float_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- CUSTOMER REQUESTS (Order Verification Flow) ----------
CREATE TABLE IF NOT EXISTS customer_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number INTEGER NOT NULL REFERENCES restaurant_tables(table_number) ON DELETE CASCADE,
  status customer_request_status NOT NULL DEFAULT 'PENDING',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  unavailable_items JSONB DEFAULT '[]'::JSONB,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- ---------- CUSTOMER REQUEST ITEMS (Normalized Request Details) ----------
CREATE TABLE IF NOT EXISTS customer_request_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES customer_requests(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- INGREDIENTS (Inventory) ----------
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL DEFAULT 'pcs',
  stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 10,
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- RECIPE INGREDIENTS (Bill of Materials) ----------
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_needed NUMERIC(10,2) NOT NULL DEFAULT 1,
  UNIQUE(menu_item_id, ingredient_id)
);

-- ---------- PROTOCOLS (SOPs & Operational Guidelines for Assistant) ----------
CREATE TABLE IF NOT EXISTS protocols (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- HELPER FUNCTION: AUTO-UPDATE updated_at ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON menu_items;
CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ingredients_updated_at ON ingredients;
CREATE TRIGGER trg_ingredients_updated_at BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_protocols_updated_at ON protocols;
CREATE TRIGGER trg_protocols_updated_at BEFORE UPDATE ON protocols
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- INDEXES FOR HIGH QUERY PERFORMANCE ----------
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_status ON menu_items(status);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_menu ON recipe_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ing ON recipe_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_customer_requests_table ON customer_requests(table_number);
CREATE INDEX IF NOT EXISTS idx_customer_requests_status ON customer_requests(status);
CREATE INDEX IF NOT EXISTS idx_customer_req_items_request ON customer_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_protocols_title ON protocols(title);

-- ---------- ROW LEVEL SECURITY (RLS) ----------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted access for anon role (convenient for local development & POS stations)
DROP POLICY IF EXISTS "anon_all_profiles" ON profiles;
CREATE POLICY "anon_all_profiles" ON profiles FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_categories" ON categories;
CREATE POLICY "anon_all_categories" ON categories FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_menu_items" ON menu_items;
CREATE POLICY "anon_all_menu_items" ON menu_items FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_tables" ON restaurant_tables;
CREATE POLICY "anon_all_tables" ON restaurant_tables FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_orders" ON orders;
CREATE POLICY "anon_all_orders" ON orders FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_order_items" ON order_items;
CREATE POLICY "anon_all_order_items" ON order_items FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_customer_requests" ON customer_requests;
CREATE POLICY "anon_all_customer_requests" ON customer_requests FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_customer_req_items" ON customer_request_items;
CREATE POLICY "anon_all_customer_req_items" ON customer_request_items FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_ingredients" ON ingredients;
CREATE POLICY "anon_all_ingredients" ON ingredients FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "anon_all_recipe_ingredients" ON recipe_ingredients FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_protocols" ON protocols;
CREATE POLICY "anon_all_protocols" ON protocols FOR ALL TO anon USING (true) WITH CHECK (true);

-- Authenticated policies (production auth)
DROP POLICY IF EXISTS "auth_all_profiles" ON profiles;
CREATE POLICY "auth_all_profiles" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_categories" ON categories;
CREATE POLICY "auth_all_categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_menu_items" ON menu_items;
CREATE POLICY "auth_all_menu_items" ON menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_tables" ON restaurant_tables;
CREATE POLICY "auth_all_tables" ON restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_orders" ON orders;
CREATE POLICY "auth_all_orders" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_order_items" ON order_items;
CREATE POLICY "auth_all_order_items" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_customer_requests" ON customer_requests;
CREATE POLICY "auth_all_customer_requests" ON customer_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_customer_req_items" ON customer_request_items;
CREATE POLICY "auth_all_customer_req_items" ON customer_request_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_ingredients" ON ingredients;
CREATE POLICY "auth_all_ingredients" ON ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "auth_all_recipe_ingredients" ON recipe_ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_protocols" ON protocols;
CREATE POLICY "auth_all_protocols" ON protocols FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- REALTIME REPLICATION SETUP ----------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE categories;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE customer_requests;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE protocols;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- SEED DATA SAMPLES
-- ============================================================

-- 1. Sample Staff Profiles
INSERT INTO profiles (id, full_name, email, role, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Admin Officer', 'admin@servio.local', 'ADMIN', 'Active'),
  ('22222222-2222-2222-2222-222222222222', 'Maria Santos (Cashier)', 'cashier@servio.local', 'CASHIER', 'Active'),
  ('33333333-3333-3333-3333-333333333333', 'Chef Juan Dela Cruz', 'kitchen@servio.local', 'KITCHEN', 'Active'),
  ('44444444-4444-4444-4444-444444444444', 'Carlos Reyes (Waiter)', 'waiter@servio.local', 'WAITER', 'Active')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

-- 2. Restaurant Tables (with capacities / PAX)
INSERT INTO restaurant_tables (table_number, capacity, status) VALUES
  (1, 4, 'EMPTY'),
  (2, 2, 'EMPTY'),
  (3, 6, 'EMPTY'),
  (4, 4, 'EMPTY'),
  (5, 2, 'EMPTY'),
  (6, 8, 'EMPTY'),
  (7, 4, 'EMPTY'),
  (8, 2, 'EMPTY'),
  (9, 6, 'EMPTY'),
  (10, 4, 'EMPTY'),
  (11, 2, 'EMPTY'),
  (12, 8, 'EMPTY')
ON CONFLICT (table_number) DO UPDATE SET
  capacity = EXCLUDED.capacity;

-- 3. Menu Categories
INSERT INTO categories (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Appetizers'),
  ('00000000-0000-0000-0000-000000000002', 'Mains'),
  ('00000000-0000-0000-0000-000000000003', 'Desserts'),
  ('00000000-0000-0000-0000-000000000004', 'Beverages')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

-- 4. Menu Items
INSERT INTO menu_items (id, category_id, name, description, price, status) VALUES
  -- Appetizers
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Sizzling Pork Sisig', 'Crispy pork bits tossed with onions, chili, and calamansi served on a hot plate.', 220.00, 'ACTIVE'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Lumpiang Shanghai', 'Golden fried pork spring rolls served with homemade sweet and sour dip.', 180.00, 'ACTIVE'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Calamares Frittos', 'Crispy deep-fried squid rings served with garlic aioli.', 250.00, 'ACTIVE'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Tokwa''t Baboy', 'Crispy tofu and tender pork slices steeped in seasoned soy-vinegar dressing.', 160.00, 'ACTIVE'),

  -- Mains
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Crispy Pata', 'Deep-fried pork knuckle with crackling skin and tender meat served with spiced dip.', 650.00, 'ACTIVE'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Beef Kare-Kare', 'Slow-braised beef shank and vegetables in rich peanut sauce with bagoong.', 420.00, 'ACTIVE'),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Chicken Inasal', 'Grilled chicken thigh marinated in lemongrass, calamansi, and annatto oil.', 240.00, 'ACTIVE'),
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'Sinigang na Baboy', 'Classic sour tamarind broth with pork belly cuts, kangkong, and radish.', 360.00, 'ACTIVE'),
  ('b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'Lechon Kawali', 'Crispy deep-fried pork belly slabs with liver sauce and spiced vinegar.', 320.00, 'ACTIVE'),

  -- Desserts
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Special Halo-Halo', 'Shaved ice with sweetened beans, ube halaya, leche flan, and creamy milk.', 140.00, 'ACTIVE'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Creamy Leche Flan', 'Rich steamed caramel custard with golden sugar syrup.', 120.00, 'ACTIVE'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Turon with Vanilla Ice Cream', 'Caramelized banana spring rolls served hot with a scoop of vanilla ice cream.', 110.00, 'ACTIVE'),

  -- Beverages
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'Fresh Calamansi Juice', 'Chilled native calamansi extract sweetened with wild honey.', 85.00, 'ACTIVE'),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'Sago''t Gulaman', 'Refreshing brown sugar iced beverage with chewy tapioca pearls and gelatin.', 90.00, 'ACTIVE'),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'San Miguel Pale Pilsen', 'Classic ice-cold Philippine lager beer (330ml bottle).', 95.00, 'ACTIVE'),
  ('d0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'House Blend Iced Tea', 'Brewed black tea infused with lemon and mint.', 75.00, 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  status = EXCLUDED.status;

-- 5. Inventory Ingredients
INSERT INTO ingredients (id, name, unit, stock, low_stock_threshold, cost_per_unit) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'Pork Belly', 'kg', 35.0, 8.0, 320.00),
  ('e0000000-0000-0000-0000-000000000002', 'Pork Knuckle (Pata)', 'pcs', 15.0, 4.0, 450.00),
  ('e0000000-0000-0000-0000-000000000003', 'Beef Shank', 'kg', 20.0, 5.0, 420.00),
  ('e0000000-0000-0000-0000-000000000004', 'Chicken Thigh Quarter', 'kg', 28.0, 6.0, 210.00),
  ('e0000000-0000-0000-0000-000000000005', 'Fresh Squid', 'kg', 12.0, 3.0, 340.00),
  ('e0000000-0000-0000-0000-000000000006', 'Firm Tofu', 'blocks', 40.0, 10.0, 25.00),
  ('e0000000-0000-0000-0000-000000000007', 'Spring Roll Wrappers', 'packs', 25.0, 5.0, 45.00),
  ('e0000000-0000-0000-0000-000000000008', 'Peanut Butter Paste', 'kg', 14.0, 3.0, 180.00),
  ('e0000000-0000-0000-0000-000000000009', 'Tamarind Soup Base', 'packs', 50.0, 12.0, 35.00),
  ('e0000000-0000-0000-0000-000000000010', 'Calamansi Fresh', 'kg', 18.0, 4.0, 90.00),
  ('e0000000-0000-0000-0000-000000000011', 'Garlic', 'kg', 22.0, 5.0, 130.00),
  ('e0000000-0000-0000-0000-000000000012', 'Red Onion', 'kg', 25.0, 5.0, 120.00),
  ('e0000000-0000-0000-0000-000000000013', 'Cooking Oil', 'L', 45.0, 10.0, 85.00),
  ('e0000000-0000-0000-0000-000000000014', 'Soy Sauce Premium', 'L', 30.0, 6.0, 55.00),
  ('e0000000-0000-0000-0000-000000000015', 'Cane Vinegar', 'L', 30.0, 6.0, 50.00),
  ('e0000000-0000-0000-0000-000000000016', 'Evaporated Milk', 'cans', 60.0, 15.0, 38.00),
  ('e0000000-0000-0000-0000-000000000017', 'Shaved Ice Base', 'kg', 80.0, 20.0, 15.00),
  ('e0000000-0000-0000-0000-000000000018', 'Saba Banana', 'kg', 20.0, 5.0, 65.00),
  ('e0000000-0000-0000-0000-000000000019', 'San Miguel Beer Bottles', 'bottles', 72.0, 24.0, 58.00)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  stock = EXCLUDED.stock,
  cost_per_unit = EXCLUDED.cost_per_unit;

-- 6. Recipe Ingredients (Linking menu items to inventory deduction)
INSERT INTO recipe_ingredients (menu_item_id, ingredient_id, quantity_needed) VALUES
  -- Sisig -> Pork Belly, Garlic, Onion, Calamansi, Oil
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 0.25),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000011', 0.03),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000012', 0.05),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000010', 0.03),
  -- Lumpia -> Pork Belly (minced), Wrapper, Oil
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 0.20),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000007', 0.30),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000013', 0.10),
  -- Crispy Pata -> Pork Knuckle, Garlic, Oil
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 1.00),
  ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000013', 0.40),
  -- Beef Kare-Kare -> Beef Shank, Peanut Paste
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 0.35),
  ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000008', 0.12),
  -- Calamansi Juice -> Fresh Calamansi
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000010', 0.10),
  -- Pale Pilsen -> Beer Bottle
  ('d0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000019', 1.00)
ON CONFLICT (menu_item_id, ingredient_id) DO UPDATE SET
  quantity_needed = EXCLUDED.quantity_needed;

-- 7. Default Operational Protocols (for Assistant & Staff Reference)
INSERT INTO protocols (title, content) VALUES
  ('Medical Emergency Protocol',
   '1. Stay calm. Assess the situation quickly: Is the guest conscious? Are they breathing? Do they appear in severe distress?
2. Call 911 immediately if the guest shows chest pain, breathing difficulties, loss of consciousness, or uncontrollable bleeding.
3. Assign one staff member to stay with the guest at all times.
4. Notify the shift lead or manager immediately.
5. Direct emergency responders upon arrival and submit a full incident report.'),

  ('Fire Emergency Protocol',
   '1. Remain calm. Alert all staff and guests immediately.
2. Pull the nearest fire alarm station.
3. Call 911 and state the restaurant address clearly.
4. Guide guests toward the nearest emergency exits; avoid elevators.
5. Assemble at the designated outdoor evacuation muster point and conduct headcount.'),

  ('Allergic Reaction Protocol',
   '1. Ask the guest if they have an EpiPen and assist them in retrieving it if requested.
2. Call 911 immediately if breathing difficulty, throat tightness, or facial swelling is observed.
3. Retain the dish served and packaging for allergen tracing.
4. Keep the guest calm and seated; do not offer water or food.'),

  ('Food Contamination Protocol',
   '1. Stop serving the suspected batch or dish immediately.
2. Label and quarantine remaining food in the walk-in refrigerator for lab/inspection testing.
3. Inform the Head Chef and General Manager immediately.
4. Inspect ingredient batch numbers, delivery dates, and storage temperatures.'),

  ('Cash Handling and Register Protocol',
   '1. Verify float balance at the start and end of every shift.
2. Count customer cash payments in plain view and call out the tendered amount.
3. Keep the cash drawer locked whenever stepping away from the register.
4. Perform supervisor drops whenever drawer exceeds maximum cash limit.')
ON CONFLICT (title) DO UPDATE SET
  content = EXCLUDED.content;

-- 8. Supabase Storage Configuration for Menu Item Images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-items',
  'menu-items',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access for menu-items bucket'
  ) THEN
    CREATE POLICY "Public Access for menu-items bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'menu-items');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow upload to menu-items bucket'
  ) THEN
    CREATE POLICY "Allow upload to menu-items bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'menu-items');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow update to menu-items bucket'
  ) THEN
    CREATE POLICY "Allow update to menu-items bucket"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'menu-items')
    WITH CHECK (bucket_id = 'menu-items');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow delete from menu-items bucket'
  ) THEN
    CREATE POLICY "Allow delete from menu-items bucket"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'menu-items');
  END IF;
END $$;
