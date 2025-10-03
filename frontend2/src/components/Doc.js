import React, { useState, useEffect, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const DocumentsPage = ({ theme, user }) => {
  const userId = user?.id;
  const [collections, setCollections] = useState([]);
  const [uploadData, setUploadData] = useState({ dbName: "", files: [] });
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedCollections, setExpandedCollections] = useState({}); // State to track expanded collections
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCollections();
  }, [userId]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/api/documents/collections?user_id=${userId}`);
      const data = await resp.json();
      if (resp.ok) {
        setCollections(data.collections || []);
        // Initialize all collections as collapsed
        const initialExpanded = {};
        data.collections.forEach((coll) => {
          initialExpanded[coll.id] = false;
        });
        setExpandedCollections(initialExpanded);
      } else {
        toast.error(data.error || "Failed to fetch collections");
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async () => {
    if (!uploadData.dbName.trim() || !uploadData.files.length) {
      toast.error("Please enter a collection name and select files");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("db_name", uploadData.dbName);
      formData.append("user_id", userId);

      Array.from(uploadData.files).forEach((file) => {
        formData.append("files", file);
      });

      const resp = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const result = await resp.json();
      if (resp.ok) {
        await fetchCollections();
        setRecentlyAdded([
          {
            name: `Uploaded ${uploadData.files.length} file(s) to ${uploadData.dbName}`,
            id: result.collection_name,
            timestamp: new Date().toLocaleString(),
          },
          ...recentlyAdded,
        ].slice(0, 5));
        setUploadData({ dbName: "", files: [] });
        fileInputRef.current.value = "";
        toast.success(`Successfully uploaded ${uploadData.files.length} file(s) to "${uploadData.dbName}"`);
      } else {
        toast.error(result.error || "Failed to upload files");
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const invalidFiles = files.filter(
      (file) => !["pdf", "txt", "docx"].includes(file.name.split(".").pop().toLowerCase())
    );
    if (invalidFiles.length > 0) {
      toast.error("Only PDF, TXT, and DOCX files are allowed");
      return;
    }
    setUploadData({ ...uploadData, files });
  };

  const refreshCollections = async () => {
    try {
      setLoading(true);
      await fetchCollections();
      toast.success("Collections refreshed successfully!");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (dbName, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}" from "${dbName}"?`)) return;

    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/api/documents/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ db_name: dbName, filename, user_id: userId }),
      });
      const result = await resp.json();
      if (resp.ok) {
        await fetchCollections();
        setRecentlyAdded([
          {
            name: `Deleted file "${filename}" from "${dbName}"`,
            id: dbName,
            timestamp: new Date().toLocaleString(),
          },
          ...recentlyAdded,
        ].slice(0, 5));
        toast.success(result.message);
      } else {
        toast.error(result.error || "Failed to delete file");
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteCollection = async (dbName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the collection "${dbName}"? This will delete all files in the collection.`
      )
    )
      return;

    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/api/documents/collections`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ db_name: dbName, user_id: userId }),
      });

      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error || `HTTP error! status: ${resp.status}`);
      }

      const result = await resp.json();
      await fetchCollections();
      setRecentlyAdded([
        {
          name: `Deleted collection "${dbName}"`,
          id: dbName,
          timestamp: new Date().toLocaleString(),
        },
        ...recentlyAdded,
      ].slice(0, 5));
      toast.success(result.message);
    } catch (err) {
      console.error("Delete collection error:", err);
      toast.error(`Error deleting collection: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleCollection = (collectionId) => {
    setExpandedCollections((prev) => ({
      ...prev,
      [collectionId]: !prev[collectionId],
    }));
  };

  return (
    <div
      className={`rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 ${
        theme === "dark" ? "bg-gray-800/80 backdrop-blur-sm" : "bg-white/90 backdrop-blur-sm"
      } border border-gray-200/20`}
    >
      <ToastContainer position="top-right" autoClose={3000} theme={theme} />

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Document Collections</h2>
        <button
          onClick={refreshCollections}
          disabled={loading}
          className={`px-4 py-2 rounded-lg transition-colors ${
            theme === "dark"
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-gray-200 hover:bg-gray-300 text-gray-800"
          } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label="Refresh collections"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Upload Files */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Upload Files to Collection</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Enter collection name (creates new if it doesn't exist)"
            value={uploadData.dbName}
            onChange={(e) => setUploadData({ ...uploadData, dbName: e.target.value })}
            className={`p-3 rounded-lg border ${
              theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
            } focus:ring-2 focus:ring-indigo-500`}
            aria-label="Collection name"
          />
          <div>
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.docx"
              onChange={handleFileChange}
              ref={fileInputRef}
              className={`p-3 rounded-lg border w-full ${
                theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
              } focus:ring-2 focus:ring-indigo-500`}
              aria-label="Select files to upload"
            />
            {uploadData.files.length > 0 && (
              <p className="text-sm mt-2 text-gray-500">
                Selected {uploadData.files.length} file(s)
              </p>
            )}
          </div>
        </div>

        <button
          onClick={uploadFiles}
          disabled={loading || !uploadData.dbName.trim() || uploadData.files.length === 0}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Upload files"
        >
          {loading ? "Uploading..." : "Upload Files"}
        </button>
      </div>

      {/* Display Collections and Files */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Collections</h3>
        {loading ? (
          <p className="text-gray-500">Loading collections...</p>
        ) : collections.length === 0 ? (
          <p className="text-gray-500">No collections found. Upload files to create one.</p>
        ) : (
          collections.map((coll) => (
            <div
              key={coll.id}
              className="mb-6 p-4 rounded-lg border border-gray-200/20"
            >
              <div
                className="flex justify-between items-center mb-3 cursor-pointer"
                onClick={() => toggleCollection(coll.id)}
                role="button"
                aria-expanded={expandedCollections[coll.id]}
                aria-label={`Toggle collection ${coll.name}`}
              >
                <div className="flex items-center space-x-2">
                  <h4 className="text-lg font-semibold">{coll.name}</h4>
                  <span className="text-sm text-gray-500">
                    ({coll.files ? coll.files.length : 0} files)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering toggleCollection
                      deleteCollection(coll.name);
                    }}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      theme === "dark"
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-red-500 hover:bg-red-600 text-white"
                    } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={loading}
                    aria-label={`Delete collection ${coll.name}`}
                  >
                    Delete Collection
                  </button>
                  <svg
                    className={`w-5 h-5 transform transition-transform ${
                      expandedCollections[coll.id] ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
              {expandedCollections[coll.id] && (
                <div>
                  {coll.files && coll.files.length > 0 ? (
                    <ul className="space-y-2">
                      {coll.files.map((file, index) => (
                        <li
                          key={index}
                          className={`p-3 rounded-lg flex justify-between items-center ${
                            theme === "dark" ? "bg-gray-700/30" : "bg-gray-50"
                          }`}
                        >
                          <span>{file}</span>
                          <button
                            onClick={() => deleteFile(coll.name, file)}
                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                              theme === "dark"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-red-500 hover:bg-red-600 text-white"
                            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                            disabled={loading}
                            aria-label={`Delete file ${file}`}
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No files in this collection</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {recentlyAdded.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Recent Activity</h3>
          <ul className="space-y-2">
            {recentlyAdded.map((item, index) => (
              <li
                key={index}
                className={`p-3 rounded-lg ${
                  theme === "dark" ? "bg-gray-700/30" : "bg-gray-50"
                }`}
              >
                {item.name} <span className="text-sm text-gray-500">({item.timestamp})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;