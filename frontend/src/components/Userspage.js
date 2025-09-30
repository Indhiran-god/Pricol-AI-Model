import React, { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const UsersPage = ({ theme }) => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [grades, setGrades] = useState([]);
  const [roles] = useState(["staff", "admin"]);
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    grade_id: "",
    department_id: "",
    role: "staff",
  });
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersResp, deptsResp, gradesResp] = await Promise.all([
        fetch(`${API_BASE}/api/users`),
        fetch(`${API_BASE}/api/departments`),
        fetch(`${API_BASE}/api/grades`),
      ]);

      if (usersResp.ok) {
        const usersData = await usersResp.json();
        setUsers(usersData.users || []);
      } else {
        console.error("Users fetch failed:", usersResp.status, usersResp.statusText);
        setError(`Failed to fetch users: ${usersResp.statusText}`);
      }

      if (deptsResp.ok) {
        const deptsData = await deptsResp.json();
        setDepartments(deptsData.departments || []);
      } else {
        console.error("Departments fetch failed:", deptsResp.status, deptsResp.statusText);
        setError(`Failed to fetch departments: ${deptsResp.statusText}`);
      }

      if (gradesResp.ok) {
        const gradesData = await gradesResp.json();
        setGrades(gradesData.grades || []);
      } else {
        console.error("Grades fetch failed:", gradesResp.status, gradesResp.statusText);
        setError(`Failed to fetch grades: ${gradesResp.statusText}`);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addUser = async () => {
    if (!newUserData.username || !newUserData.password || !newUserData.grade_id || !newUserData.department_id || !newUserData.role) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newUserData,
          grade_id: parseInt(newUserData.grade_id, 10),
          department_id: parseInt(newUserData.department_id, 10),
        }),
      });
      
      if (resp.ok) {
        const result = await resp.json();
        const newUser = { 
          id: result.user_id, 
          ...newUserData, 
          grade_id: parseInt(newUserData.grade_id, 10), 
          department_id: parseInt(newUserData.department_id, 10),
          department_name: departments.find(d => d.id === parseInt(newUserData.department_id, 10))?.name,
          grade_name: grades.find(g => g.id === parseInt(newUserData.grade_id, 10))?.name
        };
        
        setUsers([...users, newUser]);
        setRecentlyAdded([{ id: result.user_id, username: newUserData.username, role: newUserData.role }, ...recentlyAdded].slice(0, 5));
        setNewUserData({ username: "", password: "", grade_id: "", department_id: "", role: "staff" });
        setError("");
      } else {
        const errorData = await resp.json();
        setError(`Error: ${errorData.error}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE" });
      if (resp.ok) {
        setUsers(users.filter((user) => user.id !== id));
        setRecentlyAdded(recentlyAdded.filter((user) => user.id !== id));
        setError("");
      } else {
        const errorData = await resp.json();
        setError(`Error: ${errorData.error}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentName = (departmentId) => {
    return departments.find(d => d.id === departmentId)?.name || "N/A";
  };

  const getGradeName = (gradeId) => {
    return grades.find(g => g.id === gradeId)?.name || "N/A";
  };

  return (
    <div
      className={`min-h-screen p-4 sm:p-6 md:p-8 ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">User Management</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-lg text-sm">
            Loading...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add User Form (Left Side) */}
          <div className={`p-6 rounded-2xl shadow-lg ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4">Add New User</h3>
            <div className="grid grid-cols-1 gap-4">
              <input
                type="text"
                value={newUserData.username}
                onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                placeholder="Username"
                className={`p-3 rounded-lg border ${
                  theme === "dark"
                    ? "bg-gray-700 text-white border-gray-600 focus:ring-indigo-500"
                    : "bg-gray-50 text-gray-900 border-gray-200 focus:ring-indigo-400"
                } focus:ring-2 focus:outline-none transition-colors`}
              />
              <input
                type="password"
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                placeholder="Password (min 6 characters)"
                className={`p-3 rounded-lg border ${
                  theme === "dark"
                    ? "bg-gray-700 text-white border-gray-600 focus:ring-indigo-500"
                    : "bg-gray-50 text-gray-900 border-gray-200 focus:ring-indigo-400"
                } focus:ring-2 focus:outline-none transition-colors`}
              />
              <select
                value={newUserData.grade_id}
                onChange={(e) => setNewUserData({ ...newUserData, grade_id: e.target.value })}
                className={`p-3 rounded-lg border ${
                  theme === "dark"
                    ? "bg-gray-700 text-white border-gray-600 focus:ring-indigo-500"
                    : "bg-gray-50 text-gray-900 border-gray-200 focus:ring-indigo-400"
                } focus:ring-2 focus:outline-none transition-colors`}
              >
                <option value="">Select Grade</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
              <select
                value={newUserData.department_id}
                onChange={(e) => setNewUserData({ ...newUserData, department_id: e.target.value })}
                className={`p-3 rounded-lg border ${
                  theme === "dark"
                    ? "bg-gray-700 text-white border-gray-600 focus:ring-indigo-500"
                    : "bg-gray-50 text-gray-900 border-gray-200 focus:ring-indigo-400"
                } focus:ring-2 focus:outline-none transition-colors`}
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <select
                value={newUserData.role}
                onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                className={`p-3 rounded-lg border ${
                  theme === "dark"
                    ? "bg-gray-700 text-white border-gray-600 focus:ring-indigo-500"
                    : "bg-gray-50 text-gray-900 border-gray-200 focus:ring-indigo-400"
                } focus:ring-2 focus:outline-none transition-colors`}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
              <button
                onClick={addUser}
                disabled={loading}
                className={`w-full py-3 rounded-lg transition-colors font-medium ${
                  loading 
                    ? "bg-gray-400 cursor-not-allowed" 
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {loading ? "Adding..." : "Add User"}
              </button>
            </div>
          </div>

          {/* Users List (Right Side) */}
          <div className={`p-6 rounded-2xl shadow-lg ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4">Existing Users ({users.length})</h3>
            <div className="max-h-[500px] overflow-y-auto pr-2">
              {users.length === 0 ? (
                <p className="text-gray-500">No users found.</p>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className={`p-4 rounded-lg ${
                        theme === "dark" ? "bg-gray-700/50" : "bg-gray-50"
                      } transition-all hover:shadow-md`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">{user.username}</h4>
                          <p className="text-sm mt-1">
                            <span className="font-medium">Grade:</span> {getGradeName(user.grade_id)}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Department:</span> {getDepartmentName(user.department_id)}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Role:</span> {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteUser(user.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recently Added */}
        {recentlyAdded.length > 0 && (
          <div
            className={`mt-6 p-6 rounded-2xl shadow-lg ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
          >
            <h3 className="text-lg font-semibold mb-4">Recently Added Users</h3>
            <ul className="space-y-2">
              {recentlyAdded.map((user) => (
                <li
                  key={user.id}
                  className={`p-3 rounded-lg ${
                    theme === "dark" ? "bg-gray-700/30" : "bg-gray-50"
                  } transition-all hover:bg-opacity-80`}
                >
                  {user.username} (ID: {user.id}, Role: {user.role.charAt(0).toUpperCase() + user.role.slice(1)})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;