import React from 'react';
import { motion } from 'framer-motion';
import { FiUsers, FiShoppingBag, FiMic, FiAward, FiArrowUpRight, FiLayers } from 'react-icons/fi';

export default function Services() {
  const servicesList = [
    {
      id: 1,
      title: 'Social Networking',
      description: 'Forge connections within a verified ecosystem of high-net-worth individuals and industry pioneers.',
      icon: <FiUsers size={22} />,
      image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop',
      tag: 'NETWORKING',
    },
    {
      id: 2,
      title: 'Private Commerce',
      description: 'Exclusive marketplace tailored for trading high-value digital assets, services, and private equity.',
      icon: <FiShoppingBag size={22} />,
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop',
      tag: 'MARKETPLACE',
    },
    {
      id: 3,
      title: 'Live Commentary',
      description: 'Real-time strategic market intelligence, expert breakdown sessions, and private roundtables.',
      icon: <FiMic size={22} />,
      image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=800&auto=format&fit=crop',
      tag: 'BROADCASTS',
    },
    {
      id: 4,
      title: 'Elite Tier Rewards',
      description: 'Unlock custom privileges, bespoke physical events, and reputation-based ecosystem access.',
      icon: <FiAward size={22} />,
      image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop',
      tag: 'REWARDS',
    },
    {
      id: 5,
      title: 'Capital Syndication',
      description: 'Co-invest alongside institutional founders and venture leads in high-growth opportunities.',
      icon: <FiLayers size={22} />,
      image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=800&auto=format&fit=crop',
      tag: 'CAPITAL',
    },
  ];

  return (
    <section className="bg-[#130D08] text-white py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#F8A201] font-bold mb-2">
              OUR FRAMEWORKS
            </p>
            <h2 className="text-3xl sm:text-5xl font-serif text-amber-50">
              Services & Ecosystem
            </h2>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm max-w-md font-light leading-relaxed">
            Tailored digital infrastructure engineered for visionaries, private syndicates, and high-impact leaders.
          </p>
        </div>

        {/* Structured Grid Format */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {servicesList.map((service, idx) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-[#1c140d]/80 border border-amber-900/30 rounded-2xl overflow-hidden flex flex-col justify-between group hover:border-[#F8A201]/50 transition-all duration-300 shadow-xl"
            >
              <div>
                {/* Image Header with Badge */}
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1c140d] via-[#1c140d]/40 to-transparent" />
                  
                  {/* Category Tag */}
                  <span className="absolute top-4 left-4 bg-[#130D08]/80 backdrop-blur-md text-[#F8A201] border border-[#F8A201]/30 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {service.tag}
                  </span>

                  {/* Service Icon Badge */}
                  <div className="absolute bottom-3 right-4 p-3 bg-[#130D08]/90 border border-[#F8A201]/30 rounded-xl text-[#F8A201] backdrop-blur-md">
                    {service.icon}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <h3 className="text-xl font-serif text-amber-50 mb-2.5 group-hover:text-[#F8A201] transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-gray-400 text-xs leading-relaxed font-light">
                    {service.description}
                  </p>
                </div>
              </div>

              {/* Card Footer Action */}
              <div className="px-6 pb-6 pt-2">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#F8A201] uppercase tracking-wider group-hover:underline"
                >
                  Learn More <FiArrowUpRight size={16} />
                </a>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}