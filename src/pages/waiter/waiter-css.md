/* WaiterView styles */

/* ---- Two-column layout ---- */
.layout-split {
  display: flex;
  gap: 20px;
}
.layout-split .main {
  flex: 1;
  min-width: 0;
}
.layout-split .sidebar {
  width: 360px;
  flex-shrink: 0;
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .layout-split {
    flex-direction: column;
  }
  .layout-split .sidebar {
    width: 100%;
  }
}
