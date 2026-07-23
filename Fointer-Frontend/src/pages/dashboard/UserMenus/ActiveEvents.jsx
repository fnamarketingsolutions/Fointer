import React from "react";
import { Radio, Users, Play, MessageCircle } from "lucide-react";

export default function ActiveEvents() {
  const events = [
    {
      id: 1,
      title: "Q3 Institutional Macro Breakdown & Rates Strategy",
      host: "Crypto Strategy Lab",
      speakers: ["Marcus Vance", "Sarah Jenkins"],
      activeViewers: 342,
      isLive: true,
      thumbnail: "https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 2,
      title: "Watch Party: AI Sovereign Models Keynote",
      host: "Alpha Venture Group",
      speakers: ["David Chen"],
      activeViewers: 128,
      isLive: true,
      thumbnail: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif font-bold text-[#E5E0D8] flex items-center gap-2">
          <Radio size={20} className="text-red-500 animate-pulse" /> Active Live Events & Watch Groups
        </h2>
        <p className="text-xs text-[#8C8070] mt-1">Real-time commentary streams and interactive watch sessions happening right now.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-[#14100D] border border-[#2A241E] rounded-2xl overflow-hidden relative group">
            <div className="relative aspect-video">
              <img src={event.thumbnail} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#14100D] via-transparent to-black/60"></div>
              
              <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 backdrop-blur-md">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                LIVE NOW
              </div>

              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-[#E5E0D8] text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <Users size={12} className="text-[#D4AF37]" /> {event.activeViewers} Watching
              </div>

              <button className="absolute inset-0 m-auto w-12 h-12 bg-[#D4AF37] rounded-full flex items-center justify-center text-black shadow-xl group-hover:scale-110 transition-transform">
                <Play size={20} className="fill-black ml-0.5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <span className="text-[10px] font-mono text-[#D4AF37] uppercase">{event.host}</span>
              <h3 className="font-serif font-bold text-base text-[#E5E0D8] leading-snug">{event.title}</h3>
              <p className="text-xs text-[#A69B8D]">
                Featuring: <span className="text-[#E5E0D8] font-medium">{event.speakers.join(", ")}</span>
              </p>
              
              <button className="w-full mt-2 bg-[#251E17] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] border border-[#D4AF37]/30 font-semibold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-2">
                <MessageCircle size={14} /> Join Commentary Stream
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}