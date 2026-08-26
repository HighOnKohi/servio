/**
 * POSContext.jsx
 * 
 * This file serves as the central state management and database communication layer for the entire POS system.
 * It provides a React Context that wraps the application, exposing data and helper functions to all components.
 * It relies on Supabase for real-time database syncing and CRUD operations.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../lib/supabaseClient";

// Create the context that will be provided to the app
const POSContext = createContext(null);

// Constants used across the application for calculations and display
const TAX_RATE = 0.12; // 12% VAT for Philippines
const CURRENCY = "₱";

/**
 * POSProvider Component
 * Wraps the application and manages the global state.
 */
export function POSProvider({ children }) {
  // --- Global State Definitions ---
  // Each of these state variables corresponds to a table in the Supabase database.
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  
  // Loading state indicates whether the initial data fetch from Supabase is complete
  const [loading, setLoading] = useState(true);

  // --- Refetch Helpers ---
  // These functions query the Supabase database and update the local state.
  // They are wrapped in useCallback to prevent unnecessary re-renders.

  /** Fetches all restaurant tables, ordered by table number. */
  const refetchTables = useCallback(async () => {
    const { data } = await supabase
      .from("restaurant_tables")
      .select("*")
      .order("table_number");
    if (data) setTables(data);
  }, []);

  /** Fetches all menu items, ordered alphabetically by name. */
  const refetchMenu = useCallback(async () => {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .order("name");
    if (data) setMenuItems(data);
  }, []);

  /** Fetches all menu categories, ordered alphabetically. */
  const refetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (data) setCategories(data);
  }, []);

  /** Fetches all orders, ordered by creation date (newest first). */
  const refetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOrders(data);
  }, []);

  /** Fetches all individual order items (the contents of the orders). */
  const refetchOrderItems = useCallback(async () => {
    const { data } = await supabase.from("order_items").select("*");
    if (data) setOrderItems(data);
  }, []);

  /** Fetches all staff profiles, ordered alphabetically by full name. */
  const refetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    if (data) setProfiles(data);
  }, []);

  /** Fetches all inventory ingredients, ordered alphabetically by name. */
  const refetchIngredients = useCallback(async () => {
    const { data } = await supabase
      .from("ingredients")
      .select("*")
      .order("name");
    if (data) setIngredients(data);
  }, []);

  /** Fetches the recipe mappings (which ingredients belong to which menu items). */
  const refetchRecipeIngredients = useCallback(async () => {
    const { data } = await supabase.from("recipe_ingredients").select("*");
    if (data) setRecipeIngredients(data);
  }, []);

  // --- Initial Data Load ---
  // This useEffect runs once when the application starts up.
  // It fetches all the necessary data from Supabase simultaneously to minimize load time.
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

  // --- Real-time Subscriptions ---
  // This useEffect sets up WebSocket connections to Supabase.
  // Whenever data in these tables changes (e.g., from another device), 
  // the corresponding refetch function is called to update the local state instantly.
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
      
    // Cleanup function to close the connection when the component unmounts
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

  // ==========================================
  // HELPER FUNCTIONS (CRUD & Business Logic)
  // ==========================================

  /**
   * Deducts ingredients from the inventory based on the items ordered.
   * Looks up the recipe for each ordered item and decrements the required quantity.
   */
  const deductIngredients = useCallback(
    async (cartItems) => {
      // Loop through every item in the cart
      for (const item of cartItems) {
        const menuItemId = item.id || item.menu_item_id;
        if (!menuItemId) continue;
        
        // Find all recipe rows associated with this menu item
        const recipes = recipeIngredients.filter(
          (ri) => ri.menu_item_id === menuItemId,
        );
        
        // Loop through each ingredient required by the recipe
        for (const recipe of recipes) {
          const qty = recipe.quantity_needed * (item.quantity || 1);
          const ing = ingredients.find((i) => i.id === recipe.ingredient_id);
          
          if (ing) {
            // Calculate new stock, ensuring it doesn't drop below 0
            const newStock = Math.max(0, Number(ing.stock) - qty);
            await supabase
              .from("ingredients")
              .update({ stock: newStock, updated_at: new Date().toISOString() })
              .eq("id", recipe.ingredient_id);
          }
        }
      }
      await refetchIngredients(); // Sync the updated stock back to the UI
    },
    [recipeIngredients, ingredients, refetchIngredients],
  );

  /** Adds a new physical table to the system. */
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

  /** Removes a physical table from the system. */
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

  /** Adds a new item to the menu. */
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

  /** Updates details (e.g., price, name) of an existing menu item. */
  const updateMenuItem = useCallback(
    async (itemId, updates) => {
      await supabase.from("menu_items").update(updates).eq("id", itemId);
      await refetchMenu();
    },
    [refetchMenu],
  );

  /** Deletes a menu item from the system. */
  const deleteMenuItem = useCallback(
    async (itemId) => {
      await supabase.from("menu_items").delete().eq("id", itemId);
      await refetchMenu();
    },
    [refetchMenu],
  );

  /** Adds a new menu category (e.g., 'Beverages'). */
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

  /** Updates the name of an existing menu category. */
  const updateCategory = useCallback(
    async (id, updates) => {
      await supabase.from("categories").update(updates).eq("id", id);
      await refetchCategories();
    },
    [refetchCategories],
  );

  /** Deletes a category and forcefully deletes all menu items belonging to it. */
  const deleteCategory = useCallback(
    async (id) => {
      // First delete all items belonging to this category to prevent foreign key errors
      await supabase.from("menu_items").delete().eq("category_id", id);
      // Then delete the category itself
      await supabase.from("categories").delete().eq("id", id);
      await Promise.all([refetchCategories(), refetchMenu()]);
    },
    [refetchCategories, refetchMenu],
  );

  /** Adds a new raw ingredient to the inventory. */
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

  /** Updates an ingredient's properties (stock level, threshold, etc.). */
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

  /** Removes an ingredient from the inventory completely. */
  const deleteIngredient = useCallback(
    async (id) => {
      await supabase.from("ingredients").delete().eq("id", id);
      await refetchIngredients();
    },
    [refetchIngredients],
  );

  /** Links an ingredient to a menu item, defining how much of it is needed to make the item. */
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

  /** Removes a specific ingredient mapping from a recipe. */
  const removeRecipeIngredient = useCallback(
    async (id) => {
      await supabase.from("recipe_ingredients").delete().eq("id", id);
      await refetchRecipeIngredients();
    },
    [refetchRecipeIngredients],
  );

  /**
   * Punches a brand new order for a table.
   * Calculates taxes, inserts the parent order, inserts all order items,
   * deducts inventory, and marks the table as OCCUPIED.
   */
  const createOrder = useCallback(
    async (tableNumber, serverName, items = [], orderType = "DINE-IN") => {
      // Step 1: Calculate financial totals for the order
      const subtotal = items.reduce(
        (sum, i) => sum + Number(i.price) * (i.quantity || 1),
        0,
      );
      const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      // Step 2: Insert the parent 'order' record
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

      // Step 3: Insert the individual items attached to this order
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

        // Step 4: Automatically deduct the ingredients used from the inventory
        await deductIngredients(items);
      }

      // Step 5: Update the physical table's status to reflect that guests are eating
      if (tableNumber) {
        const total = parseFloat(items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0).toFixed(2));
        await supabase
          .from("restaurant_tables")
          .update({
            status: "OCCUPIED",
            current_bill: total,
            occupied_since: new Date().toISOString(),
          })
          .eq("table_number", tableNumber);
      }

      // Sync all affected tables to update the UI
      await Promise.all([
        refetchOrders(),
        refetchOrderItems(),
        refetchTables(),
      ]);
      return order;
    },
    [refetchOrders, refetchOrderItems, refetchTables, deductIngredients],
  );

  /**
   * Adds new items to an existing active order (e.g., when a table orders more drinks).
   * Recalculates the bill and deducts inventory for the new items.
   */
  const addItemsToOrder = useCallback(
    async (orderId, items) => {
      // Insert the new items
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

      // Deduct inventory for the newly added items
      await deductIngredients(items);

      // Recalculate the entire order's totals from the database
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
        
        // Update the order totals
        await supabase
          .from("orders")
          .update({ subtotal, tax, total })
          .eq("id", orderId);

        // Update the table's active running bill
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

  /** Removes a single item from an active order and recalculates the bill. */
  const removeOrderItem = useCallback(
    async (orderItemId, orderId) => {
      await supabase.from("order_items").delete().eq("id", orderItemId);

      // Recalculate totals for the remaining items
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

  /** Updates the lifecycle status of an entire order (e.g., PENDING -> READY). */
  const updateOrderStatus = useCallback(
    async (orderId, status) => {
      // Optimistic local update so the UI responds immediately without waiting for the network
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

  /** Updates the lifecycle status of a specific item within an order. */
  const updateOrderItemStatus = useCallback(
    async (orderItemId, status) => {
      // Optimistic local update
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

  /**
 * Finalizes a table's session when they pay their bill.
 * Deletes all active orders on that table and resets the table status to EMPTY.
 */
  const billOutTable = useCallback(
    async (tableNumber) => {
      // Gather current orders for receipt generation before they are deleted
      const tableOrders = orders.filter(
        (o) =>
          o.table_number === tableNumber &&
          o.status !== "COMPLETED" &&
          o.status !== "CANCELLED",
      );
      const tableItems = tableOrders.flatMap((o) =>
        orderItems.filter((oi) => oi.order_id === o.id),
      );

      // Delete the active order items first (due to foreign key constraints)
      if (tableOrders.length > 0) {
        const orderIds = tableOrders.map((o) => o.id);
        await supabase.from("order_items").delete().in("order_id", orderIds);
        
        // Then delete the parent orders
        await supabase
          .from("orders")
          .delete()
          .eq("table_number", tableNumber)
          .neq("status", "COMPLETED")
          .neq("status", "CANCELLED");
      }
        
      // Reset the physical table to make it available for the next guest
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

      // Return the completed data so the caller (Cashier) can print a receipt
      return { orders: tableOrders, items: tableItems };
    },
    [refetchOrders, refetchTables, orders, orderItems],
  );

  /** Adds a new staff profile to the system. */
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

  // ==========================================
  // UTILITY / GETTER FUNCTIONS
  // ==========================================

  /** Returns all active orders assigned to a specific table. */
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

  /** Returns all items associated with a specific order ID. */
  const getItemsForOrder = useCallback(
    (orderId) => orderItems.filter((oi) => oi.order_id === orderId),
    [orderItems],
  );

  /** Returns all orders that are currently being processed (PENDING or IN_PROGRESS). */
  const getActiveOrders = useCallback(
    () =>
      orders.filter(
        (o) => o.status === "IN_PROGRESS" || o.status === "PENDING",
      ),
    [orders],
  );

  /** Returns the recipe ingredient requirements for a specific menu item. */
  const getRecipeForItem = useCallback(
    (menuItemId) =>
      recipeIngredients.filter((ri) => ri.menu_item_id === menuItemId),
    [recipeIngredients],
  );

  /** Returns an array of ingredients that have fallen at or below their low-stock threshold. */
  const getLowStockIngredients = useCallback(
    () =>
      ingredients.filter(
        (i) => Number(i.stock) <= Number(i.low_stock_threshold),
      ),
    [ingredients],
  );

  /** Utility function to calculate the subtotal, tax, and total for a given array of items. */
  const calculateBill = useCallback((items) => {
    const subtotal = items.reduce(
      (sum, oi) => sum + Number(oi.price) * oi.quantity,
      0,
    );
    const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));
    return { subtotal, tax, total };
  }, []);

  /** Utility function to format a raw number into a currency string (e.g., ₱150.00). */
  const formatPrice = useCallback((amount) => {
    return `${CURRENCY}${Number(amount).toFixed(2)}`;
  }, []);

  // Expose all data and functions via the Provider
  return (
    <POSContext.Provider
      value={{
        // Data arrays
        tables,
        menuItems,
        categories,
        orders,
        orderItems,
        profiles,
        ingredients,
        recipeIngredients,
        loading,
        
        // Constants
        CURRENCY,
        TAX_RATE,
        
        // Operations
        addTable,
        removeTable,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        addCategory,
        updateCategory,
        deleteCategory,
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
        
        // Utility getters
        getOrdersForTable,
        getItemsForOrder,
        getActiveOrders,
        getRecipeForItem,
        getLowStockIngredients,
        calculateBill,
        formatPrice,
        
        // Manual refetch triggers
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

/**
 * Custom hook to consume the POS context safely.
 * Throws an error if used outside of the POSProvider.
 */
export function usePOS() {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error("usePOS must be used within POSProvider");
  return ctx;
}
