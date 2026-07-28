// src/components/admin/SystemSettings.jsx
import React, { useState } from 'react';
import { Save, Clock, Users, UploadCloud, ShieldAlert } from 'lucide-react';

export default function SystemSettings() {
  const [editLimit, setEditLimit] = useState(60);
  const [watchLimit, setWatchLimit] = useState(50);
  const [s3Limit, setS3Limit] = useState(25);
  const [bannedKeywords, setBannedKeywords] = useState('crypto_spam, scam_link, free_tokens');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">Global System Settings</h1>
          <p className="text-xs text-stone-400 mt-1">Configure limits, upload constraints, and automated content controls.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold text-xs rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-md">
          <Save className="w-3.5 h-3.5" /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Self-Deletion Limit (Minutes)
          </label>
          <input
            type="number"
            value={editLimit}
            onChange={(e) => setEditLimit(e.target.value)}
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" /> Watch Group Max Capacity
          </label>
          <input
            type="number"
            value={watchLimit}
            onChange={(e) => setWatchLimit(e.target.value)}
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-amber-500" /> Max Upload Size (MB)
          </label>
          <input
            type="number"
            value={s3Limit}
            onChange={(e) => setS3Limit(e.target.value)}
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" /> Banned Keywords List
          </label>
          <input
            type="text"
            value={bannedKeywords}
            onChange={(e) => setBannedKeywords(e.target.value)}
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60"
          />
        </div>
      </div>
    </div>
  );
}