import React from 'react';
import { motion } from 'framer-motion';

const CompanyStory = () => {
  return (
    <section className="bg-fo-bg text-fo-text py-24 border-t border-fo-border font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Top Equal-Height Row: Mission Heading & Visual (Left) + Mission Narrative (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-stretch">
          
          {/* Left Column (Heading + Image Card) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-5 flex flex-col justify-between"
          >
            {/* Top Left Heading */}
            <div className="space-y-2 mb-6">
              <p className="text-xs uppercase tracking-[0.25em] text-fo-accent font-bold">
                THE PURPOSE
              </p>
              <h2 className="text-3xl sm:text-5xl font-serif text-fo-text leading-[1.2]">
                Our <span className="text-fo-accent italic font-normal">Mission</span>
              </h2>
            </div>

            {/* Left Image Visual Card */}
            <div className="relative rounded-2xl overflow-hidden border border-fo-accent/20 bg-fo-surface shadow-2xl group flex-1 min-h-[380px]">
              <img
                src="https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1000&auto=format&fit=crop"
                alt="Our Origin Story"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-fo-bg via-[#0E0C0A]/40 to-transparent" />

              {/* Floating Counter Badge */}
              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-fo-bg/90 backdrop-blur-md border border-fo-accent/30">
                <p className="text-xs font-semibold text-fo-accent uppercase tracking-wider">
                  ESTABLISHED 2021
                </p>
                <p className="text-xs text-fo-muted font-light mt-1">
                  Built to solve noise, friction, and lack of trust in digital communities.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Column (Our Mission Content - No Border) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-7 flex flex-col justify-center"
          >
            <div className="space-y-4">
              <h3 className="text-xl sm:text-2xl font-serif text-fo-text flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-fo-accent"></span>
                Empowering Passions & Belonging
              </h3>
              <p className="text-fo-muted text-sm sm:text-base md:text-lg font-light leading-relaxed">
                At Fointer, our mission is straightforward: to empower individuals to create, discover, and engage in communities that reflect their interests and passions. Whether you're looking to dive deeper into your lifelong hobbies or explore entirely new territories, Fointer provides the tools and environment necessary for your journey.
              </p>
            </div>
          </motion.div>

        </div>

        {/* Bottom Narrative Row: Vision & Innovation + Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="pt-12 border-t border-fo-border space-y-8"
        >
          {/* Vision & Innovation Header */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-fo-accent font-bold">
              THE ORIGIN & EVOLUTION
            </p>
            <h2 className="text-2xl sm:text-4xl font-serif text-fo-text leading-[1.2]">
              Our Vision & <span className="text-fo-accent italic font-normal">Innovation</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-fo-muted text-sm sm:text-base font-light leading-relaxed">
            {/* Our Vision */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-fo-text flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fo-accent"></span>
                Our Vision
              </h3>
              <p>
                We envision a world where everyone can find a community that feels like home. A place where discussions are lively, informative, and respectful. At Fointer, we strive to bridge distances and bring people together, no matter where they are in the world, creating a global network of shared interests and mutual respect.
              </p>
            </div>

            {/* Innovation at Fointer */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-fo-text flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fo-accent"></span>
                Innovation at Fointer
              </h3>
              <p>
                Innovation is at the heart of Fointer. We continually evolve our platform to enhance user experience, integrating cutting-edge technologies that make community engagement more seamless and exciting. From advanced search options that make finding your interests easier to interactive tools that enhance communication, we’re always looking for ways to improve.
              </p>
            </div>
          </div>

          {/* Core Milestones / Stats Row */}
          <div className="pt-8 border-t border-fo-border grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-2xl sm:text-3xl font-serif text-fo-accent">100%</p>
              <p className="text-xs text-fo-subtle font-light mt-1">Authentic Connections</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-serif text-fo-text">140+</p>
              <p className="text-xs text-fo-subtle font-light mt-1">Interactive Engagement</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-serif text-fo-text">100+</p>
              <p className="text-xs text-fo-subtle font-light mt-1">Community Satisfaction</p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default CompanyStory;