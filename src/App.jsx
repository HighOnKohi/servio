import { Route, Routes } from "react-router-dom";

import "./App.css";
import Admin from "./pages/admin/admin";
import Cashier from "./pages/cashier/cashier";
import Kitchen from "./pages/kitchen/kitchen";
import Login from "./pages/login/login";
import InterfaceSelector from "./pages/interfaceSelector/interface-selector";
import Inventory from "./pages/inventory/inventory";
import RestaurantManagement from "./pages/restaurantManagement/restaurant-management";
import Waiter from "./pages/waiter/waiter";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<InterfaceSelector />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/cashier" element={<Cashier />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route
          path="/restaurant-management"
          element={<RestaurantManagement />}
        />
        <Route path="/waiter" element={<Waiter />} />
      </Routes>
    </>
  );
}

export default App;
