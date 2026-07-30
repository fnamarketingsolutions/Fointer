import React from 'react'
import { motion } from 'framer-motion'
import ContactInfo from './ContactInfo'

const ContactHero = () => {
  return (
    <>
      <section className="relative bg-[#130D08] text-white pt-28 pb-20 min-h-[60vh] flex flex-col justify-center items-center overflow-hidden">
        
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
              GET IN TOUCH
            </span>
          </motion.div>

          {/* Hero Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl sm:text-6xl md:text-7xl font-serif text-center max-w-4xl leading-[1.15] text-amber-50/95"
          >
            Let's Build Something <span className="italic font-normal text-[#F8A201]">Exceptional Together</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-6 text-gray-400 text-sm sm:text-base md:text-lg text-center max-w-2xl leading-relaxed font-light"
          >
            Have a question, proposal, or feedback? We are here to connect and collaborate. Reach out to our team using the options below.
          </motion.p>
        </div>

      </section>
      <ContactInfo />
    </>
  )
}

export default ContactHero