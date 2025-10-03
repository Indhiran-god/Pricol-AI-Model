// src/components/DepartmentsPage.jsx
import React, { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const DepartmentsPage = ({ theme }) => {
  const [departments, setDepartments] = useState([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [recentlyAdded, setRecentlyAdded] = useState([]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/departments`);
      if (resp.ok) {
        const json = await resp.json();
        setDepartments(json.departments || []);
      }
    } catch (err) {
      console.debug("Fetch departments error:", err.message);
    }
  };

  const createDepartment = async () => {
    if (!newDeptName.trim()) return;
    try {
      const resp = await fetch(`${API_BASE}/api/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptName }),
      });
      if (resp.ok) {
        const newDept = await resp.json();
        fetchDepartments();
        setRecentlyAdded([newDept, ...recentlyAdded].slice(0, 5));
        setNewDeptName("");
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const updateDepartment = async (id, name) => {
    try {
      const resp = await fetch(`${API_BASE}/api/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (resp.ok) {
        fetchDepartments();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const deleteDepartment = async (id) => {
    try {
      const resp = await fetch(`${API_BASE}/api/departments/${id}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        fetchDepartments();
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
      <h2 className="text-xl sm:text-2xl font-bold mb-6">Departments</h2>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          value={newDeptName}
          onChange={(e) => setNewDeptName(e.target.value)}
          placeholder="New Department Name"
          className={`flex-1 p-3 rounded-lg ${
            theme === "dark" ? "bg-gray-700/50 text-white border-gray-600" : "bg-gray-50 text-gray-900 border-gray-200"
          } border focus:ring-2 focus:ring-indigo-500 transition-all`}
        />
        <button
          onClick={createDepartment}
          className="px-4 sm:px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Add
        </button>
      </div>
      <div className="grid gap-4">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className={`flex items-center justify-between p-4 rounded-lg ${
              theme === "dark" ? "bg-gray-700/50" : "bg-gray-100"
            }`}
          >
            <input
              type="text"
              defaultValue={dept.name}
              onBlur={(e) => updateDepartment(dept.id, e.target.value)}
              className={`flex-1 p-2 rounded ${
                theme === "dark" ? "bg-gray-600/50 text-white" : "bg-white text-gray-900"
              } border-none focus:ring-2 focus:ring-indigo-500`}
            />
            <button
              onClick={() => deleteDepartment(dept.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {recentlyAdded.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Recently Added Departments</h3>
          <ul className="space-y-2">
            {recentlyAdded.map((dept) => (
              <li
                key={dept.id}
                className={`p-3 rounded-lg ${theme === "dark" ? "bg-gray-700/30" : "bg-gray-50"}`}
              >
                {dept.name} (ID: {dept.id})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DepartmentsPage;