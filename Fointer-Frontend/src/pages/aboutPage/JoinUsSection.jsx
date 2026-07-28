import React from 'react';
import { Link } from 'react-router-dom';


export default function JoinUsSection() {
  return (
    <section className="bg-[#130D08] text-white py-20 border-t border-amber-900/20 font-sans relative overflow-hidden">
      
      {/* Background Radial Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#F8A201]/10 rounded-full blur-[150px] pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center space-y-6">
        
        {/* Heading */}
        <h2 className="text-3xl sm:text-5xl font-serif text-amber-50 leading-tight">
          Join <span className="italic font-normal text-[#F8A201]">Us</span>
        </h2>

        {/* Centered Circular Image (~40% width) */}
        <div className="w-[40%] max-w-[220px] aspect-square rounded-full p-1 border-2 border-[#F8A201]/40 bg-[#130D08] shadow-xl shadow-[#F8A201]/10 relative group overflow-hidden my-2">
          <img 
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800&auto=format&fit=crop" 
            alt="Join Fointer Community" 
            className="w-full h-full object-cover rounded-full filter brightness-90 group-hover:scale-105 transition-transform duration-500"
          />
        </div>

        {/* Paragraph Text */}
        <p className="text-gray-300 text-sm sm:text-base font-light leading-relaxed max-w-2xl">
          Whether you are looking to connect with others who share your interests, learn something new, or just have some fun, Fointer is the place for you. Join us today to start exploring, contributing, and enjoying a world of interests at your fingertips.
        </p>

        {/* Reduced Size Call to Action Button */}
        <div className="pt-2">
         <Link to="/contact-us">
         <button className="bg-[#F8A201] hover:bg-[#e09200] text-[#130D08] font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-lg shadow-md shadow-[#F8A201]/20 hover:shadow-[#F8A201]/40 transition-all duration-300 hover:scale-105 active:scale-95">
            Get Started Today
          </button>
         </Link>
        </div>

      </div>
    </section>
  );
}