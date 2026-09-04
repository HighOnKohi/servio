import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { POSProvider } from "./context/POSContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import "./App.css";
import Login from "./pages/login/login";
import InterfaceSelector from "./pages/interfaceSelector/interface-selector";
import RestaurantManagement from "./pages/restaurantManagement/restaurant-management";
import Cashier from "./pages/cashier/cashier";
import Kitchen from "./pages/kitchen/kitchen";
import Admin from "./pages/admin/admin";
import Inventory from "./pages/inventory/inventory";
import Customer from "./pages/customer/customer";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <POSProvider>
        <Routes>
          {/* Public route — accessible without login */}
          <Route path="/login" element={<Login />} />
          <Route path="/customer/:tableId" element={<Customer />} />

          {/* All other routes are protected — requires authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<InterfaceSelector />} />
            <Route path="/menu-manager/*" element={<RestaurantManagement managerType="menu" />} />
            <Route path="/table-manager/*" element={<RestaurantManagement managerType="tables" />} />
            <Route path="/cashier/*" element={<Cashier />} />
            <Route path="/kitchen/*" element={<Kitchen />} />
            <Route path="/inventory" element={<Inventory />} />

            {/* Admin only route — inaccessible to regular employees */}
            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
        </Routes>
      </POSProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
