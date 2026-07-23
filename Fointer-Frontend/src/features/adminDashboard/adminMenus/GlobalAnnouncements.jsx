// src/components/admin/GlobalAnnouncements.jsx
import React, { useState } from 'react';
import { Send, Megaphone } from 'lucide-react';

const GlobalAnnouncements = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const handleBroadcast = (e) => {
    e.preventDefault();
    alert(`Broadcast Published: ${title}`);
    setTitle('');
    setMessage('');
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">Global Broadcasts</h1>
        <p className="text-xs text-stone-400 mt-1">Publish platform-wide announcements to all members.</p>
      </div>

      <form onSubmit={handleBroadcast} className="bg-[#141210] border border-stone-800/60 p-6 rounded-xl space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-stone-300">Headline</label>
          <input
            type="text"
            required
            placeholder="e.g. Scheduled System Upgrade"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60 placeholder-stone-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-stone-300">Broadcast Message</label>
          <textarea
            required
            rows={4}
            placeholder="Write message content here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60 placeholder-stone-600"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-2"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Broadcast</span>
        </button>
      </form>
    </div>
  );
}

export default GlobalAnnouncements;