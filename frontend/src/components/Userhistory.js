import React, { useEffect, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const Userhistory = ({ theme }) => {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userHistory, setUserHistory] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  // Fetch departments + users
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptResp, usersResp] = await Promise.all([
          fetch(`${API_BASE}/api/departments`),
          fetch(`${API_BASE}/api/users`),
        ]);
        const deptData = deptResp.ok ? await deptResp.json() : { departments: [] };
        const usersData = usersResp.ok ? await usersResp.json() : { users: [] };
        
        console.log("Departments fetched:", deptData);
        console.log("Users fetched:", usersData);

        setDepartments(deptData.departments || []);
        setUsers(usersData.users || []);
      } catch (err) {
        console.error("Fetch error:", err.message);
      }
    };
    fetchData();
  }, []);

  // Update filtered users when department changes
  useEffect(() => {
    console.log("Selected Department:", selectedDept);
    console.log("Users:", users);
    
    if (selectedDept) {
      const filtered = users.filter((u) => String(u.departmentId) === String(selectedDept));
      console.log("Filtered Users:", filtered);
      setFilteredUsers(filtered);
      setSelectedUser(""); // Reset user when dept changes
      setUserHistory([]);
    } else {
      setFilteredUsers([]);
    }
  }, [selectedDept, users]);

  // Fetch user history
  const fetchUserHistory = async (userId) => {
    try {
      const resp = await fetch(`${API_BASE}/api/history/user/${userId}`);
      const historyData = resp.ok ? await resp.json() : { history: [] };
      console.log("User History fetched:", historyData);
      setUserHistory(historyData.history || []);
    } catch (err) {
      console.error("Fetch user history error:", err.message);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      fetchUserHistory(selectedUser);
    } else {
      setUserHistory([]);
    }
  }, [selectedUser]);

  return (
    <div
      className={`rounded-2xl shadow-2xl p-6 grid grid-cols-1 gap-6 ${
        theme === "dark"
          ? "bg-gray-800/80 backdrop-blur-sm"
          : "bg-white/90 backdrop-blur-sm"
      } border border-gray-200/20`}
    >
      <h2 className="text-xl font-bold mb-4">User History</h2>

      {/* Department Dropdown */}
      <select
        value={selectedDept}
        onChange={(e) => setSelectedDept(e.target.value)}
        className="w-full p-3 rounded-lg border mb-4"
      >
        <option value="">Select Department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {/* User Dropdown (filtered by department) */}
      {selectedDept && (
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="w-full p-3 rounded-lg border mb-4"
        >
          <option value="">Select User</option>
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))
          ) : (
            <option value="" disabled>
              No users found for this department
            </option>
          )}
        </select>
      )}

      {/* User History */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {userHistory.length > 0 ? (
          userHistory.map((entry, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${
                theme === "dark" ? "bg-gray-700/50" : "bg-gray-100"
              }`}
            >
              <p className="font-semibold">{entry.action}</p>
              <p className="text-sm text-gray-500">
                User: {entry.username} (ID: {entry.userId})
              </p>
              <p className="text-xs text-gray-400">
                {new Date(entry.timestamp).toLocaleString()}
              </p>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm">
            {selectedUser
              ? "No history available for this user."
              : "Select a department and user to view history."}
          </p>
        )}
      </div>
    </div>
  );
};

export default Userhistory;