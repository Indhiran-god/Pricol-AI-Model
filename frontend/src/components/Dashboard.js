import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

const Dashboard = ({ theme = 'light', user }) => {
  const userId = user?.id;
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState({});
  const [collections, setCollections] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDepartment, setExpandedDepartment] = useState(null);
  const [expandedCollection, setExpandedCollection] = useState(null);
  const [expandedModel, setExpandedModel] = useState(null);

  // Fetch all data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch departments
        const deptResp = await fetch(`${API_BASE}/api/departments`);
        const deptData = await deptResp.json();
        if (deptResp.ok) {
          setDepartments(deptData.departments || []);
        } else {
          console.error('Failed to fetch departments:', deptData.error);
          toast.error(deptData.error || 'Failed to fetch departments');
        }

        // Fetch users for each department
        const usersData = {};
        for (const dept of deptData.departments || []) {
          const userResp = await fetch(`${API_BASE}/api/users?department_id=${dept.id}`);
          const userData = await userResp.json();
          if (userResp.ok) {
            usersData[dept.id] = userData.users || [];
          } else {
            console.error(`Failed to fetch users for department ${dept.id}:`, userData.error);
            toast.error(userData.error || `Failed to fetch users for ${dept.name}`);
          }
        }
        setUsers(usersData);

        // Fetch collections
        const collResp = await fetch(`${API_BASE}/api/documents/collections?user_id=${userId}`);
        const collData = await collResp.json();
        if (collResp.ok) {
          setCollections(collData.collections || []);
        } else {
          console.error('Failed to fetch collections:', collData.error);
          toast.error(collData.error || 'Failed to fetch collections');
        }

        // Fetch models
        const modelResp = await fetch(`${API_BASE}/api/models`);
        const modelData = await modelResp.json();
        if (modelResp.ok) {
          setModels(
            Object.entries(modelData.models || {}).map(([id, config]) => ({
              id,
              ...config,
            }))
          );
        } else {
          console.error('Failed to fetch models:', modelData.error);
          toast.error(modelData.error || 'Failed to fetch models');
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        toast.error(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  // Toggle department expansion
  const toggleDepartment = (deptId) => {
    setExpandedDepartment(expandedDepartment === deptId ? null : deptId);
  };

  // Toggle collection expansion
  const toggleCollection = (collId) => {
    setExpandedCollection(expandedCollection === collId ? null : collId);
  };

  // Toggle model expansion
  const toggleModel = (modelId) => {
    setExpandedModel(expandedModel === modelId ? null : modelId);
  };

  // Get collection name for a model
  const getCollectionName = (collectionId) => {
    const collection = collections.find((coll) => coll.id === collectionId);
    return collection ? collection.name : 'No collection assigned';
  };

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-900'}`}>
      <ToastContainer position="top-right" autoClose={3000} theme={theme} />
      <h1 className="text-4xl sm:text-5xl font-extrabold mb-10 text-center tracking-tight">Dashboard Overview</h1>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-600 border-opacity-50"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Card 1: Departments */}
          <div
            className={`rounded-3xl shadow-xl p-6 transform hover:scale-105 transition-transform duration-300 ${
              theme === 'dark' ? 'bg-gray-800/90 backdrop-blur-md' : 'bg-white/95 backdrop-blur-md'
            } border border-indigo-200/30`}
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <span className="mr-2">🏢</span> Departments
            </h2>
            {departments.length === 0 ? (
              <p className="text-gray-500 italic">No departments found.</p>
            ) : (
              <ul className="space-y-3">
                {departments.map((dept) => (
                  <li
                    key={dept.id}
                    className={`p-4 rounded-xl cursor-pointer hover:shadow-md transition-shadow ${
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-indigo-50/50'
                    }`}
                    onClick={() => toggleDepartment(dept.id)}
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-lg">
                        {dept.name} ({(users[dept.id] || []).length} users)
                      </p>
                      <span className="text-xl">{expandedDepartment === dept.id ? '▼' : '▶'}</span>
                    </div>
                    {expandedDepartment === dept.id && (
                      <div className="mt-3 pl-4 animate-fadeIn">
                        <h4 className="text-sm font-semibold mb-2">Users:</h4>
                        {users[dept.id] && users[dept.id].length > 0 ? (
                          <ul className="space-y-1">
                            {users[dept.id].map((user) => (
                              <li key={user.id} className="text-sm text-gray-600 flex items-center">
                                <span className="mr-2">👤</span> {user.name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No users in this department.</p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Card 2: Collections */}
          <div
            className={`rounded-3xl shadow-xl p-6 transform hover:scale-105 transition-transform duration-300 ${
              theme === 'dark' ? 'bg-gray-800/90 backdrop-blur-md' : 'bg-white/95 backdrop-blur-md'
            } border border-indigo-200/30`}
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <span className="mr-2"></span> Collections
            </h2>
            {collections.length === 0 ? (
              <p className="text-gray-500 italic">No collections found.</p>
            ) : (
              <ul className="space-y-3">
                {collections.map((coll) => (
                  <li
                    key={coll.id}
                    className={`p-4 rounded-xl cursor-pointer hover:shadow-md transition-shadow ${
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-indigo-50/50'
                    }`}
                    onClick={() => toggleCollection(coll.id)}
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-lg">{coll.name}</p>
                      <span className="text-xl">{expandedCollection === coll.id ? '▼' : '▶'}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{coll.files ? coll.files.length : 0} files</p>
                    {expandedCollection === coll.id && (
                      <div className="mt-3 pl-4 animate-fadeIn">
                        <h4 className="text-sm font-semibold mb-2">Files:</h4>
                        {coll.files && coll.files.length > 0 ? (
                          <ul className="space-y-1">
                            {coll.files.map((file, index) => (
                              <li key={index} className="text-sm text-gray-600 flex items-center">
                                <span className="mr-2"></span> {file.name || file}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No files in this collection.</p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Card 3: Models */}
          <div
            className={`rounded-3xl shadow-xl p-6 transform hover:scale-105 transition-transform duration-300 ${
              theme === 'dark' ? 'bg-gray-800/90 backdrop-blur-md' : 'bg-white/95 backdrop-blur-md'
            } border border-indigo-200/30`}
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <span className="mr-2"></span> Models
            </h2>
            {models.length === 0 ? (
              <p className="text-gray-500 italic">No models created yet.</p>
            ) : (
              <ul className="space-y-3">
                {models.map((model) => (
                  <li
                    key={model.id}
                    className={`p-4 rounded-xl cursor-pointer hover:shadow-md transition-shadow ${
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-indigo-50/50'
                    }`}
                    onClick={() => toggleModel(model.id)}
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-lg">{model.path}</p>
                      <span className="text-xl">{expandedModel === model.id ? '▼' : '▶'}</span>
                    </div>
                    {expandedModel === model.id && (
                      <div className="mt-3 pl-4 animate-fadeIn">
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold">Collection:</span> {getCollectionName(model.collection_id)}
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold">Created:</span>{' '}
                          {model.created_at
                            ? new Date(model.created_at).toLocaleString()
                            : 'Unknown'}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;