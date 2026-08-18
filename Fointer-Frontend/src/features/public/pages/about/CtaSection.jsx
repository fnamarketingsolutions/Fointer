import React from 'react';
import {
  LuMail as Mail,
  LuArrowRight as ArrowRight,
  LuSparkles as Sparkles
} from 'react-icons/lu';

export default function CTASection() {
  return (
    <section className="bg-[#130D08] text-white py-20 border-t border-amber-900/20 font-sans relative overflow-hidden">
      
      {/* Background Radial Ambient Glow for the outer section */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#F8A201]/10 rounded-full blur-[150px] pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Main CTA Block Container */}
        <div className="bg-[#1A130C] border border-[#F8A201]/30 rounded-3xl p-8 sm:p-12 lg:p-16 shadow-2xl relative overflow-hidden text-center flex flex-col items-center space-y-8">
          
          {/* Background Image restricted to ONLY inside this CTA Card Block */}
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25 filter contrast-125 brightness-75 pointer-events-none"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1920&auto=format&fit=crop')`,
            }}
          />

          {/* Dark Overlay Gradient inside the CTA Card for readability */}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#1A130C]/90 via-[#1A130C]/80 to-[#1A130C]/95 pointer-events-none" />

          {/* Subtle Top Inner Glow inside Card */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#F8A201]/15 rounded-full blur-3xl pointer-events-none z-0" />

          {/* Badge */}
          <span className="relative z-10 text-[11px] font-semibold tracking-[0.25em] text-[#F8A201] uppercase px-4 py-1.5 rounded-full border border-[#F8A201]/30 bg-[#130D08]/80 inline-flex items-center gap-2 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#F8A201]" />
            Get In Touch
          </span>

          {/* Headline & Body Text */}
          <div className="relative z-10 max-w-3xl space-y-4">
            <h2 className="text-3xl sm:text-5xl font-serif text-amber-50 leading-tight">
              Contact <span className="italic font-normal text-[#F8A201]">Us</span>
            </h2>
            
            <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed">
              We love hearing from our community! If you have questions, suggestions, or feedback, please don’t hesitate to reach out.
            </p>
          </div>

          {/* Direct Email Action Card / Button */}
          <div className="relative z-10 w-full max-w-md">
            <a 
              href="mailto:userservices@fointer.net"
              className="group flex items-center justify-between bg-[#130D08]/90 hover:bg-[#24180f] border border-[#F8A201]/40 hover:border-[#F8A201] rounded-2xl p-4 sm:p-5 transition-all duration-300 shadow-lg hover:shadow-[#F8A201]/10 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                <div className="p-2.5 rounded-xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/20 group-hover:scale-105 transition-transform">
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-left truncate">
                  <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Email Us Direct</p>
                  <p className="text-sm sm:text-base font-semibold text-white group-hover:text-[#F8A201] transition-colors truncate">
                    userservices@fointer.net
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#F8A201] group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
            </a>
          </div>

          {/* Closing Tagline / Mission Message */}
          <div className="relative z-10 pt-6 border-t border-white/10 max-w-2xl">
            <p className="text-xs sm:text-sm text-amber-100/70 italic font-serif leading-relaxed">
              "Discover your community, explore your passions, and connect with the world at Fointer—where your interests bring us together."
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}