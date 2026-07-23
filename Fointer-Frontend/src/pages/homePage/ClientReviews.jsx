import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiStar } from 'react-icons/fi';

const reviews = [
  {
    id: 1,
    quote: "Project-X completely transformed how our syndicate executes private placements. The caliber of members here is unmatched.",
    name: "Elena Rostova",
    role: "Managing Partner, Apex Capital",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
  },
  {
    id: 2,
    quote: "The live commentary and private roundtables alone justify the invitation. The signal-to-noise ratio is absolute perfection.",
    name: "Marcus Thorne",
    role: "Founder, Chrono Labs",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
  },
  {
    id: 3,
    quote: "Accessing high-fidelity discourse without generic social media noise has been game-changing for our research team.",
    name: "Dr. Sarah Lin",
    role: "Chief Scientist, Quantum Era",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80"
  }
];

export default function ClientReviews() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === reviews.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="bg-[#130D08] text-white py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5 relative">
      <div className="max-w-4xl mx-auto">
        
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-[#F8A201] font-bold">
            MEMBER TESTIMONIALS
          </p>
          <h2 className="text-3xl sm:text-5xl font-serif text-amber-50 mt-2">
            Trusted by Leaders
          </h2>
        </div>

        {/* Carousel Container */}
        <div className="relative bg-[#1c140d]/80 border border-amber-900/30 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-md min-h-[260px] flex flex-col justify-between">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="flex text-[#F8A201] space-x-1">
                {[...Array(5)].map((_, i) => (
                  <FiStar key={i} fill="#F8A201" size={16} />
                ))}
              </div>

              <p className="text-lg sm:text-2xl font-serif text-amber-50/90 leading-relaxed italic">
                "{reviews[currentIndex].quote}"
              </p>

              <div className="flex items-center space-x-4 pt-4 border-t border-white/10">
                <img
                  src={reviews[currentIndex].avatar}
                  alt={reviews[currentIndex].name}
                  className="w-12 h-12 rounded-full object-cover border border-[#F8A201]"
                />
                <div>
                  <h4 className="font-serif text-amber-50 text-base">{reviews[currentIndex].name}</h4>
                  <p className="text-xs text-gray-400">{reviews[currentIndex].role}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/5">
            <div className="flex space-x-2">
              {reviews.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? 'w-8 bg-[#F8A201]' : 'w-2 bg-gray-700'
                  }`}
                />
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={prevSlide}
                className="p-2.5 rounded-full border border-white/10 text-gray-300 hover:border-[#F8A201] hover:text-[#F8A201] transition-colors"
              >
                <FiChevronLeft size={20} />
              </button>
              <button
                onClick={nextSlide}
                className="p-2.5 rounded-full border border-white/10 text-gray-300 hover:border-[#F8A201] hover:text-[#F8A201] transition-colors"
              >
                <FiChevronRight size={20} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}