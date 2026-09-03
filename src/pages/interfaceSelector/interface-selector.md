import React from "react";
import "./interface-selector.css";

// RX
const InterfaceSelector = () => {
  return (
    //  All of these are placeholders for testing.
    //  Keep this file and just rename it to a different name pag nag code ka
    //  Cashier, Kitchen, and Restaurant Management lang dapat yung lalabas dito
    <div className="interface-selector-page">
      <h1>Interface Selector</h1>
      <p>Please select an interface to proceed.</p>
      <div className="interface-buttons">
        <a href="/admin" className="interface-button">
          Admin
        </a>
        <a href="/cashier" className="interface-button">
          Cashier
        </a>
        <a href="/kitchen" className="interface-button">
          Kitchen
        </a>
        <a href="/inventory" className="interface-button">
          Inventory
        </a>
        <a href="/restaurant-management" className="interface-button">
          Restaurant Management
        </a>
        <a href="/login" className="interface-button">
          Login
        </a>
      </div>
    </div>
  );
};

export default InterfaceSelector;
