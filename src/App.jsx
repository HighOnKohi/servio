import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { POSProvider } from "./context/POSContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import "./App.css";
import Login from "./pages/login/login";
import InterfaceSelector from "./pages/interfaceSelector/interface-selector";
import RestaurantManagement from "./pages/restaurantManagement/restaurant-management";
import Cashier from "./pages/cashier/cashier";
import Waiter from "./pages/waiter/waiter";
import Kitchen from "./pages/kitchen/kitchen";
import Admin from "./pages/admin/admin";
import Inventory from "./pages/inventory/inventory";

function App() {
  return (
    <AuthProvider>
      <POSProvider>
        <Routes>
          {/* Public route — accessible without login */}
          <Route path="/login" element={<Login />} />

          {/* All other routes are protected — requires authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<InterfaceSelector />} />
            <Route path="/restaurant-management/*" element={<RestaurantManagement />} />
            <Route path="/cashier/*" element={<Cashier />} />
            <Route path="/waiter/*" element={<Waiter />} />
            <Route path="/kitchen/*" element={<Kitchen />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/inventory" element={<Inventory />} />
          </Route>
        </Routes>
      </POSProvider>
    </AuthProvider>
  );
}

export default App;
