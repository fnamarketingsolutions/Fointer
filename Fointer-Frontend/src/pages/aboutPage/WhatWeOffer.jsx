import React from 'react';

export default function MissionSection() {
  const missionCards = [
    {
      imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800&auto=format&fit=crop",
      title: "Diverse Communities",
      description: "With thousands of interest groups, you’re sure to find one—or several—that resonate with your passions. If not, we encourage you to start your own!"
    },
    {
      imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop",
      title: "Interactive Features",
      description: "Engage through discussions, polls, shared content, and live events within groups."
    },
    {
      imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop",
      title: "User-Driven Content",
      description: "Content on Fointer is created by users, for users. Each member contributes to the vibrancy of their chosen communities."
    },
    {
      imageUrl: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=800&auto=format&fit=crop",
      title: "Safe & Supportive",
      description: "Fointer is committed to maintaining a respectful and welcoming space for all users. Our dedicated team ensures interactions meet our guidelines for safety and positivity."
    }
  ];

  return (
    <section className="bg-[#130D08] text-white py-20 px-4 sm:px-6 lg:px-8 border-t border-amber-900/20 font-sans relative overflow-hidden">
      
      {/* Background Glow Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#F8A201]/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Block */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-[#F8A201] uppercase px-3.5 py-1.5 rounded-full border border-[#F8A201]/30 bg-[#1c140d]/80 inline-block backdrop-blur-md">
            What We Offer
          </span>
          
          <h2 className="text-3xl sm:text-5xl font-serif text-amber-50 leading-tight">
            Designed to Connect, <span className="italic font-normal text-[#F8A201]">Built to Inspire</span>
          </h2>
          
          <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed pt-2">
            Fointer hosts an expansive range of communities known as "interest groups," each dedicated to a specific theme or topic—from the arts and technology to health and personal development. Here’s what makes our platform stand out:
          </p>
        </div>

        {/* 4 Cards Grid Layout (Matching Image Design) */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {missionCards.map((card, index) => (
            <div 
              key={index} 
              className="bg-[#1A130C] rounded-lg overflow-hidden border border-white/5 flex flex-col transition-all duration-300 hover:border-white/20"
            >
              {/* Card Upper Image Header */}
              <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-black/40">
                <img 
                  src={card.imageUrl} 
                  alt={card.title}
                  className="w-full h-full object-cover object-center filter brightness-90 hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Card Lower Content Area */}
              <div className="p-6 flex flex-col justify-between flex-grow">
                <div>
                  {/* Title and Vertical Three-Dot Icon */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-serif text-[#F8A201] leading-tight">
                      {card.title}
                    </h3>
                    
                    <button 
                      aria-label="Options"
                      className="text-gray-400 hover:text-white transition-colors p-1 -mr-1 rounded"
                    >
                      <svg 
                        className="w-5 h-5" 
                        fill="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                      </svg>
                    </button>
                  </div>

                  {/* Card Description */}
                  <p className="mt-4 text-xs sm:text-sm text-gray-400 font-light leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}