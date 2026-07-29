import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./interface-selector.css";

const INTERFACES = [
  {
    id: "resto",
    label: "Restaurant Management Interface",
    desc: "Manage menu items, categories, and restaurant tables.",
    route: "/restaurant-management",
  },
  {
    id: "cashier",
    label: "Cashier Interface",
    desc: "Check out customers and print receipts quickly.",
    route: "/cashier",
  },
  {
    id: "waiter",
    label: "Waiter Interface",
    desc: "Send orders to the kitchen from the floor.",
    route: "/waiter",
  },
  {
    id: "kitchen",
    label: "Kitchen Interface",
    desc: "View live orders and start cooking.",
    route: "/kitchen",
  },
  {
    id: "admin",
    label: "Admin Interface",
    desc: "Gain administrative access to the system.",
    route: "/admin",
  },
  {
    id: "inventory",
    label: "Inventory Interface",
    desc: "Manage and track inventory levels.",
    route: "/inventory",
  },
];

function GridIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function InterfaceSelector() {
  const navigate = useNavigate();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const time = currentDateTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const date = currentDateTime.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="interface-selector-page">
      <div className="interface-selector-center">
        <h1 className="interface-selector-title">
          What would you like to{" "}
          <span className="interface-selector-title-mark">do</span>
          <br />
          <span className="interface-selector-title-mark">today</span>?
        </h1>

        <div className="interface-selector-grid">
          {INTERFACES.map((iface) => (
            <button
              key={iface.id}
              onClick={() => navigate(iface.route)}
              className="interface-card interface-card-enabled"
            >
              <div className="interface-card-icon">
                <GridIcon />
              </div>

              <div className="interface-card-label">
                {iface.label}
              </div>

              <div className="interface-card-desc">
                {iface.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      <footer className="interface-selector-footer">
        <div className="interface-selector-user">
          <div className="interface-selector-user-avatar">
            <UserIcon />
          </div>

          <div>
            <div className="interface-selector-user-name">
              Admin User
            </div>
            <div className="interface-selector-user-role">
              Administrator
            </div>
          </div>
        </div>

        <div className="interface-selector-status">
          {date}, {time}
        </div>

        <button
          className="interface-selector-logout"
          type="button"
          onClick={() => navigate("/login")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </footer>
    </div>
  );
}