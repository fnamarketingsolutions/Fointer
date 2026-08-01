import React from 'react';
import { 
  FiUsers, 
  FiShoppingBag, 
  FiMic, 
  FiAward, 
  FiArrowRight, 
  FiRadio 
} from 'react-icons/fi';

export default function CorePillars() {
  return (
    <section className="bg-[#130D08] text-white py-20 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-serif text-[#F8A201] tracking-wide">
              Core Pillars
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-3 max-w-xl font-light leading-relaxed">
              Every facet of Project-X is designed for high-impact interactions and seamless professional growth.
            </p>
          </div>

          {/* Accent Line Indicators */}
          <div className="flex items-center space-x-2">
            <span className="h-[2px] w-8 bg-[#F8A201]" />
            <span className="h-[2px] w-3 bg-gray-700" />
            <span className="h-[2px] w-3 bg-gray-700" />
          </div>
        </div>

        {/* Bento Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* 1. Social Networking Card (Top Left - 8 cols) */}
          <div className="md:col-span-8 relative min-h-[420px] rounded-2xl overflow-hidden border border-[#F8A201]/10 bg-[#1c140d] group">
            {/* Background Image using <img> Tag */}
            <img
              src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop"
              alt="Social Networking"
              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
            />
            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#130D08] via-[#130D08]/70 to-black/30" />

            {/* Content Layer */}
            <div className="relative h-full p-8 flex flex-col justify-between z-10">
              <div className="p-2.5 bg-[#130D08]/80 border border-[#F8A201]/30 rounded-lg w-max text-[#F8A201]">
                <FiUsers size={18} />
              </div>

              <div className="space-y-3 mt-24">
                <h3 className="text-2xl sm:text-3xl font-serif text-amber-50">
                  Social Networking
                </h3>
                <p className="text-gray-300 text-xs sm:text-sm max-w-md font-light leading-relaxed">
                  Forge connections within a verified ecosystem of high-net-worth individuals and industry pioneers.
                </p>
                 
              </div>
            </div>
          </div>

          {/* Top Right Stack (4 cols) */}
          <div className="md:col-span-4 flex flex-col gap-6">
            
            {/* 2. Commerce Card */}
            <div className="relative min-h-[198px] p-6 rounded-2xl bg-[#1a120b] border border-amber-900/20 overflow-hidden flex flex-col justify-between group">
              <div className="text-[#F8A201]">
                <FiShoppingBag size={20} />
              </div>

              <div className="space-y-1.5 z-10">
                <h4 className="text-xl font-serif text-amber-50">Commerce</h4>
                <p className="text-xs text-gray-400 font-light leading-relaxed">
                  Private marketplace for elite assets and services.
                </p>
              </div>

              {/* Watermark Icon (Right Side) */}
              <div className="absolute right-4 bottom-3 text-amber-800/20 pointer-events-none group-hover:text-[#F8A201]/20 transition-colors">
                <FiShoppingBag size={90} />
              </div>
            </div>

            {/* 3. Live Commentary Card */}
            <div className="relative min-h-[198px] p-6 rounded-2xl bg-[#1a120b] border border-amber-900/20 overflow-hidden flex flex-col justify-between group">
              <div className="text-[#F8A201]">
                <FiMic size={20} />
              </div>

              <div className="space-y-1.5 z-10">
                <h4 className="text-xl font-serif text-amber-50">Live Commentary</h4>
                <p className="text-xs text-gray-400 font-light leading-relaxed">
                  Real-time market analysis and industry roundtables.
                </p>
              </div>

              {/* Watermark Icon (Right Side) */}
              <div className="absolute right-4 bottom-3 text-amber-800/20 pointer-events-none group-hover:text-[#F8A201]/20 transition-colors">
                <FiRadio size={90} />
              </div>
            </div>

          </div>

          {/* 4. Elite Rewards Card (Bottom Left - 4 cols) */}
          <div className="md:col-span-4 relative min-h-[380px] p-8 rounded-2xl bg-[#1a120b] border border-amber-900/20 flex flex-col justify-between">
            <div>
              <div className="text-[#F8A201] mb-6">
                <FiAward size={22} />
              </div>

              <h4 className="text-2xl font-serif text-amber-50 mb-3">
                Elite Rewards
              </h4>
              <p className="text-xs text-gray-400 font-light leading-relaxed">
                Earn reputation and unlock unique physical and digital experiences through active participation.
              </p>
            </div>

            <button className="w-full py-3 px-4 border border-white/10 rounded-xl text-amber-50 text-xs font-semibold hover:border-[#F8A201] hover:text-[#F8A201] transition-colors">
              View Tier Benefits
            </button>
          </div>

          {/* 5. Global Reach, Local Impact Card (Bottom Right - 8 cols) */}
          <div className="md:col-span-8 relative min-h-[380px] rounded-2xl overflow-hidden border border-[#F8A201]/10 bg-[#1c140d] group">
            {/* Background Image using <img> Tag */}
            <img
              src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop"
              alt="Global Reach"
              className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
            />
            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#130D08] via-[#130D08]/80 to-black/40" />

            {/* Center Content Layer */}
            <div className="relative h-full p-8 flex flex-col items-center justify-center text-center z-10 my-auto min-h-[380px]">
              <h3 className="text-3xl sm:text-4xl font-serif text-amber-50 leading-tight">
                Global Reach, Local Impact
              </h3>
              <p className="mt-3 text-gray-300 text-xs sm:text-sm max-w-lg font-light leading-relaxed">
                Our network spans across 140 countries, providing localized hubs for intimate physical gatherings.
              </p>

              {/* Social Proof Avatars Badge */}
              <div className="mt-6 inline-flex items-center gap-2 bg-[#130D08]/90 border border-white/10 rounded-full py-1.5 px-4 backdrop-blur-md">
                <div className="flex -space-x-2">
                  <img className="w-6 h-6 rounded-full ring-2 ring-[#130D08]" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="avatar" />
                  <img className="w-6 h-6 rounded-full ring-2 ring-[#130D08]" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" alt="avatar" />
                  <img className="w-6 h-6 rounded-full ring-2 ring-[#130D08]" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" alt="avatar" />
                </div>
                <span className="text-[10px] font-bold text-[#F8A201] bg-[#F8A201]/20 px-2 py-0.5 rounded-full">
                  +12k
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}