import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast"; // ✅ fix

import ModelConfigurationCard from "./ModelConfigurationCard";
import CollectionsAndFilesCard from "./CollectionsAndFilesCard";
import ModelsAndFilesCard from "./ModelsAndFilesCard";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

const DatabaseAndModelPage = ({ theme, user }) => {
  const userId = user?.id;
  const [collections, setCollections] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const modelResp = await fetch(`${API_BASE}/api/models`);
        const modelData = await modelResp.json();
        if (modelResp.ok) {
          setModels(modelData.models || []);
        } else {
          toast.error(modelData.error || "Failed to fetch models");
        }

        const collResp = await fetch(
          `${API_BASE}/api/documents/collections?user_id=${userId}`
        );
        const collData = await collResp.json();
        if (collResp.ok) {
          setCollections(collData.collections || []);
        } else {
          toast.error(collData.error || "Failed to fetch collections");
        }
      } catch (err) {
        toast.error(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const handleModelCreated = async () => {
    try {
      const modelResp = await fetch(`${API_BASE}/api/models`);
      const modelData = await modelResp.json();
      if (modelResp.ok) {
        setModels(modelData.models || []);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} /> 
      <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
        Model and Document Management
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        <ModelConfigurationCard
          theme={theme}
          user={user}
          collections={collections}
          onModelCreated={handleModelCreated}
        />
        <CollectionsAndFilesCard
          theme={theme}
          user={user}
          collections={collections}
          setCollections={setCollections}
          onCollectionChange={setCollections}
        />
        <ModelsAndFilesCard
          theme={theme}
          models={models}
          setModels={setModels}
          collections={collections}
        />
      </div>
    </div>
  );
};

export default DatabaseAndModelPage;
