import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { FiLinkedin, FiTwitter, FiArrowLeft, FiArrowRight } from 'react-icons/fi';

const LeadershipCarousel = () => {
  const scrollRef = useRef(null);

  const leaders = [
    {
      id: 1,
      name: 'Alexander Vance',
      designation: 'Founder & Managing Partner',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 2,
      name: 'Elena Rostova',
      designation: 'Head of Global Community',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 3,
      name: 'Marcus Chen',
      designation: 'Chief Ecosystem Officer',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 4,
      name: 'Sophia Thorne',
      designation: 'Director of Private Ventures',
      image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 5,
      name: 'David Sterling',
      designation: 'Head of Strategic Alliances',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=800&auto=format&fit=crop',
    },
  ];

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="bg-[#130D08] text-white py-24 border-t border-amber-900/20 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header with Navigation Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#F8A201] font-bold mb-2">
              THE VISIONARIES
            </p>
            <h2 className="text-3xl sm:text-5xl font-serif text-amber-50">
              Leadership & Council
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => scroll('left')}
              className="p-3 rounded-full border border-white/10 bg-[#1c140d] text-amber-50 hover:border-[#F8A201] hover:text-[#F8A201] transition-all"
              aria-label="Scroll Left"
            >
              <FiArrowLeft size={18} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-3 rounded-full border border-white/10 bg-[#1c140d] text-amber-50 hover:border-[#F8A201] hover:text-[#F8A201] transition-all"
              aria-label="Scroll Right"
            >
              <FiArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Container */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-8 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {leaders.map((leader, index) => (
            <motion.div
              key={leader.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="min-w-[280px] sm:min-w-[320px] max-w-[320px] bg-[#1c140d]/80 border border-amber-900/20 rounded-2xl overflow-hidden group hover:border-[#F8A201]/40 transition-all duration-300 flex-shrink-0"
            >
              {/* Leader Image */}
              <div className="relative h-80 w-full overflow-hidden">
                <img
                  src={leader.image}
                  alt={leader.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1c140d] via-[#1c140d]/20 to-transparent" />
                
                {/* Social Overlay */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <a href="#" className="p-2.5 bg-[#130D08]/80 backdrop-blur-md rounded-full text-amber-50 hover:text-[#F8A201] border border-white/10">
                    <FiLinkedin size={14} />
                  </a>
                  <a href="#" className="p-2.5 bg-[#130D08]/80 backdrop-blur-md rounded-full text-amber-50 hover:text-[#F8A201] border border-white/10">
                    <FiTwitter size={14} />
                  </a>
                </div>
              </div>

              {/* Leader Details */}
              <div className="p-6">
                <h3 className="text-xl font-serif text-amber-50 group-hover:text-[#F8A201] transition-colors">
                  {leader.name}
                </h3>
                <p className="text-xs text-gray-400 font-light mt-1.5 tracking-wide">
                  {leader.designation}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default LeadershipCarousel;