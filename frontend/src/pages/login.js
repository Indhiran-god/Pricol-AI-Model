import React, { useState, useEffect } from "react";
import LOGO from '../assets/logo.png'

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const LoginPage = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "staff", // default role
  });
  const [theme, setTheme] = useState("light");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(""); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Login successful:", data);
        onLogin(data.user); // Pass user data to parent component
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  return (
    <div className={`flex flex-col min-h-screen ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"}`}>
      <header className={`${theme === "dark" ? "bg-gray-800" : "bg-gray-900"} text-white py-4 px-6 shadow-md`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <img src={LOGO} alt="HR Policy Dashboard Logo" className="h-10" />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-700"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className={`p-8 rounded-lg shadow-lg w-96 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`}
        >
          <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>

          {/* Username */}
          <div className="mb-4">
            <label className={`block mb-1 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300 text-gray-900"
              }`}
              placeholder="Enter username"
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className={`block mb-1 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300 text-gray-900"
              }`}
              placeholder="Enter password"
            />
          </div>

          {/* Role */}
          <div className="mb-6">
            <label className={`block mb-1 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300 text-gray-900"
              }`}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 text-white rounded-lg transition ${
              loading 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Logging in...
              </div>
            ) : (
              "Login"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
