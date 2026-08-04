import React from 'react';
import { motion } from 'framer-motion';
import AboutFointer from './AboutFointer';
import Services from './Services';
import ClientReviews from './ClientReviews';
import CtaSection from './CtaSection';
import CorePillars from './CorePillars';
import DiscoverCommunities from './DiscoverCommunities';
import DiscoverPosts from './DiscoverPosts';

export default function HeroSection() {
  return (
    <div className="w-full overflow-x-hidden relative">
      <section className="relative bg-[#130D08] text-white pt-28 pb-20 min-h-[90vh] flex flex-col justify-center items-center overflow-hidden">
        
        {/* Background Radial Glow (Constrained max width to prevent mobile page stretching) */}        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] max-w-[80vw] h-[500px] bg-[#F8A201]/10 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col items-center">
        {/* Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 border border-[#F8A201]/30 bg-[#1c140d]/80 px-4 py-1.5 rounded-full mb-8 backdrop-blur-md"
        >
          <span className="text-[11px] font-semibold tracking-[0.25em] text-[#F8A201] uppercase">
            EXCLUSIVITY REDEFINED
          </span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl sm:text-6xl md:text-7xl font-serif text-center max-w-4xl leading-[1.15] text-amber-50/95"
        >
          The Future of <span className="italic font-normal text-[#F8A201]">Focused Interests</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-6 text-gray-400 text-sm sm:text-base md:text-lg text-center max-w-2xl leading-relaxed font-light"
        >
          Connect with industry titans, participate in bespoke commerce, and engage in high-fidelity discourse. Welcome to the elite layer of the digital world.
        </motion.p>

     

        {/* Stats Container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-20 max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 border border-white/10 rounded-2xl bg-[#1c140d]/40 backdrop-blur-md p-6 md:p-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/10"
        >
          <div className="py-2 md:py-0">
            <p className="text-3xl sm:text-4xl font-serif text-[#F8A201]">12k</p>
            <p className="text-[11px] text-gray-400 tracking-widest uppercase mt-1">GLOBAL MEMBERS</p>
          </div>
          <div className="py-2 md:py-0">
            <p className="text-3xl sm:text-4xl font-serif text-[#F8A201]">842</p>
            <p className="text-[11px] text-gray-400 tracking-widest uppercase mt-1">ACTIVE HUBS</p>
          </div>
          <div className="py-2 md:py-0">
            <p className="text-3xl sm:text-4xl font-serif text-[#F8A201]">4B</p>
            <p className="text-[11px] text-gray-400 tracking-widest uppercase mt-1">NETWORK FLOW</p>
          </div>
        </motion.div>
        </div>

      </section>

      <AboutFointer/>
      <DiscoverPosts/>
      <DiscoverCommunities/>
      <Services/>
      <CorePillars/>
      <ClientReviews/>
      <CtaSection/>
    </div>
  );
}