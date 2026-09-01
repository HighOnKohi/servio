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
const TAX_RATE = 0.12;

const normalizePercentDiscount = (value) => {
  const parsed = Number(value) || 0;
  return Math.min(100, Math.max(0, parsed));
};

const normalizeFloatDiscount = (value) => {
  const parsed = Number(value) || 0;
  return Math.max(0, parsed);
};

const computeDiscountedTableTotal = (subtotal, discounts = {}) => {
  const safeSubtotal = Number(subtotal) || 0;
  const pwdRate = discounts.pwdDiscount ? 20 : 0;
  const seniorRate = discounts.seniorDiscount ? 15 : 0;
  const reservedRate = pwdRate + seniorRate;
  const maxPercentDiscount = Math.max(0, 100 - reservedRate);
  const percentRate = Math.min(maxPercentDiscount, normalizePercentDiscount(discounts.percentDiscount));
  const percentDiscountAmount = safeSubtotal * ((reservedRate + percentRate) / 100);
  const subtotalAfterPercent = Math.max(0, safeSubtotal - percentDiscountAmount);
  const floatDiscount = Math.min(subtotalAfterPercent, normalizeFloatDiscount(discounts.floatDiscount));
  const totalDiscountAmount = percentDiscountAmount + floatDiscount;

  return {
    maxPercentDiscount,
    percentDiscount: percentRate,
    floatDiscount: parseFloat(floatDiscount.toFixed(2)),
    percentDiscountAmount: parseFloat(percentDiscountAmount.toFixed(2)),
    discountAmount: parseFloat(totalDiscountAmount.toFixed(2)),
    totalBill: parseFloat((safeSubtotal - totalDiscountAmount).toFixed(2)),
  };
};

const buildOrderItemDiscountPayload = (itemRow = {}) => {
  const itemSubtotal = parseFloat(((Number(itemRow.price) || 0) * (Number(itemRow.quantity) || 0)).toFixed(2));
  const discountState = computeDiscountedTableTotal(itemSubtotal, {
    pwdDiscount: itemRow.pwd_discount === true,
    seniorDiscount: itemRow.senior_discount === true,
    percentDiscount: itemRow.percent_discount,
    floatDiscount: itemRow.float_discount,
  });

  return {
    itemSubtotal,
    discountAmount: discountState.discountAmount,
    total: discountState.totalBill,
  };
};

const buildTableDiscountPayload = (subtotal, tableRow = {}) => {
  const discountState = computeDiscountedTableTotal(subtotal, {
    pwdDiscount: tableRow.pwd_discount === true,
    seniorDiscount: tableRow.senior_discount === true,
    percentDiscount: tableRow.percent_discount,
    floatDiscount: tableRow.float_discount,
  });

  return {
    current_bill: parseFloat((Number(subtotal) || 0).toFixed(2)),
    total_bill: discountState.totalBill,
    pwd_discount: tableRow.pwd_discount === true,
    senior_discount: tableRow.senior_discount === true,
    percent_discount: discountState.percentDiscount,
    float_discount: discountState.floatDiscount,
  };
}; // 12% VAT for Philippines
const CURRENCY = "₱";

/**
 * POSProvider Component
 * Wraps the application and manages the global state.
 */
