import React from 'react';
import { motion } from 'framer-motion';

const CompanyStory = () => {
  return (
    <section className="bg-[#130D08] text-white py-24 px-4 sm:px-6 lg:px-8 border-t border-amber-900/20 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Visual Column */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-5 relative"
          >
            <div className="relative rounded-2xl overflow-hidden border border-[#F8A201]/20 bg-[#1c140d] shadow-2xl group">
              <img
                src="https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1000&auto=format&fit=crop"
                alt="Our Origin Story"
                className="w-full h-[480px] object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#130D08] via-[#130D08]/40 to-transparent" />

              {/* Floating Counter Badge */}
              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-[#130D08]/90 backdrop-blur-md border border-[#F8A201]/30">
                <p className="text-xs font-semibold text-[#F8A201] uppercase tracking-wider">
                  ESTABLISHED 2021
                </p>
                <p className="text-xs text-gray-300 font-light mt-1">
                  Built to solve noise, friction, and lack of trust in digital communities.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Narrative Content Column */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-7 space-y-6"
          >
            <p className="text-xs uppercase tracking-[0.25em] text-[#F8A201] font-bold">
              THE ORIGIN & PURPOSE
            </p>

            <h2 className="text-3xl sm:text-5xl font-serif text-amber-50 leading-[1.2]">
              Why We Built <span className="text-[#F8A201] italic font-normal">Project-X</span>
            </h2>

            <div className="space-y-4 text-gray-300 text-sm sm:text-base font-light leading-relaxed">
              <p>
                In an era dominated by open digital noise, high-performing individuals face a common challenge: finding an authentic space where high-signal insights, strategic capital, and true peer support coexist.
              </p>
              <p>
                Project-X was born out of private dinners and private roundtables among founders and investors who realized that traditional networking platforms prioritize reach over relevance. We set out to build a digital sanctuary engineered specifically for impact.
              </p>
              <p>
                Today, our global network spans across 140 countries, bringing together vetted pioneers, venture builders, and market leaders to collaborate, transact, and shape what comes next.
              </p>
            </div>

            {/* Core Milestones / Stats Row */}
            <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-[#F8A201]">100%</p>
                <p className="text-xs text-gray-400 font-light mt-1">Peer Vetted</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-amber-50">140+</p>
                <p className="text-xs text-gray-400 font-light mt-1">Global Chapters</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-amber-50">$4B+</p>
                <p className="text-xs text-gray-400 font-light mt-1">Ecosystem Capital</p>
              </div>
            </div>

          </motion.div>

        </div>
      </div>
    </section>
  );
}

export default CompanyStory;