import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePOS } from "../../context/POSContext";
import "./kitchen.css";

export default function Kitchen() {
  const {
    orders,
    orderItems,
    updateOrderStatus,
    updateOrderItemStatus,
    loading,
  } = usePOS();
  const [now, setNow] = useState(Date.now());

  // Tick every 30s to update elapsed times
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Show PENDING orders as active kitchen tickets
  const tickets = useMemo(() => {
    return orders
      .filter((o) => o.status === "PENDING")
      .map((order) => {
        const items = orderItems.filter((oi) => oi.order_id === order.id);
        const elapsed = Math.floor(
          (now - new Date(order.created_at).getTime()) / 60000,
        );
        return { ...order, items, elapsed };
      })
      .sort((a, b) => b.elapsed - a.elapsed); // oldest first
  }, [orders, orderItems, now]);

  const markItemCooking = async (itemId) => {
    await updateOrderItemStatus(itemId, "COOKING");
  };

  const markItemReady = async (itemId) => {
    await updateOrderItemStatus(itemId, "SERVED");
  };

  const completeTicket = async (orderId) => {
    // Mark all items as SERVED and order as COMPLETED
    // Use ticket items from the current render instead of re-filtering from possibly stale orderItems
    const ticket = tickets.find((t) => t.id === orderId);
    const items = ticket
      ? ticket.items
      : orderItems.filter((oi) => oi.order_id === orderId);
    await Promise.all(
      items
        .filter((item) => item.status !== "SERVED")
        .map((item) => updateOrderItemStatus(item.id, "SERVED")),
    );
    await updateOrderStatus(orderId, "COMPLETED");
  };

  if (loading)
    return (
      <div className="page">
        <p style={{ fontSize: "1.2rem" }}>Loading kitchen...</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Kitchen Display</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <span className="badge badge-yellow">{tickets.length} active</span>
          <Link to="/" className="btn btn-sm">
            ← Back
          </Link>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="card text-center" style={{ padding: 40 }}>
          <p style={{ fontSize: "1.3rem" }}>
            No active tickets — all caught up!
          </p>
        </div>
      ) : (
        <div className="ticket-list">
          {tickets.map((ticket) => {
            const isUrgent = ticket.elapsed > 15;

            return (
              <div
                key={ticket.id}
                className={`ticket ${isUrgent ? "ticket-urgent" : ""}`}
              >
                <div className="ticket-header">
                  <span>Table {ticket.table_number || "—"}</span>
                  <div className="flex gap-2 items-center">
                    <span className="badge badge-blue">PENDING</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: isUrgent ? "#dc2626" : "#666",
                        fontSize: "1.1rem",
                      }}
                    >
                      {ticket.elapsed}m
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 18px",
                    borderBottom: "1px solid #e0e0e0",
                    fontSize: "0.9rem",
                    color: "#666",
                  }}
                >
                  Server: {ticket.server_name || "—"} • {ticket.order_type}
                </div>

                <div className="ticket-body">
                  {ticket.items.map((item) => (
                    <div
                      key={item.id}
                      className="ticket-item"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>×{item.quantity}</strong> {item.item_name}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "#b45309",
                              fontStyle: "italic",
                            }}
                          >
                            {item.modifiers.join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <span
                          className={`badge ${
                            item.status === "SERVED"
                              ? "badge-green"
                              : item.status === "COOKING"
                                ? "badge-yellow"
                                : "badge-gray"
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.status === "PENDING" && (
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => markItemCooking(item.id)}
                          >
                            Cook
                          </button>
                        )}
                        {item.status === "COOKING" && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => markItemReady(item.id)}
                          >
                            Done
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ticket-footer">
                  <button
                    className="btn btn-success btn-block"
                    onClick={() => completeTicket(ticket.id)}
                  >
                    ✓ Complete — Served
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
