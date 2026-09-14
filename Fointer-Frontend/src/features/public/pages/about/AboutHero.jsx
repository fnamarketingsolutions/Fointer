import React from 'react';
import { motion } from 'framer-motion';
import CompanyStory from './CompanyStory';
import LeaderShips from './LeaderShips';
import WhatWeOffer from './WhatWeOffer';
import CTASection from './CtaSection';
import JoinUsSection from './JoinUsSection';

const AboutHero = () => {
  return (
    <>
      <section className="relative bg-fo-bg text-fo-text pt-28 pb-20 min-h-[90vh] flex flex-col justify-center items-center overflow-hidden">
        
        {/* Background Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-fo-accent/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col items-center">
        {/* Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 border border-fo-accent/30 bg-fo-surface/80 px-4 py-1.5 rounded-full mb-8 backdrop-blur-md"
        >
          <span className="text-[11px] font-semibold tracking-[0.25em] text-fo-accent uppercase">
            About Fointer
          </span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl sm:text-6xl md:text-7xl font-serif text-center max-w-4xl leading-[1.15] text-fo-text/95"
        >
          Where Passions Fuel Our Platform, and <span className="italic font-normal text-fo-accent">Community Thrives</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-6 text-fo-subtle text-sm sm:text-base md:text-lg text-center max-w-2xl leading-relaxed font-light"
        >
          Welcome to Fointer. Fointer Networks, Inc. is proud to offer a dynamic space where users from all walks of life can come together to share, learn, and engage with others who share their interests and enthusiasms.
        </motion.p>

        {/* Stats Container (Updated for Community Quality) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-20 max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 border border-fo-border rounded-2xl bg-fo-surface/40 backdrop-blur-md p-6 md:p-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/10"
        >
            <div className="py-2 md:py-0">
              <p className="text-3xl sm:text-4xl font-serif text-fo-accent">100%</p>
              <p className="text-[11px] text-fo-subtle tracking-widest uppercase mt-1">AUTHENTIC CONNECTIONS</p>
            </div>
            <div className="py-2 md:py-0">
              <p className="text-3xl sm:text-4xl font-serif text-fo-accent">24/7</p>
              <p className="text-[11px] text-fo-subtle tracking-widest uppercase mt-1">INTERACTIVE ENGAGEMENT</p>
            </div>
            <div className="py-2 md:py-0">
              <p className="text-3xl sm:text-4xl font-serif text-fo-accent">99%</p>
              <p className="text-[11px] text-fo-subtle tracking-widest uppercase mt-1">COMMUNITY SATISFACTION</p>
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