import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../lib/supabaseClient";

const POSContext = createContext(null);

const TAX_RATE = 0.12; // 12% VAT for Philippines
const CURRENCY = "₱";

export function POSProvider({ children }) {
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Refetch helpers ---
  const refetchTables = useCallback(async () => {
    const { data } = await supabase
      .from("restaurant_tables")
      .select("*")
      .order("table_number");
    if (data) setTables(data);
  }, []);

  const refetchMenu = useCallback(async () => {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .order("name");
    if (data) setMenuItems(data);
  }, []);

  const refetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (data) setCategories(data);
  }, []);

  const refetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOrders(data);
  }, []);

  const refetchOrderItems = useCallback(async () => {
    const { data } = await supabase.from("order_items").select("*");
    if (data) setOrderItems(data);
  }, []);

  const refetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    if (data) setProfiles(data);
  }, []);

  const refetchIngredients = useCallback(async () => {
    const { data } = await supabase
      .from("ingredients")
      .select("*")
      .order("name");
    if (data) setIngredients(data);
  }, []);

  const refetchRecipeIngredients = useCallback(async () => {
    const { data } = await supabase.from("recipe_ingredients").select("*");
    if (data) setRecipeIngredients(data);
  }, []);

  // Fetch all on mount
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      await Promise.all([
        refetchTables(),
        refetchMenu(),
        refetchCategories(),
        refetchOrders(),
        refetchOrderItems(),
        refetchProfiles(),
        refetchIngredients(),
        refetchRecipeIngredients(),
      ]);
      setLoading(false);
    }
    fetchAll();
  }, [
    refetchTables,
    refetchMenu,
    refetchCategories,
    refetchOrders,
    refetchOrderItems,
    refetchProfiles,
    refetchIngredients,
    refetchRecipeIngredients,
  ]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("pos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => refetchOrders(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => refetchOrderItems(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_tables" },
        () => refetchTables(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => refetchMenu(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ingredients" },
        () => refetchIngredients(),
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [
    refetchOrders,
    refetchOrderItems,
    refetchTables,
    refetchMenu,
    refetchIngredients,
  ]);

  // ---- Inventory: deduct stock ----
  const deductIngredients = useCallback(
    async (cartItems) => {
      // For each cart item, find recipe_ingredients and deduct stock
      for (const item of cartItems) {
        const menuItemId = item.id || item.menu_item_id;
        if (!menuItemId) continue;
        const recipes = recipeIngredients.filter(
          (ri) => ri.menu_item_id === menuItemId,
        );
        for (const recipe of recipes) {
          const qty = recipe.quantity_needed * (item.quantity || 1);
          // Decrement stock
          const ing = ingredients.find((i) => i.id === recipe.ingredient_id);
          if (ing) {
            const newStock = Math.max(0, Number(ing.stock) - qty);
            await supabase
              .from("ingredients")
              .update({ stock: newStock, updated_at: new Date().toISOString() })
              .eq("id", recipe.ingredient_id);
          }
        }
      }
      await refetchIngredients();
    },
    [recipeIngredients, ingredients, refetchIngredients],
  );

  // ---- Table management ----
  const addTable = useCallback(
    async (tableNumber, capacity = 4) => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .insert({
          table_number: tableNumber,
          capacity,
          status: "EMPTY",
          current_bill: 0,
          guests_count: 0,
        })
        .select()
        .single();
      if (!error) await refetchTables();
      return { data, error };
    },
    [refetchTables],
  );

  const removeTable = useCallback(
    async (tableId) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .delete()
        .eq("id", tableId);
      if (!error) await refetchTables();
      return { error };
    },
    [refetchTables],
  );

  // ---- Menu operations ----
  const addMenuItem = useCallback(
    async (item) => {
      const { data } = await supabase
        .from("menu_items")
        .insert(item)
        .select()
        .single();
      await refetchMenu();
      return data;
    },
    [refetchMenu],
  );

  const updateMenuItem = useCallback(
    async (itemId, updates) => {
      await supabase.from("menu_items").update(updates).eq("id", itemId);
      await refetchMenu();
    },
    [refetchMenu],
  );

  const deleteMenuItem = useCallback(
    async (itemId) => {
      await supabase.from("menu_items").delete().eq("id", itemId);
      await refetchMenu();
    },
    [refetchMenu],
  );

  const addCategory = useCallback(
    async (name) => {
      const { data } = await supabase
        .from("categories")
        .insert({ name })
        .select()
        .single();
      await refetchCategories();
      return data;
    },
    [refetchCategories],
  );

  // ---- Ingredient / recipe operations ----
  const addIngredient = useCallback(
    async (ingredient) => {
      const { data, error } = await supabase
        .from("ingredients")
        .insert(ingredient)
        .select()
        .single();
      if (!error) await refetchIngredients();
      return { data, error };
    },
    [refetchIngredients],
  );

  const updateIngredient = useCallback(
    async (id, updates) => {
      await supabase
        .from("ingredients")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      await refetchIngredients();
    },
    [refetchIngredients],
  );

  const deleteIngredient = useCallback(
    async (id) => {
      await supabase.from("ingredients").delete().eq("id", id);
      await refetchIngredients();
    },
    [refetchIngredients],
  );

  const addRecipeIngredient = useCallback(
    async (menuItemId, ingredientId, quantityNeeded) => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .insert({
          menu_item_id: menuItemId,
          ingredient_id: ingredientId,
          quantity_needed: quantityNeeded,
        })
        .select()
        .single();
      if (!error) await refetchRecipeIngredients();
      return { data, error };
    },
    [refetchRecipeIngredients],
  );

  const removeRecipeIngredient = useCallback(
    async (id) => {
      await supabase.from("recipe_ingredients").delete().eq("id", id);
      await refetchRecipeIngredients();
    },
    [refetchRecipeIngredients],
  );

  // ---- Order operations ----
  const createOrder = useCallback(
    async (tableNumber, serverName, items = [], orderType = "DINE-IN") => {
      const subtotal = items.reduce(
        (sum, i) => sum + Number(i.price) * (i.quantity || 1),
        0,
      );
      const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          table_number: tableNumber,
          server_name: serverName,
          order_type: orderType,
          status: "PENDING",
          subtotal,
          tax,
          total,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating order:", error);
        return null;
      }

      if (order && items.length > 0) {
        const rows = items.map((i) => ({
          order_id: order.id,
          menu_item_id: i.id || i.menu_item_id || null,
          item_name: i.name || i.item_name,
          quantity: i.quantity || 1,
          price: Number(i.price),
          modifiers: i.modifiers || [],
          status: "PENDING",
        }));
        const { error: itemErr } = await supabase
          .from("order_items")
          .insert(rows);
        if (itemErr) console.error("Error inserting order items:", itemErr);

        // Deduct ingredient stock
        await deductIngredients(items);
      }

      // Update table status
      if (tableNumber) {
        await supabase
          .from("restaurant_tables")
          .update({
            status: "OCCUPIED",
            current_bill: total,
            occupied_since: new Date().toISOString(),
          })
          .eq("table_number", tableNumber);
      }

      await Promise.all([
        refetchOrders(),
        refetchOrderItems(),
        refetchTables(),
      ]);
      return order;
    },
    [refetchOrders, refetchOrderItems, refetchTables, deductIngredients],
  );

  const addItemsToOrder = useCallback(
    async (orderId, items) => {
      const rows = items.map((i) => ({
        order_id: orderId,
        menu_item_id: i.id || null,
        item_name: i.name || i.item_name,
        quantity: i.quantity || 1,
        price: Number(i.price),
        modifiers: i.modifiers || [],
        status: "PENDING",
      }));
      await supabase.from("order_items").insert(rows);

      // Deduct ingredient stock
      await deductIngredients(items);

      // Recalculate totals
      const { data: allItems } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      if (allItems) {
        const subtotal = allItems.reduce(
          (sum, oi) => sum + Number(oi.price) * oi.quantity,
          0,
        );
        const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
        const total = parseFloat((subtotal + tax).toFixed(2));
        await supabase
          .from("orders")
          .update({ subtotal, tax, total })
          .eq("id", orderId);

        // Update table bill
        const order = orders.find((o) => o.id === orderId);
        if (order && order.table_number) {
          await supabase
            .from("restaurant_tables")
            .update({ current_bill: total })
            .eq("table_number", order.table_number);
        }
      }

      await Promise.all([
        refetchOrders(),
        refetchOrderItems(),
        refetchTables(),
      ]);
    },
    [
      refetchOrders,
      refetchOrderItems,
      refetchTables,
      deductIngredients,
      orders,
    ],
  );

  const removeOrderItem = useCallback(
    async (orderItemId, orderId) => {
      await supabase.from("order_items").delete().eq("id", orderItemId);

      const { data: remaining } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      if (remaining) {
        const subtotal = remaining.reduce(
          (sum, oi) => sum + Number(oi.price) * oi.quantity,
          0,
        );
        const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
        const total = parseFloat((subtotal + tax).toFixed(2));
        await supabase
          .from("orders")
          .update({ subtotal, tax, total })
          .eq("id", orderId);
      }

      await Promise.all([refetchOrders(), refetchOrderItems()]);
    },
    [refetchOrders, refetchOrderItems],
  );

  const updateOrderStatus = useCallback(
    async (orderId, status) => {
      // Optimistic local update so UI responds immediately
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
      );
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (error) console.error("Failed to update order status:", error);
      await refetchOrders();
    },
    [refetchOrders],
  );

  const updateOrderItemStatus = useCallback(
    async (orderItemId, status) => {
      // Optimistic local update so UI responds immediately
      setOrderItems((prev) =>
        prev.map((oi) => (oi.id === orderItemId ? { ...oi, status } : oi)),
      );
      const { error } = await supabase
        .from("order_items")
        .update({ status })
        .eq("id", orderItemId);
      if (error) console.error("Failed to update order item status:", error);
      await refetchOrderItems();
    },
    [refetchOrderItems],
  );

  const billOutTable = useCallback(
    async (tableNumber) => {
      // Get current orders for receipt generation before completing them
      const tableOrders = orders.filter(
        (o) =>
          o.table_number === tableNumber &&
          o.status !== "COMPLETED" &&
          o.status !== "CANCELLED",
      );
      const tableItems = tableOrders.flatMap((o) =>
        orderItems.filter((oi) => oi.order_id === o.id),
      );

      await supabase
        .from("orders")
        .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
        .eq("table_number", tableNumber)
        .neq("status", "COMPLETED");
      await supabase
        .from("restaurant_tables")
        .update({
          status: "EMPTY",
          current_bill: 0,
          guests_count: 0,
          occupied_since: null,
        })
        .eq("table_number", tableNumber);
      await Promise.all([refetchOrders(), refetchTables()]);

      return { orders: tableOrders, items: tableItems };
    },
    [refetchOrders, refetchTables, orders, orderItems],
  );

  // ---- Profile operations ----
  const addProfile = useCallback(
    async (profile) => {
      const { data } = await supabase
        .from("profiles")
        .insert(profile)
        .select()
        .single();
      await refetchProfiles();
      return data;
    },
    [refetchProfiles],
  );

  // ---- Helpers ----
  const getOrdersForTable = useCallback(
    (tableNumber) =>
      orders.filter(
        (o) =>
          o.table_number === tableNumber &&
          o.status !== "COMPLETED" &&
          o.status !== "CANCELLED",
      ),
    [orders],
  );

  const getItemsForOrder = useCallback(
    (orderId) => orderItems.filter((oi) => oi.order_id === orderId),
    [orderItems],
  );

  const getActiveOrders = useCallback(
    () =>
      orders.filter(
        (o) => o.status === "IN_PROGRESS" || o.status === "PENDING",
      ),
    [orders],
  );

  const getRecipeForItem = useCallback(
    (menuItemId) =>
      recipeIngredients.filter((ri) => ri.menu_item_id === menuItemId),
    [recipeIngredients],
  );

  const getLowStockIngredients = useCallback(
    () =>
      ingredients.filter(
        (i) => Number(i.stock) <= Number(i.low_stock_threshold),
      ),
    [ingredients],
  );

  const calculateBill = useCallback((items) => {
    const subtotal = items.reduce(
      (sum, oi) => sum + Number(oi.price) * oi.quantity,
      0,
    );
    const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));
    return { subtotal, tax, total };
  }, []);

  const formatPrice = useCallback((amount) => {
    return `${CURRENCY}${Number(amount).toFixed(2)}`;
  }, []);

  return (
    <POSContext.Provider
      value={{
        tables,
        menuItems,
        categories,
        orders,
        orderItems,
        profiles,
        ingredients,
        recipeIngredients,
        loading,
        CURRENCY,
        TAX_RATE,
        addTable,
        removeTable,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        addCategory,
        addIngredient,
        updateIngredient,
        deleteIngredient,
        addRecipeIngredient,
        removeRecipeIngredient,
        createOrder,
        addItemsToOrder,
        removeOrderItem,
        updateOrderStatus,
        updateOrderItemStatus,
        billOutTable,
        addProfile,
        getOrdersForTable,
        getItemsForOrder,
        getActiveOrders,
        getRecipeForItem,
        getLowStockIngredients,
        calculateBill,
        formatPrice,
        refetchOrders,
        refetchOrderItems,
        refetchTables,
        refetchIngredients,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error("usePOS must be used within POSProvider");
  return ctx;
}
