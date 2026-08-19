import React from 'react';
import { motion } from 'framer-motion';
import CompanyStory from './CompanyStory';
import LeaderShips from './LeaderShips';
import MissionSection from './WhatWeOffer';
import WhatWeOffer from './WhatWeOffer';
import CTASection from './CtaSection';
import JoinUsSection from './JoinUsSection';

const AboutHero = () => {
  return (
    <>
      <section className="relative bg-[#130D08] text-white pt-28 pb-20 min-h-[90vh] flex flex-col justify-center items-center overflow-hidden">
        
        {/* Background Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#F8A201]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col items-center">
        {/* Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 border border-[#F8A201]/30 bg-[#1c140d]/80 px-4 py-1.5 rounded-full mb-8 backdrop-blur-md"
        >
          <span className="text-[11px] font-semibold tracking-[0.25em] text-[#F8A201] uppercase">
            About Fointer
          </span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl sm:text-6xl md:text-7xl font-serif text-center max-w-4xl leading-[1.15] text-amber-50/95"
        >
          Where Passions Fuel Our Platform, and <span className="italic font-normal text-[#F8A201]">Community Thrives</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-6 text-gray-400 text-sm sm:text-base md:text-lg text-center max-w-2xl leading-relaxed font-light"
        >
          Welcome to Fointer. Fointer Networks, Inc. is proud to offer a dynamic space where users from all walks of life can come together to share, learn, and engage with others who share their interests and enthusiasms.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          {/* <button className="w-full sm:w-auto px-8 py-3.5 bg-[#F8A201] text-[#130D08] font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-[#e09200] transition-colors shadow-lg shadow-[#F8A201]/10 active:scale-[0.98]">
            Read Our Manifesto
          </button>
          <button className="w-full sm:w-auto px-8 py-3.5 border border-white/20 text-white font-bold text-xs uppercase tracking-widest rounded-lg hover:border-[#F8A201] hover:text-[#F8A201] transition-all active:scale-[0.98]">
            View Ecosystem Impact
          </button> */}
        </motion.div>

        {/* Stats Container (Updated for Community Quality) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-20 max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 border border-white/10 rounded-2xl bg-[#1c140d]/40 backdrop-blur-md p-6 md:p-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/10"
        >
            <div className="py-2 md:py-0">
              <p className="text-3xl sm:text-4xl font-serif text-[#F8A201]">100%</p>
              <p className="text-[11px] text-gray-400 tracking-widest uppercase mt-1">AUTHENTIC CONNECTIONS</p>
            </div>
            <div className="py-2 md:py-0">
              <p className="text-3xl sm:text-4xl font-serif text-[#F8A201]">24/7</p>
              <p className="text-[11px] text-gray-400 tracking-widest uppercase mt-1">INTERACTIVE ENGAGEMENT</p>
            </div>
            <div className="py-2 md:py-0">
              <p className="text-3xl sm:text-4xl font-serif text-[#F8A201]">99%</p>
              <p className="text-[11px] text-gray-400 tracking-widest uppercase mt-1">COMMUNITY SATISFACTION</p>
            </div>
        </motion.div>
        </div>

      </section>
      
      <CompanyStory/>
      <WhatWeOffer/>
      <LeaderShips/>
      <JoinUsSection/>
      <CTASection/>
    </>
  );
};

export default AboutHero;