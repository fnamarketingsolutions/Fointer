import React from "react";
import { Users, Lock, Globe, ExternalLink, ShieldCheck } from "lucide-react";

export default function JoinedCommunities() {
  const communities = [
    {
      id: 1,
      name: "Alpha Venture Group",
      type: "Private",
      description: "Exclusive seed-stage network focusing on deep tech, quantum computing, and bio-innovation.",
      members: "2.4k members",
      category: "Venture Capital",
      image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&q=80&w=600"
    },
    {
      id: 2,
      name: "Crypto Strategy Lab",
      type: "Private",
      description: "Analyzing institutional liquidity flows, MEV research, and on-chain intelligence for macro traders.",
      members: "890 members",
      category: "Trading & Macro",
      image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=600"
    },
    {
      id: 3,
      name: "Global Founders Circle",
      type: "Public",
      description: "Open forum for enterprise founders to discuss international scale, regulation, and hiring.",
      members: "12.8k members",
      category: "Leadership",
      image: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&q=80&w=600"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif font-bold text-[#E5E0D8]">My Joined Communities</h2>
        <p className="text-xs text-[#8C8070] mt-1">Quick access to all private circles and public forums you are a member of.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {communities.map((c) => (
          <div key={c.id} className="bg-[#14100D] border border-[#2A241E] rounded-xl overflow-hidden hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between group">
            <div>
              <div className="h-32 relative overflow-hidden">
                <img src={c.image} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-3 right-3 bg-[#0E0C0A]/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1">
                  {c.type === "Private" ? <Lock size={10} /> : <Globe size={10} />}
                  {c.type}
                </div>
              </div>
              <div className="p-4 space-y-2">
                <span className="text-[10px] font-mono text-[#D4AF37] uppercase">{c.category}</span>
                <h3 className="font-serif font-bold text-base text-[#E5E0D8] group-hover:text-[#D4AF37] transition-colors">{c.name}</h3>
                <p className="text-xs text-[#A69B8D] line-clamp-2 leading-relaxed">{c.description}</p>
              </div>
            </div>

            <div className="p-4 pt-0 flex items-center justify-between border-t border-[#2A241E]/40 mt-3">
              <span className="text-xs text-[#8C8070] flex items-center gap-1">
                <Users size={12} /> {c.members}
              </span>
              <button className="text-xs text-[#D4AF37] font-semibold flex items-center gap-1 hover:underline">
                Enter <ExternalLink size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}