export function POSProvider({ children }) {
  // --- Global State Definitions ---
  // Each of these state variables corresponds to a table in the Supabase database.
  const [tables, setTables] = useState([]);
  const [reservationData, setReservationData] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [customerRequests, setCustomerRequests] = useState([]);
  
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
    const { data } = await supabase
      .from("order_items")
      .select("*")
      .order("id", { ascending: true });
    if (data) setOrderItems(data);
  }, []);

  const refetchCustomerRequests = useCallback(async () => {
    const { data } = await supabase
      .from("customer_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCustomerRequests(data);
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
        refetchCustomerRequests(),
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
    refetchCustomerRequests,
    refetchProfiles,
    refetchIngredients,
    refetchRecipeIngredients,
  ]);

  // --- Real-time Subscriptions ---
  // This useEffect sets up WebSocket connections to Supabase.
  // A unique channel name per session prevents conflicts when multiple tabs are open.
  // Whenever data in these tables changes (e.g., from another device),
  // the corresponding refetch function is called to update the local state instantly.
  useEffect(() => {
    const channelId = `pos-realtime-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
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
        { event: "*", schema: "public", table: "categories" },
        () => refetchCategories(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ingredients" },
        () => refetchIngredients(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipe_ingredients" },
        () => refetchRecipeIngredients(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_requests" },
        () => refetchCustomerRequests(),
      )
      .subscribe();

    // Polling fallback — syncs the most critical order/table data every 8 seconds
    // in case the WebSocket connection is disrupted or a change event is missed.
    const pollInterval = setInterval(() => {
      refetchOrders();
      refetchOrderItems();
      refetchTables();
      refetchCustomerRequests();
    }, 8000);

    // Cleanup function to close the connection when the component unmounts
    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [
    refetchOrders,
    refetchOrderItems,
    refetchTables,
    refetchMenu,
    refetchCategories,
    refetchIngredients,
    refetchRecipeIngredients,
    refetchCustomerRequests,
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
      const table = tables.find((entry) => entry.id === tableId);
      if (!table) return { error: new Error("Table not found") };

      const { data: tableOrders, error: ordersFetchError } = await supabase
        .from("orders")
        .select("id")
        .eq("table_number", table.table_number);
      if (ordersFetchError) return { error: ordersFetchError };

      const orderIds = (tableOrders ?? []).map((order) => order.id);
      if (orderIds.length > 0) {
        const { error: deleteItemsError } = await supabase
          .from("order_items")
          .delete()
          .in("order_id", orderIds);
        if (deleteItemsError) return { error: deleteItemsError };

        const { error: deleteOrdersError } = await supabase
          .from("orders")
          .delete()
          .in("id", orderIds);
        if (deleteOrdersError) return { error: deleteOrdersError };
      }

      const { error } = await supabase
        .from("restaurant_tables")
        .delete()
        .eq("id", tableId);
      if (!error) await refetchTables();
      return { error };
    },
    [refetchTables, tables],
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

  const createCustomerRequest = useCallback(
    async (tableNumber, items) => {
      const normalizedItems = items.map((item) => ({
        id: item.id || item.menu_item_id || null,
        name: item.name || item.item_name,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
      }));
      const subtotal = parseFloat(
        normalizedItems
          .reduce((sum, item) => sum + item.price * item.quantity, 0)
          .toFixed(2),
      );

      const { data, error } = await supabase
        .from("customer_requests")
        .insert({
          table_number: tableNumber,
          status: "PENDING_KITCHEN",
          subtotal,
          items: normalizedItems,
        })
        .select()
        .single();

      if (!error) {
        await supabase
          .from("restaurant_tables")
          .update({
            status: "REQUEST",
            occupied_since: null,
            reserved_since: null,
          })
          .eq("table_number", tableNumber);

        await Promise.all([refetchCustomerRequests(), refetchTables()]);
      }
      return { data, error };
    },
    [refetchCustomerRequests, refetchTables],
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
        const currentBill = parseFloat(items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0).toFixed(2));
        await supabase
          .from("restaurant_tables")
          .update({
            status: "OCCUPIED",
            current_bill: currentBill,
            total_bill: currentBill,
            pwd_discount: false,
            senior_discount: false,
            percent_discount: 0,
            float_discount: 0,
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
      const { data: existingItems } = await supabase
        .from("order_items")
        .select("id, menu_item_id, item_name, quantity")
        .eq("order_id", orderId);

      const existingByMenuItem = new Map(
        (existingItems || [])
          .filter((item) => item.menu_item_id)
          .map((item) => [item.menu_item_id, item]),
      );

      const rowsToInsert = [];
      for (const i of items) {
        const menuItemId = i.id || i.menu_item_id || null;
        const nextQuantity = Number(i.quantity || 1);
        const existingItem = menuItemId ? existingByMenuItem.get(menuItemId) : null;

        if (existingItem) {
          await supabase
            .from("order_items")
            .update({ quantity: Number(existingItem.quantity || 0) + nextQuantity })
            .eq("id", existingItem.id);
        } else {
          rowsToInsert.push({
            order_id: orderId,
            menu_item_id: menuItemId,
            item_name: i.name || i.item_name,
            quantity: nextQuantity,
            price: Number(i.price),
            modifiers: i.modifiers || [],
            status: "PENDING",
          });
        }
      }

      if (rowsToInsert.length > 0) {
        await supabase.from("order_items").insert(rowsToInsert);
      }

      await deductIngredients(items);

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
        const currentBill = parseFloat(subtotal.toFixed(2));
        const total = parseFloat((subtotal + tax).toFixed(2));
        
        await supabase
          .from("orders")
          .update({ subtotal, tax, total })
          .eq("id", orderId);

        const order = orders.find((o) => o.id === orderId);
        if (order && order.table_number) {
          const tableRow = tables.find((t) => t.table_number === order.table_number) || {};
          await supabase
          .from("restaurant_tables")
          .update(buildTableDiscountPayload(currentBill, tableRow))
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
      tables,
    ],
  );

  const acceptCustomerRequest = useCallback(
    async (requestId) => {
      const request = customerRequests.find((entry) => entry.id === requestId);
      if (!request) return { error: new Error("Customer request not found") };

      const normalizedItems = Array.isArray(request.items)
        ? request.items.map((item) => ({
            id: item.id || item.menu_item_id || null,
            menu_item_id: item.id || item.menu_item_id || null,
            name: item.name || item.item_name,
            item_name: item.name || item.item_name,
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
          }))
        : [];

      const activeOrder = orders.find(
        (order) =>
          order.table_number === request.table_number &&
          order.status !== "COMPLETED" &&
          order.status !== "CANCELLED",
      );

      if (activeOrder) {
        await addItemsToOrder(activeOrder.id, normalizedItems);
      } else {
        await createOrder(request.table_number, "Customer", normalizedItems, "DINE-IN");
      }

      const { data, error } = await supabase
        .from("customer_requests")
        .update({
          status: "ACCEPTED",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select()
        .single();

      if (!error) await refetchCustomerRequests();
      return { data, error };
    },
    [customerRequests, orders, addItemsToOrder, createOrder, refetchCustomerRequests],
  );

  /** Kitchen confirms stock is available and forwards the customer request to the cashier. */
  const forwardCustomerRequestToCashier = useCallback(
    async (requestId) => {
      const { data, error } = await supabase
        .from("customer_requests")
        .update({ status: "PENDING_CASHIER" })
        .eq("id", requestId)
        .select()
        .single();
      if (!error) await refetchCustomerRequests();
      return { data, error };
    },
    [refetchCustomerRequests],
  );

  /**
   * Kitchen marks items as unavailable and rejects the customer request.
   * Sets unavailable_items and rejection_reason so the customer is informed.
   */
  const rejectCustomerRequestKitchen = useCallback(
    async (requestId, unavailableItems = [], reason = "") => {
      const { data, error } = await supabase
        .from("customer_requests")
        .update({
          status: "UNAVAILABLE",
          unavailable_items: unavailableItems,
          rejection_reason: reason,
        })
        .eq("id", requestId)
        .select()
        .single();
      if (!error) await refetchCustomerRequests();
      return { data, error };
    },
    [refetchCustomerRequests],
  );

  /**
   * Cashier rejects a request (e.g. after Kitchen flagged items).
   * Marks the request as REJECTED so the customer can modify and resubmit.
   */
  const rejectCustomerRequestCashier = useCallback(
    async (requestId, tableNumber) => {
      const { data, error } = await supabase
        .from("customer_requests")
        .update({ status: "REJECTED" })
        .eq("id", requestId)
        .select()
        .single();

      // Reset table to EMPTY so customer can resubmit
      if (!error && tableNumber) {
        await supabase
          .from("restaurant_tables")
          .update({ status: "EMPTY" })
          .eq("table_number", tableNumber);
      }
      if (!error) await Promise.all([refetchCustomerRequests(), refetchTables()]);
      return { data, error };
    },
    [refetchCustomerRequests, refetchTables],
  );

  /** Kitchen toggles a menu item between ACTIVE and SOLD OUT. */
  const toggleMenuItemStock = useCallback(
    async (itemId, currentStatus) => {
      const nextStatus = currentStatus === "ACTIVE" ? "SOLD OUT" : "ACTIVE";
      const { error } = await supabase
        .from("menu_items")
        .update({ status: nextStatus })
        .eq("id", itemId);
      if (error) console.error("Failed to toggle menu item stock:", error);
      await refetchMenu();
    },
    [refetchMenu],
  );

  /** Customer requests the bill for their table after food is served. */
  const requestTableBillOut = useCallback(
    async (tableNumber) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ bill_out_requested: true })
        .eq("table_number", tableNumber);
      if (error) console.error("Failed to set bill out request:", error);
      await refetchTables();
    },
    [refetchTables],
  );

  /** Updates table details (capacity, status) from Restaurant Management. */
  const updateTableDetails = useCallback(
    async (tableId, updates) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update(updates)
        .eq("id", tableId);
      if (error) console.error("Failed to update table details:", error);
      await refetchTables();
      return { error };
    },
    [refetchTables],
  );

  /** Removes a single item from an active order and recalculates the bill. */
  const removeOrderItem = useCallback(
    async (orderItemId, orderId) => {
      const { data: item, error: fetchError } = await supabase
        .from("order_items")
        .select("*")
        .eq("id", orderItemId)
        .single();

      if (fetchError || !item) {
        console.error("Failed to load order item for removal:", fetchError);
        return;
      }

      const nextQuantity = Number(item.quantity) - 1;
      setOrderItems((previous) => nextQuantity > 0
        ? previous.map((entry) => entry.id === orderItemId ? { ...entry, quantity: nextQuantity } : entry)
        : previous.filter((entry) => entry.id !== orderItemId));

      if (Number(item.quantity) > 1) {
        const { error: updateError } = await supabase
          .from("order_items")
          .update({ quantity: Number(item.quantity) - 1 })
          .eq("id", orderItemId);

        if (updateError) {
          console.error("Failed to decrease order item quantity:", updateError);
          return;
        }
      } else {
        const { error: deleteError } = await supabase
          .from("order_items")
          .delete()
          .eq("id", orderItemId);

        if (deleteError) {
          console.error("Failed to delete order item:", deleteError);
          return;
        }
      }

      const { data: remaining } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      const nextItems = remaining || [];
      const subtotal = nextItems.reduce(
        (sum, oi) => sum + Number(oi.price) * Number(oi.quantity || 0),
        0,
      );
      const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      await supabase
        .from("orders")
        .update({ subtotal, tax, total })
        .eq("id", orderId);

      const order = orders.find((o) => o.id === orderId);
      if (order && order.table_number) {
        const currentBill = parseFloat(subtotal.toFixed(2));
        const tableRow = tables.find((t) => t.table_number === order.table_number) || {};
        await supabase
          .from("restaurant_tables")
          .update(buildTableDiscountPayload(currentBill, tableRow))
          .eq("table_number", order.table_number);
      }

      await Promise.all([refetchOrders(), refetchOrderItems(), refetchTables()]);
    },
    [refetchOrders, refetchOrderItems, refetchTables, orders, tables],
  );

  /** Updates the lifecycle status of an entire order (e.g., PENDING -> SERVED). */
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

      // When food is served, clear any bill_out_requested flag on the table
      // and update all order_items to SERVED status
      if (status === "SERVED" || status === "COMPLETED") {
        const order = orders.find((o) => o.id === orderId);
        if (order && order.table_number) {
          await supabase
            .from("restaurant_tables")
            .update({ bill_out_requested: false })
            .eq("table_number", order.table_number);
        }
        await supabase
          .from("order_items")
          .update({ status: "SERVED" })
          .eq("order_id", orderId)
          .neq("status", "CANCELLED");
      }

      await refetchOrders();
    },
    [refetchOrders, orders],
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

      await supabase
        .from("customer_requests")
        .delete()
        .eq("table_number", tableNumber);
        
      // Reset the physical table to make it available for the next guest
      await supabase
        .from("restaurant_tables")
        .update({
          status: "EMPTY",
          current_bill: 0,
          total_bill: 0,
          pwd_discount: false,
          senior_discount: false,
          percent_discount: 0,
          float_discount: 0,
          occupied_since: null,
          reserved_since: null,
        })
        .eq("table_number", tableNumber);
        
      await Promise.all([refetchOrders(), refetchTables(), refetchCustomerRequests()]);

      // Return the completed data so the caller (Cashier) can print a receipt
      return { orders: tableOrders, items: tableItems };
    },
    [refetchOrders, refetchTables, refetchCustomerRequests, orders, orderItems],
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

  /** Updates an existing staff profile's details (name, role, status). */
  const updateProfile = useCallback(
    async (id, updates) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", id);
      await refetchProfiles();
      return { error };
    },
    [refetchProfiles],
  );

  /** Removes a staff profile row from the database. */
  const deleteProfile = useCallback(
    async (id) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);
      await refetchProfiles();
      return { error };
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

  const reserveTable = useCallback(
    async (tableNumber) => {
      const { data } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("table_number", tableNumber)
        .single();

      if (!data) return;

      const isReserved = data.status === "RESERVED";
      const nextUpdate = isReserved
        ? { status: "EMPTY", reserved_since: null }
        : { status: "RESERVED", reserved_since: new Date().toISOString(), occupied_since: null };

      const { error } = await supabase
        .from("restaurant_tables")
        .update(nextUpdate)
        .eq("table_number", tableNumber);

      if (error) {
        console.error("Error updating reservation:", error);
        return;
      }

      await refetchTables();
    },
    [refetchTables],
  );

  const splitOrderItemUnit = useCallback(
    async (orderItemId) => {
      const { data: item, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("id", orderItemId)
        .single();
      if (error || !item || Number(item.quantity) <= 1) return item || null;

      const { data: splitItem, error: insertError } = await supabase
        .from("order_items")
        .insert({
          order_id: item.order_id,
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          quantity: 1,
          price: item.price,
          modifiers: item.modifiers || [],
          status: item.status || "PENDING",
          pwd_discount: false,
          senior_discount: false,
          percent_discount: 0,
          float_discount: 0,
        })
        .select()
        .single();
      if (insertError || !splitItem) return null;

      const { error: updateError } = await supabase
        .from("order_items")
        .update({ quantity: Number(item.quantity) - 1 })
        .eq("id", item.id);
      if (updateError) return null;

      const order = orders.find((o) => o.id === item.order_id);
      if (order && order.table_number) {
        const { data: remaining } = await supabase
          .from("order_items")
          .select("price, quantity, pwd_discount, senior_discount, percent_discount, float_discount")
          .eq("order_id", item.order_id);

        const rawSubtotal = (remaining || []).reduce(
          (sum, entry) => sum + (Number(entry.price) || 0) * (Number(entry.quantity) || 0),
          0,
        );
        const discountedTotal = (remaining || []).reduce((sum, entry) => {
          const entrySubtotal = (Number(entry.price) || 0) * (Number(entry.quantity) || 0);
          const entryDiscount = computeDiscountedTableTotal(entrySubtotal, {
            pwdDiscount: entry.pwd_discount === true,
            seniorDiscount: entry.senior_discount === true,
            percentDiscount: entry.percent_discount,
            floatDiscount: entry.float_discount,
          });
          return sum + entryDiscount.totalBill;
        }, 0);

        await supabase
          .from("restaurant_tables")
          .update({
            current_bill: parseFloat(rawSubtotal.toFixed(2)),
            total_bill: parseFloat(discountedTotal.toFixed(2)),
          })
          .eq("table_number", order.table_number);
      }

      await Promise.all([refetchOrderItems(), refetchTables()]);
      return splitItem;
    },
    [orders, refetchOrderItems, refetchTables],
  );

  const applyItemDiscount = useCallback(
    async (orderItemId, discounts = {}) => {
      const { data: item, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("id", orderItemId)
        .single();

      if (error || !item) {
        console.error("Error loading order item:", error);
        return null;
      }

      const discountState = computeDiscountedTableTotal((Number(item.price) || 0) * (Number(item.quantity) || 0), {
        pwdDiscount: !!discounts.pwdDiscount,
        seniorDiscount: !!discounts.seniorDiscount,
        percentDiscount: discounts.percentDiscount,
        floatDiscount: discounts.floatDiscount,
      });

      const { error: updateError } = await supabase
        .from("order_items")
        .update({
          pwd_discount: !!discounts.pwdDiscount,
          senior_discount: !!discounts.seniorDiscount,
          percent_discount: discountState.percentDiscount,
          float_discount: discountState.floatDiscount,
        })
        .eq("id", orderItemId);

      if (updateError) {
        console.error("Error applying item discount:", updateError);
        return null;
      }

      const order = orders.find((o) => o.id === item.order_id);
      if (order && order.table_number) {
        const { data: remaining } = await supabase
          .from("order_items")
          .select("price, quantity, pwd_discount, senior_discount, percent_discount, float_discount")
          .eq("order_id", item.order_id);

        const rawSubtotal = (remaining || []).reduce(
          (sum, entry) => sum + (Number(entry.price) || 0) * (Number(entry.quantity) || 0),
          0,
        );
        const discountedTotal = (remaining || []).reduce((sum, entry) => {
          const entrySubtotal = (Number(entry.price) || 0) * (Number(entry.quantity) || 0);
          const entryDiscount = computeDiscountedTableTotal(entrySubtotal, {
            pwdDiscount: entry.pwd_discount === true,
            seniorDiscount: entry.senior_discount === true,
            percentDiscount: entry.percent_discount,
            floatDiscount: entry.float_discount,
          });
          return sum + entryDiscount.totalBill;
        }, 0);

        await supabase
          .from("restaurant_tables")
          .update({
            current_bill: parseFloat(rawSubtotal.toFixed(2)),
            total_bill: parseFloat(discountedTotal.toFixed(2)),
          })
          .eq("table_number", order.table_number);
      }

      await Promise.all([refetchOrderItems(), refetchTables()]);
      return discountState.totalBill;
    },
    [orders, refetchOrderItems, refetchTables, tables],
  );

  const applyTableDiscount = useCallback(
    async (tableNumber, discounts = {}) => {
      const { data: table, error } = await supabase
        .from("restaurant_tables")
        .select("current_bill")
        .eq("table_number", tableNumber)
        .single();

      if (error || !table) {
        console.error("Error loading table bill:", error);
        return null;
      }

      const subtotal = Number(table.current_bill) || 0;
      const discountState = computeDiscountedTableTotal(subtotal, {
        pwdDiscount: !!discounts.pwdDiscount,
        seniorDiscount: !!discounts.seniorDiscount,
        percentDiscount: discounts.percentDiscount,
        floatDiscount: discounts.floatDiscount,
      });

      const { error: updateError } = await supabase
        .from("restaurant_tables")
        .update({
          pwd_discount: !!discounts.pwdDiscount,
          senior_discount: !!discounts.seniorDiscount,
          percent_discount: discountState.percentDiscount,
          float_discount: discountState.floatDiscount,
          total_bill: discountState.totalBill,
        })
        .eq("table_number", tableNumber);

      if (updateError) {
        console.error("Error applying table discount:", updateError);
        return null;
      }

      await refetchTables();
      return discountState.totalBill;
    },
    [refetchTables],
  );

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
        customerRequests,
        reservationData,
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
        createCustomerRequest,
        acceptCustomerRequest,
        forwardCustomerRequestToCashier,
        rejectCustomerRequestKitchen,
        rejectCustomerRequestCashier,
        toggleMenuItemStock,
        requestTableBillOut,
        updateTableDetails,
        createOrder,
        addItemsToOrder,
        removeOrderItem,
        updateOrderStatus,
        updateOrderItemStatus,
        billOutTable,
        splitOrderItemUnit,
        applyTableDiscount,
        applyItemDiscount,
        addProfile,
        updateProfile,
        deleteProfile,
        reserveTable,
        
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
        refetchCustomerRequests,
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
