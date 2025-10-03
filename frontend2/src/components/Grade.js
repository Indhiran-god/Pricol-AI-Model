// src/components/GradesPage.jsx
import React, { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const GradesPage = ({ theme }) => {
  const [grades, setGrades] = useState([]);
  const [newGrade, setNewGrade] = useState({ name: "", level: "", description: "" });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGrades();
    fetchUsers();
  }, []);

  const fetchGrades = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/grades`);
      if (resp.ok) {
        const json = await resp.json();
        setGrades(json.grades || []);
      }
    } catch (err) {
      console.debug("Fetch grades error:", err.message);
    }
  };

  const fetchUsers = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/users`);
      if (resp.ok) {
        const json = await resp.json();
        setUsers(json.users || []);
      }
    } catch (err) {
      console.debug("Fetch users error:", err.message);
    }
  };

  const addGrade = async () => {
    if (!newGrade.name.trim() || !newGrade.level) return;
    
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGrade),
      });
      if (resp.ok) {
        await resp.json();
        fetchGrades();
        setNewGrade({ name: "", level: "", description: "" });
      } else {
        const error = await resp.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateGrade = async (id, data) => {
    try {
      const resp = await fetch(`${API_BASE}/api/grades/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (resp.ok) {
        fetchGrades();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const deleteGrade = async (id) => {
    if (users.some((user) => user.grade_id === id)) {
      alert("Cannot delete grade in use by users");
      return;
    }
    
    try {
      const resp = await fetch(`${API_BASE}/api/grades/${id}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        fetchGrades();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div
      className={`rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 ${
        theme === "dark" ? "bg-gray-800/80 backdrop-blur-sm" : "bg-white/90 backdrop-blur-sm"
      } border border-gray-200/20`}
    >
      <h2 className="text-xl sm:text-2xl font-bold mb-6">Manage Grades</h2>
      
      {/* Add Grade Form */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <input
          type="text"
          value={newGrade.name}
          onChange={(e) => setNewGrade({ ...newGrade, name: e.target.value })}
          placeholder="Grade Name"
          className={`p-3 rounded-lg ${
            theme === "dark" ? "bg-gray-700/50 text-white border-gray-600" : "bg-gray-50 text-gray-900 border-gray-200"
          } border focus:ring-2 focus:ring-indigo-500 transition-all`}
        />
        <input
          type="number"
          value={newGrade.level}
          onChange={(e) => setNewGrade({ ...newGrade, level: parseInt(e.target.value) || "" })}
          placeholder="Level (1-10)"
          className={`p-3 rounded-lg ${
            theme === "dark" ? "bg-gray-700/50 text-white border-gray-600" : "bg-gray-50 text-gray-900 border-gray-200"
          } border focus:ring-2 focus:ring-indigo-500 transition-all`}
        />
        <input
          type="text"
          value={newGrade.description}
          onChange={(e) => setNewGrade({ ...newGrade, description: e.target.value })}
          placeholder="Description"
          className={`p-3 rounded-lg ${
            theme === "dark" ? "bg-gray-700/50 text-white border-gray-600" : "bg-gray-50 text-gray-900 border-gray-200"
          } border focus:ring-2 focus:ring-indigo-500 transition-all`}
        />
      </div>
      <button
        onClick={addGrade}
        disabled={loading}
        className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors mb-6 disabled:opacity-50"
      >
        {loading ? "Adding..." : "Add Grade"}
      </button>

      {/* Grades List */}
      <div className="grid gap-4">
        {grades.map((grade) => (
          <div
            key={grade.id}
            className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg ${
              theme === "dark" ? "bg-gray-700/50" : "bg-gray-100"
            }`}
          >
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 sm:mb-0">
              <input
                type="text"
                defaultValue={grade.name}
                onBlur={(e) => updateGrade(grade.id, { ...grade, name: e.target.value })}
                className={`p-2 rounded w-full ${
                  theme === "dark" ? "bg-gray-600/50 text-white" : "bg-white text-gray-900"
                } border-none focus:ring-2 focus:ring-indigo-500`}
              />
              <input
                type="number"
                defaultValue={grade.level}
                onBlur={(e) => updateGrade(grade.id, { ...grade, level: parseInt(e.target.value) || grade.level })}
                className={`p-2 rounded w-full ${
                  theme === "dark" ? "bg-gray-600/50 text-white" : "bg-white text-gray-900"
                } border-none focus:ring-2 focus:ring-indigo-500`}
              />
              <input
                type="text"
                defaultValue={grade.description}
                onBlur={(e) => updateGrade(grade.id, { ...grade, description: e.target.value })}
                className={`p-2 rounded w-full ${
                  theme === "dark" ? "bg-gray-600/50 text-white" : "bg-white text-gray-900"
                } border-none focus:ring-2 focus:ring-indigo-500`}
              />
            </div>
            <button
              onClick={() => deleteGrade(grade.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GradesPage;
