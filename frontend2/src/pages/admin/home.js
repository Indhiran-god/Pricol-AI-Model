import React, { useState, useEffect } from "react";
import LOGO from '../../assets/logo.png';
import Dashboard from '../../components/Dashboard'
import GradesPage from "../../components/Grade";
import DepartmentsPage from "../../components/Department";
import UsersPage from "../../components/Userspage";
import DocumentAccess from '../../components/Modelaccess'; // Renamed to PascalCase
import DocumentsPage from "../../components/Doc";
import Chatpage from "./chatbot";
import DatabaseAndModel from "../../components/Data";
import UserHistory from "../../components/Userhistory";
import ModelAssignment from "../../components/ModelAssignment";
import { Navigate } from "react-router-dom"; // Added for redirect if user is null

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const AdminHome = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [theme, setTheme] = useState("light");
  const [systemStatus, setSystemStatus] = useState({
    model_loaded: false,
    db_ready: false,
    ready: false,
  });
  const [operationTimes, setOperationTimes] = useState({
    status: null,
    chat: null,
    historyFetch: null,
    historyDelete: null,
  });
  const [fetchError, setFetchError] = useState(null); // Added for error handling

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleLogout = () => {
    onLogout();
  };

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/status`);
        if (response.ok) {
          const data = await response.json();
          setSystemStatus(data);
          setOperationTimes((prev) => ({
            ...prev,
            status: data.status_time || null,
          }));
          setFetchError(null); // Clear error on success
        } else {
          setFetchError("Failed to fetch system status");
        }
      } catch (error) {
        console.error("Failed to fetch system status:", error);
        setFetchError("Failed to fetch system status");
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Increased to 30 seconds
    return () => clearInterval(interval);
  });

  const tabs = [
    { key: "dashboard", label: "Dashboard"},
    { key: "departments", label: "Departments" },
     { key: "grades", label: "Grades" },
    { key: "users", label: "Users" },
    { key: "documentaccess", label: "model-access" }, // Fixed typo
    { key: "documents", label: "Documents" },
    { key: "chatbot", label: "Chatbot" },
    { key: "databaseandmodel", label: "Model Configuration" },
    { key: "modelassignment", label: "Model Assignment" },
    { key: "users-history", label: "User History" },
  ];

  const renderContent = () => {
    if (fetchError) {
      return <div className="text-red-500">Error: {fetchError}</div>; // Fallback UI for errors
    }

    const props = { theme, user, isSystemReady: systemStatus.ready, operationTimes, setOperationTimes };

    switch (activeTab) {
      case "dashboard":
       return <Dashboard {...props} />;
      case "grades":
        return <GradesPage {...props} />;
      case "departments":
        return <DepartmentsPage {...props} />;
      case "users":
        return <UsersPage {...props} />;
      case "documentaccess": // Fixed case
        return <DocumentAccess {...props} />;
      case "documents":
        return <DocumentsPage {...props} />;
      case "chatbot":
        return <Chatpage {...props} />;
      case "databaseandmodel":
        return <DatabaseAndModel {...props} />;
      case "modelassignment":
        return <ModelAssignment {...props} />;
      case "users-history":
        return <UserHistory {...props} />;
      default:
        return <div className="text-red-500">Error: Invalid tab selected</div>; // Improved default case
    }
  };

  // Redirect if user is not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className={`flex min-h-screen ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      <aside
        className={`w-64 flex flex-col justify-between ${
          theme === "dark" ? "bg-gray-800" : "bg-gray-900"
        } text-white p-4`}
      >
        <div>
          <div className="flex items-center justify-between mb-8">
            <img src={LOGO} alt="Logo" className="h-10" />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-700"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              aria-label={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"} // Added for accessibility
            >
              {theme === "light" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
                  />
                </svg>
              )}
            </button>
          </div>

          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-indigo-600 text-white"
                    : theme === "dark"
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
                aria-current={activeTab === tab.key ? "page" : undefined} // Added for accessibility
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 space-y-3">
          <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-gray-700" : "bg-gray-800"}`}>
            <div className="text-sm font-medium">{user.username}</div>
            <div className="text-xs text-gray-400 capitalize">{user.role}</div>
            <div className="flex items-center mt-2 space-x-2">
              <div className={`w-2 h-2 rounded-full ${systemStatus.ready ? "bg-green-500" : "bg-red-500"}`}></div>
              <span className="text-xs">System {systemStatus.ready ? "Ready" : "Offline"}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Admin Control Center
          </h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${systemStatus.db_ready ? "bg-green-500" : "bg-red-500"}`}></div>
              <span className="text-sm">Database</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${systemStatus.model_loaded ? "bg-green-500" : "bg-red-500"}`}></div>
              <span className="text-sm">Model</span>
            </div>
          </div>
        </div>

        <div className="mt-4">{renderContent()}</div>
      </main>
    </div>
  );
};

export default AdminHome;
