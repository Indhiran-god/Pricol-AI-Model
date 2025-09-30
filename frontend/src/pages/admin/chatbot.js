import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const formatDuration = (seconds) => {
  if (!seconds) return null;
  if (seconds >= 60) {
    const minutes = (seconds / 60).toFixed(2);
    return `${minutes} min`;
  }
  return `${seconds.toFixed(2)} s`;
};

const StatusDot = ({ isActive, label, theme }) => (
  <div className="flex items-center">
    <div
      className={`w-3 h-3 rounded-full mr-2 ${
        isActive ? "bg-green-500" : "bg-gray-500"
      }`}
    ></div>
    <span className={`text-sm ${theme === "dark" ? "text-gray-300" : "text-white"}`}>
      {label}
    </span>
  </div>
);

StatusDot.propTypes = {
  isActive: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  theme: PropTypes.oneOf(["light", "dark"]).isRequired,
};

const AdminHome = ({ user, onLogout }) => {
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isLlmConnected, setIsLlmConnected] = useState(false);
  const [isSystemReady, setIsSystemReady] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [operationTimes, setOperationTimes] = useState({
    status: null,
    chat: null,
    historyFetch: null,
    historyDelete: null,
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [theme, setTheme] = useState("light");
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);

  const pollRef = useRef(null);
  const chatWindowRef = useRef(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const resp = await fetch(`${API_BASE}/api/status`);
        if (!resp.ok) throw new Error("Status fetch failed");
        const json = await resp.json();
        setIsDbConnected(Boolean(json.db_ready));
        setIsLlmConnected(Boolean(json.model_loaded));
        setIsSystemReady(Boolean(json.ready));
        setOperationTimes((prev) => ({
          ...prev,
          status: json.duration_s ? formatDuration(json.duration_s) : null,
        }));

        if (json.ready && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (err) {
        console.debug("Status poll error:", err.message);
      }
    }

    async function fetchHistory() {
      try {
        const resp = await fetch(`${API_BASE}/api/history?user_id=${user.id}`);
        if (!resp.ok) throw new Error(await resp.text());
        const json = await resp.json();
        setChatHistory(json.history || []);
        setOperationTimes((prev) => ({
          ...prev,
          historyFetch: json.duration_s ? formatDuration(json.duration_s) : null,
        }));
      } catch (err) {
        console.debug("History fetch error:", err.message);
      }
    }

    async function fetchAvailableModels() {
      try {
        const resp = await fetch(`${API_BASE}/api/models?user_id=${user.id}`);
        if (resp.ok) {
          const json = await resp.json();
          setAvailableModels(json.models || []);
          if (json.models?.length > 0 && !selectedModel) {
            setSelectedModel(json.models[0].id);
          }
        }
      } catch (err) {
        console.debug("Models fetch error:", err.message);
      }
    }

    fetchStatus();
    fetchHistory();
    fetchAvailableModels();
    pollRef.current = setInterval(() => {
      fetchStatus();
      fetchHistory();
    }, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user.id, selectedModel]);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatMessages]);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || !isSystemReady || isSending) return;

    const userText = userInput.trim();
    setChatMessages((prev) => [...prev, { text: userText, sender: "user" }]);
    setUserInput("");
    setIsSending(true);

    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userText,
          user_id: user.id,
          model_id: selectedModel,
        }),
      });

      if (!resp.ok) throw new Error(await resp.text());

      const json = await resp.json();
      const answer = json.answer ?? "No answer returned.";

      let answerWithSource = answer;
      if (json.source_model) {
        answerWithSource += `\n\n*Source: ${json.source_model}*`;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          text: answerWithSource,
          sender: "ai",
          source: json.source_model,
        },
      ]);

      setOperationTimes((prev) => ({
        ...prev,
        chat: json.duration_s ? formatDuration(json.duration_s) : null,
      }));

      const historyResp = await fetch(`${API_BASE}/api/history?user_id=${user.id}`);
      if (historyResp.ok) {
        const historyJson = await historyResp.json();
        setChatHistory(historyJson.history || []);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { text: `Error: ${err.message}`, sender: "ai" },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteHistory = async (id) => {
    try {
      const resp = await fetch(`${API_BASE}/api/history/${id}?user_id=${user.id}`, {
        method: "DELETE",
      });
      if (!resp.ok) throw new Error(await resp.text());
      const json = await resp.json();
      setOperationTimes((prev) => ({
        ...prev,
        historyDelete: json.duration_s ? formatDuration(json.duration_s) : null,
      }));
      setChatHistory((prev) => prev.filter((item) => item.id !== id));
      alert("History deleted.");
      if (selectedHistory?.id === id) {
        setIsHistoryOpen(false);
        setSelectedHistory(null);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const viewHistoryItem = (item) => {
    setSelectedHistory(item);
    setIsHistoryOpen(true);
  };

  const closeHistoryPopup = () => {
    setIsHistoryOpen(false);
    setSelectedHistory(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`w-80 h-[600px] ${
            theme === "dark" ? "bg-gray-800" : "bg-gray-200"
          } ${theme === "dark" ? "text-white" : "text-gray-900"} flex flex-col overflow-y-auto`}
        >
          {/* Model Selection */}
          <div
            className={`p-4 border-b ${
              theme === "dark" ? "border-gray-700" : "border-gray-300"
            }`}
          >
            <h2 className="text-xl font-semibold mb-2">Select Model</h2>
            <select
              value={selectedModel || ""}
              onChange={(e) => setSelectedModel(parseInt(e.target.value) || null)}
              className={`w-full p-2 rounded-lg ${
                theme === "dark" ? "bg-gray-700 text-white" : "bg-white text-gray-900"
              } border ${theme === "dark" ? "border-gray-600" : "border-gray-300"}`}
            >
              <option value="" disabled>
                Select a model
              </option>
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chat History */}
          <div
            className={`p-4 border-b ${
              theme === "dark" ? "border-gray-700" : "border-gray-300"
            }`}
          >
            <h2 className="text-xl font-semibold">Chat History</h2>
          </div>
          <div className="flex-1 p-4 space-y-3">
            {chatHistory.length === 0 ? (
              <div
                className={`text-center py-8 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                No history
              </div>
            ) : (
              chatHistory.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg p-3 flex justify-between items-center transition ${
                    theme === "dark" ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-300 hover:bg-gray-400"
                  }`}
                >
                  <div
                    className="cursor-pointer flex-1"
                    onClick={() => viewHistoryItem(item)}
                  >
                    <div
                      className={`text-xs mb-1 ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {item.timestamp}
                    </div>
                    <div className="font-medium truncate">
                      {item.user_message.substring(0, 50)}...
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteHistory(item.id)}
                    className="ml-2 p-1 text-red-500 hover:text-red-700"
                    title="Delete chat"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
          {operationTimes.historyFetch && (
            <div
              className={`p-4 text-sm ${
                theme === "dark" ? "text-gray-400 border-t border-gray-700" : "text-gray-600 border-t border-gray-300"
              }`}
            >
              History: {operationTimes.historyFetch}
            </div>
          )}
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col p-6 overflow-auto">
          <div className="w-full max-w-3xl mx-auto">
            <div
              className={`rounded-lg shadow-lg p-6 mb-6 ${
                theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"
              }`}
            >
              <div className="flex flex-wrap gap-4 mb-2">
                {operationTimes.status && (
                  <span
                    className={`text-sm ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Status: {operationTimes.status}
                  </span>
                )}
                {operationTimes.chat && (
                  <span
                    className={`text-sm ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Response: {operationTimes.chat}
                  </span>
                )}
              </div>
              <p
                className={`text-sm ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {isSystemReady ? "The system is ready." : "Initializing..."}
              </p>
            </div>

            <div
              className={`rounded-lg shadow-lg flex flex-col h-[600px] ${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              }`}
            >
              <div className="flex-1 p-4 overflow-y-auto" ref={chatWindowRef}>
                {chatMessages.length === 0 ? (
                  <div
                    className={`italic text-center h-full flex items-center justify-center ${
                      theme === "dark" ? "text-gray-500" : "text-gray-500"
                    }`}
                  >
                    Ask a question.
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`mb-4 flex ${
                        msg.sender === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.sender === "user"
                            ? "bg-blue-600 text-white"
                            : theme === "dark"
                            ? "bg-gray-700 text-white"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {msg.text}
                        {msg.source && (
                          <div
                            className={`text-xs mt-2 ${
                              theme === "dark" ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            Source: {msg.source}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={isSystemReady ? "Ask about your queries." : "System initializing..."}
                    disabled={!isSystemReady || isSending}
                    className={`flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                      theme === "dark"
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "border-gray-300 text-gray-900"
                    }`}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!isSystemReady || isSending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {isSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Popup */}
      {isHistoryOpen && selectedHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className={`rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col ${
              theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"
            }`}
          >
            <div
              className={`p-4 border-b flex justify-between items-center ${
                theme === "dark" ? "border-gray-700" : "border-gray-300"
              }`}
            >
              <h3 className="text-xl font-bold">Chat History</h3>
              <button
                onClick={closeHistoryPopup}
                className={`p-2 hover:text-gray-700 ${
                  theme === "dark" ? "text-gray-300" : "text-gray-900"
                }`}
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="mb-4">
                <div
                  className={`text-sm ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {selectedHistory.timestamp}
                </div>
                <div className="mt-2">
                  <strong>User:</strong> {selectedHistory.user_message}
                </div>
                <div className="mt-2">
                  <strong>Assistant:</strong> {selectedHistory.ai_response}
                </div>
                {selectedHistory.source_model && (
                  <div
                    className={`text-sm mt-2 ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Source: {selectedHistory.source_model}
                  </div>
                )}
              </div>
            </div>
            <div
              className={`p-4 border-t ${
                theme === "dark" ? "border-gray-700" : "border-gray-300"
              }`}
            >
              <button
                onClick={() => handleDeleteHistory(selectedHistory.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

AdminHome.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default AdminHome;