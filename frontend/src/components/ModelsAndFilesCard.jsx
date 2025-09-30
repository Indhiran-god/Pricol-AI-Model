import React, { useState } from "react";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const ModelsAndFilesCard = ({ theme, models, setModels, collections }) => {
  const [modelStatus, setModelStatus] = useState("");
  const [expandedModel, setExpandedModel] = useState(null);

  const handleLoadModel = async (modelId) => {
    setModelStatus(`Loading model ${modelId}...`);
    try {
      const resp = await fetch(`${API_BASE}/api/load-model/${modelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (resp.ok) {
        const data = await resp.json();
        setModelStatus(`Model ${modelId} loaded: ${data.message}`);
        setModels(
          models.map((m) =>
            m.id === modelId ? { ...m, status: "Loaded" } : m
          )
        );
      } else {
        const errData = await resp.json();
        setModelStatus(`Error: ${errData.message || "Failed to load model"}`);
      }
    } catch (err) {
      setModelStatus(`Error: ${err.message}`);
    }
  };

  const toggleModel = (modelId) => {
    setExpandedModel(expandedModel === modelId ? null : modelId);
  };

  const getCollectionForModel = (modelId) => {
    const collection = collections.find((coll) => coll.id === modelId);
    return collection ? collection.name : "No collection associated";
  };

  return (
    <div
      className={`rounded-2xl shadow-2xl p-6 ${
        theme === "dark" ? "bg-gray-800/80 backdrop-blur-sm" : "bg-white/90 backdrop-blur-sm"
      } border border-gray-200/20`}
    >
      <h2 className="text-xl font-bold mb-4">Models and Associated Collections</h2>
      {models.length === 0 ? (
        <p className="text-gray-500">No models created yet.</p>
      ) : (
        <ul className="space-y-2">
          {models.map((model) => (
            <li
              key={model.id}
              className={`p-3 rounded-lg ${
                theme === "dark" ? "bg-gray-700/30" : "bg-gray-50"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p
                    className="font-semibold cursor-pointer"
                    onClick={() => toggleModel(model.id)}
                  >
                    {model.path} {expandedModel === model.id ? "▼" : "▶"}
                  </p>
                  <p className="text-sm text-gray-500">
                    Context: {model.context_size}, Threads: {model.threads}, Temp: {model.temperature}
                  </p>
                  <p className="text-sm text-gray-500">Status: {model.status || "Not Loaded"}</p>
                </div>
                <button
                  onClick={() => handleLoadModel(model.id)}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Load
                </button>
              </div>
              {expandedModel === model.id && (
                <div className="mt-2 pl-4">
                  <h4 className="text-sm font-semibold">Associated Collection</h4>
                  <p className="text-sm text-gray-500">{getCollectionForModel(model.id)}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {modelStatus && <p className="mt-4 text-sm text-gray-500">{modelStatus}</p>}
    </div>
  );
};

export default ModelsAndFilesCard;