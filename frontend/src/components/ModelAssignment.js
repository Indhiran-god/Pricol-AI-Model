import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const ModelAssignment = ({ theme, user }) => {
  const [models, setModels] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [grades, setGrades] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Assignment states
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch models
      const modelResp = await fetch(`${API_BASE}/api/models`);
      if (modelResp.ok) {
        const modelData = await modelResp.json();
        setModels(modelData.models || []);
      }

      // Fetch users
      const userResp = await fetch(`${API_BASE}/api/users`);
      if (userResp.ok) {
        const userData = await userResp.json();
        setUsers(userData.users || []);
      }

      // Fetch departments
      const deptResp = await fetch(`${API_BASE}/api/departments`);
      if (deptResp.ok) {
        const deptData = await deptResp.json();
        setDepartments(deptData.departments || []);
      }

      // Fetch grades
      const gradeResp = await fetch(`${API_BASE}/api/grades`);
      if (gradeResp.ok) {
        const gradeData = await gradeResp.json();
        setGrades(gradeData.grades || []);
      }

      // Fetch collections
      const collResp = await fetch(`${API_BASE}/api/documents/collections?user_id=${user?.id}`);
      if (collResp.ok) {
        const collData = await collResp.json();
        setCollections(collData.collections || []);
      }

    } catch (err) {
      toast.error(`Error fetching data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const assignModelToUser = async () => {
    if (!selectedModel || !selectedUser) {
      toast.error("Please select both a model and a user");
      return;
    }

    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/api/models/assign/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser,
          model_id: selectedModel,
          assigned_by: user?.id,
          is_default: isDefault
        })
      });

      if (resp.ok) {
        toast.success("Model assigned to user successfully");
        resetForm();
      } else {
        const errorData = await resp.json();
        toast.error(errorData.error || "Failed to assign model to user");
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const assignModelToDepartment = async () => {
    if (!selectedModel || !selectedDepartment) {
      toast.error("Please select both a model and a department");
      return;
    }

    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/api/models/assign/department`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: selectedDepartment,
          model_id: selectedModel,
          assigned_by: user?.id,
          is_default: isDefault
        })
      });

      if (resp.ok) {
        toast.success("Model assigned to department successfully");
        resetForm();
      } else {
        const errorData = await resp.json();
        toast.error(errorData.error || "Failed to assign model to department");
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const assignModelToGrade = async () => {
    if (!selectedModel || !selectedGrade) {
      toast.error("Please select both a model and a grade");
      return;
    }

    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/api/models/assign/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade_id: selectedGrade,
          model_id: selectedModel,
          assigned_by: user?.id,
          is_default: isDefault
        })
      });

      if (resp.ok) {
        toast.success("Model assigned to grade successfully");
        resetForm();
      } else {
        const errorData = await resp.json();
        toast.error(errorData.error || "Failed to assign model to grade");
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedModel("");
    setSelectedUser("");
    setSelectedDepartment("");
    setSelectedGrade("");
    setSelectedCollection("");
    setIsDefault(false);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <ToastContainer position="top-right" autoClose={3000} theme={theme} />
      <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
        Model Assignment Management
      </h1>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Model Selection */}
        <div
          className={`rounded-2xl shadow-2xl p-6 ${
            theme === "dark" ? "bg-gray-800/80 backdrop-blur-sm" : "bg-white/90 backdrop-blur-sm"
          } border border-gray-200/20`}
        >
          <h2 className="text-xl font-bold mb-4">Select Model</h2>
          <div className="space-y-4">
            <div>
              <label className="block font-semibold mb-2">Available Models</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={`w-full p-3 rounded-lg border ${
                  theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
                } focus:ring-2 focus:ring-indigo-500`}
              >
                <option value="">Select a model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.model_path}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="isDefault" className="text-sm font-medium">
                Set as default model
              </label>
            </div>
          </div>
        </div>

        {/* Assignment Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Assign to User */}
          <div
            className={`rounded-2xl shadow-2xl p-6 ${
              theme === "dark" ? "bg-gray-800/80 backdrop-blur-sm" : "bg-white/90 backdrop-blur-sm"
            } border border-gray-200/20`}
          >
            <h3 className="text-lg font-bold mb-4">Assign to User</h3>
            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-2">Select User</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className={`w-full p-3 rounded-lg border ${
                    theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
                  } focus:ring-2 focus:ring-indigo-500`}
                >
                  <option value="">Select a user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={assignModelToUser}
                disabled={loading || !selectedModel || !selectedUser}
                className="w-full p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Assigning..." : "Assign to User"}
              </button>
            </div>
          </div>

          {/* Assign to Department */}
          <div
            className={`rounded-2xl shadow-2xl p-6 ${
              theme === "dark" ? "bg-gray-800/80 backdrop-blur-sm" : "bg-white/90 backdrop-blur-sm"
            } border border-gray-200/20`}
          >
            <h3 className="text-lg font-bold mb-4">Assign to Department</h3>
            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-2">Select Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className={`w-full p-3 rounded-lg border ${
                    theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
                  } focus:ring-2 focus:ring-indigo-500`}
                >
                  <option value="">Select a department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={assignModelToDepartment}
                disabled={loading || !selectedModel || !selectedDepartment}
                className="w-full p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Assigning..." : "Assign to Department"}
              </button>
            </div>
          </div>

          {/* Assign to Grade */}
          <div
            className={`rounded-2xl shadow-2xl p-6 ${
              theme === "dark" ? "bg-gray-800/80 backdrop-blur-sm" : "bg-white/90 backdrop-blur-sm"
            } border border-gray-200/20`}
          >
            <h3 className="text-lg font-bold mb-4">Assign to Grade</h3>
            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-2">Select Grade</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className={`w-full p-3 rounded-lg border ${
                    theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
                  } focus:ring-2 focus:ring-indigo-500`}
                >
                  <option value="">Select a grade</option>
                  {grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.name} (Level {grade.level})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={assignModelToGrade}
                disabled={loading || !selectedModel || !selectedGrade}
                className="w-full p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Assigning..." : "Assign to Grade"}
              </button>
            </div>
          </div>
        </div>

        {/* View Assignments */}
        <div
          className={`rounded-2xl shadow-2xl p-6 ${
            theme === "dark" ? "bg-gray-800/80 backdrop-blur-sm" : "bg-white/90 backdrop-blur-sm"
          } border border-gray-200/20`}
        >
          <h2 className="text-xl font-bold mb-4">View Model Assignments</h2>
          <div className="space-y-4">
            <p className="text-gray-500">
              Use the API endpoints to view detailed assignments:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  GET /api/models/user/{'{user_id}'}
                </code> - Get all models assigned to a user
              </li>
              <li>
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  GET /api/models/assignments/{'{model_id}'}
                </code> - Get all assignments for a specific model
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelAssignment;
