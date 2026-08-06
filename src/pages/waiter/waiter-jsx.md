import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePOS } from "../../context/POSContext";
import "./waiter.css";

export default function Waiter() {
  const { user } = useAuth();
  const { menuItems, categories, tables, createOrder, formatPrice, loading } =
    usePOS();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTableNum, setSelectedTableNum] = useState("");
  const [cart, setCart] = useState([]);

  const filteredItems =
    selectedCategory === "all"
      ? menuItems.filter((mi) => mi.status === "ACTIVE")
      : menuItems.filter(
          (mi) => mi.category_id === selectedCategory && mi.status === "ACTIVE",
        );

  const addToCart = (item) => {
    setCart((prev) => {
      const exists = prev.find((ci) => ci.id === item.id);
      if (exists)
        return prev.map((ci) =>
          ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci,
        );
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((ci) => ci.id !== itemId));
  };

  const punchOrder = async () => {
    if (cart.length === 0 || !selectedTableNum) return;
    await createOrder(
      Number(selectedTableNum),
      user?.full_name || "Staff",
      cart,
    );
    setCart([]);
    alert("Order sent to kitchen!");
  };

  if (loading)
    return (
      <div className="page">
        <p style={{ fontSize: "1.2rem" }}>Loading...</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Waiter</h1>
        <Link to="/" className="btn btn-sm">
          ← Back
        </Link>
      </div>

      <div className="layout-split">
        {/* Menu area */}
        <div className="main">
          <div className="filter-bar">
            <button
              className={`btn btn-sm ${selectedCategory === "all" ? "btn-primary" : ""}`}
              onClick={() => setSelectedCategory("all")}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`btn btn-sm ${selectedCategory === cat.id ? "btn-primary" : ""}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="card-grid">
            {filteredItems.map((item) => (
              <div key={item.id} className="card">
                <strong>{item.name}</strong>
                <p className="text-sm text-muted">{item.description}</p>
                <div className="flex justify-between items-center mt-2">
                  <span style={{ fontWeight: 600 }}>
                    {formatPrice(item.price)}
                  </span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => addToCart(item)}
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order sidebar */}
        <div className="sidebar">
          <div className="card">
            <h3 className="mb-2">New Order</h3>

            <div className="form-group">
              <label>Table</label>
              <select
                value={selectedTableNum}
                onChange={(e) => setSelectedTableNum(e.target.value)}
              >
                <option value="">Select table...</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.table_number}>
                    Table {t.table_number} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            <p className="text-sm text-muted mb-2">
              Server: {user?.full_name || "Staff"}
            </p>

            {cart.length === 0 ? (
              <p className="text-sm text-muted">Add items from the menu.</p>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((ci) => (
                      <tr key={ci.id}>
                        <td>{ci.name}</td>
                        <td>{ci.quantity}</td>
                        <td>{formatPrice(Number(ci.price) * ci.quantity)}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => removeFromCart(ci.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-3 text-right">
                  <strong style={{ fontSize: "1.1rem" }}>
                    Total:{" "}
                    {formatPrice(
                      cart.reduce(
                        (s, c) => s + Number(c.price) * c.quantity,
                        0,
                      ),
                    )}
                  </strong>
                </div>

                <div className="mt-3 flex gap-2">
                  <button className="btn btn-sm" onClick={() => setCart([])}>
                    Clear
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={punchOrder}
                    disabled={!selectedTableNum}
                    style={{ flex: 1 }}
                  >
                    Punch Order
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
