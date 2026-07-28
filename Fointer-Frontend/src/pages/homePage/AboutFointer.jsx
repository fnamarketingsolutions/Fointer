import React from 'react';
import { motion } from 'framer-motion';

export default function AboutFointer() {
  return (
    <section className="bg-[#130D08] text-white py-24 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        
        {/* Founder Image */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-2xl overflow-hidden border border-amber-900/30 group"
        >
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80"
            alt="Founder"
            className="w-full h-[500px] object-cover object-top grayscale group-hover:grayscale-0 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#130D08] via-transparent to-transparent opacity-80" />
          <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-[#1c140d]/80 border border-white/10 backdrop-blur-md">
            <h3 className="font-serif text-xl text-amber-50">Alexander Vance</h3>
            <p className="text-xs text-[#F8A201] uppercase tracking-wider mt-0.5">Founder & Managing Director</p>
          </div>
        </motion.div>

        {/* Founder Details */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-[#F8A201] font-bold">
            ABOUT THE FOUNDER
          </p>
          <h2 className="text-3xl sm:text-5xl font-serif text-amber-50 leading-tight">
            Architecting Ecosystems for Visionaries.
          </h2>
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-light">
            With over two decades building closed-door networks and high-impact digital infrastructures, Alexander Vance established Project-X to bridge private capital with visionary leaders.
          </p>
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-light">
            "Our objective is simple: remove friction for the world's most effective minds and create a space where capital, opportunity, and intelligence synthesize flawlessly."
          </p>

          <div className="pt-4 grid grid-cols-2 gap-4 border-t border-white/10">
            <div>
              <p className="text-2xl font-serif text-[#F8A201]">15+ Yrs</p>
              <p className="text-xs text-gray-400 mt-1">Ecosystem Architecture</p>
            </div>
            <div>
              <p className="text-2xl font-serif text-[#F8A201]">$2.4B</p>
              <p className="text-xs text-gray-400 mt-1">Facilitated Transactions</p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}