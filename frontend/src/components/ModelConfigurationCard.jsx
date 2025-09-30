import React, { useState } from "react";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const ModelConfigurationCard = ({ theme, user, collections, onModelCreated }) => {
  const userId = user?.id;
  const [modelPath, setModelPath] = useState("backend/sections/models/LLM-7B.gguf");
  const [contextSize, setContextSize] = useState(4096);
  const [threads, setThreads] = useState(8);
  const [temperature, setTemperature] = useState(0.7);

  // Fixed, non-editable system prompt
  const fixedPrompt = `Use ONLY the context below to answer the query concisely and accurately.
If the context doesn't contain relevant information, respond: "This Data is not available"

Context: {context}

Query: {query}

Answer:`;

  // Required custom user prompt
  const [customPrompt, setCustomPrompt] = useState("");

  const [modelStatus, setModelStatus] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");

  const handleCreateModel = async () => {
    if (!modelPath) {
      setModelStatus("Please enter the path to your GGUF model.");
      return;
    }
    if (!selectedCollection) {
      setModelStatus("Please select a collection.");
      return;
    }
    if (!customPrompt.trim()) {
      setModelStatus("Please provide a custom prompt.");
      return;
    }

    setModelStatus("Creating model configuration...");
    try {
      const selectedColl = collections.find((coll) => coll.id === selectedCollection);
      if (!selectedColl) {
        setModelStatus("Error: Selected collection not found");
        return;
      }

      const modelData = {
        user_id: userId,
        name: `Model-${Date.now()}`,
        model_path: modelPath,
        embed_model_path: "models/all-MiniLM-L6-v2",
        chroma_db_base_path: selectedColl.chroma_db_path,
        max_context_tokens: contextSize,
        max_new_tokens: 256,
        threads: threads,
        temperature: temperature,
        // custom prompt first, fixed prompt after
        prompt: `${customPrompt}\n\n${fixedPrompt}`,
        model_type: "gguf",
      };

      const resp = await fetch(`${API_BASE}/api/models/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(modelData),
      });

      if (resp.ok) {
        const data = await resp.json();
        setModelStatus(`Model configuration created: ${data.message}`);
        onModelCreated(); // Notify parent to refresh models
        setModelPath("backend/sections/models/LLM-7B.gguf");
        setContextSize(4096);
        setThreads(8);
        setTemperature(0.7);
        setCustomPrompt("");
        setSelectedCollection("");
      } else {
        const errData = await resp.json();
        setModelStatus(`Error: ${errData.error || "Failed to create model"}`);
      }
    } catch (err) {
      setModelStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div
      className={`rounded-2xl shadow-2xl p-6 ${
        theme === "dark" ? "bg-gray-800/80 backdrop-blur-sm" : "bg-white/90 backdrop-blur-sm"
      } border border-gray-200/20`}
    >
      <h2 className="text-xl font-bold mb-4">Create GGUF Model</h2>
      <div className="space-y-4">
        {/* Model Path */}
        <div>
          <label className="block font-semibold mb-1">Model Path</label>
          <input
            type="text"
            placeholder="Enter full path to GGUF model"
            value={modelPath}
            onChange={(e) => setModelPath(e.target.value)}
            className={`w-full p-3 rounded-lg border ${
              theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
            } focus:ring-2 focus:ring-indigo-500`}
          />
        </div>

        {/* Context Size */}
        <div>
          <label className="block font-semibold mb-1">Context Size</label>
          <input
            type="number"
            value={contextSize}
            onChange={(e) => setContextSize(Number(e.target.value))}
            className={`w-full p-3 rounded-lg border ${
              theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
            } focus:ring-2 focus:ring-indigo-500`}
          />
        </div>

        {/* Threads */}
        <div>
          <label className="block font-semibold mb-1">Threads</label>
          <input
            type="number"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            className={`w-full p-3 rounded-lg border ${
              theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
            } focus:ring-2 focus:ring-indigo-500`}
          />
        </div>

        {/* Temperature */}
        <div>
          <label className="block font-semibold mb-1">Temperature</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className={`w-full p-3 rounded-lg border ${
              theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
            } focus:ring-2 focus:ring-indigo-500`}
          />
        </div>

        {/* Custom Prompt (Required) */}
        <div>
          <label className="block font-semibold mb-1">Custom Prompt</label>
          <textarea
            placeholder="Enter your custom instructions for the model"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className={`w-full p-3 rounded-lg border ${
              theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
            } focus:ring-2 focus:ring-indigo-500`}
            rows="3"
            required
          />
        </div>

        {/* Fixed Prompt */}
        <div>
          <label className="block font-semibold mb-1">System Prompt (Fixed)</label>
          <textarea
            value={fixedPrompt}
            readOnly
            className={`w-full p-3 rounded-lg border ${
              theme === "dark"
                ? "bg-gray-700/50 text-white cursor-not-allowed"
                : "bg-gray-50 text-gray-900 cursor-not-allowed"
            }`}
            rows="6"
          />
        </div>

        {/* Collection */}
        <div>
          <label className="block font-semibold mb-1">Select Collection</label>
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className={`w-full p-3 rounded-lg border ${
              theme === "dark" ? "bg-gray-700/50 text-white" : "bg-gray-50 text-gray-900"
            } focus:ring-2 focus:ring-indigo-500`}
          >
            <option value="">Select a collection</option>
            {collections.map((coll) => (
              <option key={coll.id} value={coll.id}>
                {coll.name}
              </option>
            ))}
          </select>
        </div>

        {/* Button */}
        <button
          onClick={handleCreateModel}
          className="w-full p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Create Model
        </button>
      </div>

      {modelStatus && <p className="mt-4 text-sm text-gray-500">{modelStatus}</p>}
    </div>
  );
};

export default ModelConfigurationCard;
