
# Refactor plan

This project has several very large components.
Recommended extraction order:

1. SftpPane.jsx
   - useSftpActions.js
   - SftpContextMenu.jsx
   - SftpToolbar.jsx

2. Sidebar.jsx
   - SidebarGroups.jsx
   - SidebarHosts.jsx
   - SidebarActions.jsx

3. App.jsx
   - Zustand store

The goal is reducing regression risk and improving maintainability.
