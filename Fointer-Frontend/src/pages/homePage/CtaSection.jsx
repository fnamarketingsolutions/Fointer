import React, { useState } from 'react';
import { motion } from 'framer-motion';

const CtaSection = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitted email:', email);
  };

  return (
    <section className="bg-[#130D08] text-white py-28 px-4 sm:px-6 lg:px-8 border-t border-white/5 relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl sm:text-6xl font-serif text-amber-50 leading-tight"
        >
          Ready to Elevate Your Network?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-4 text-gray-400 text-sm sm:text-base max-w-xl mx-auto font-light"
        >
          Project-X is currently invitation-only. Join our waitlist to be reviewed by our membership committee.
        </motion.p>

        {/* Input & Action Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          onSubmit={handleSubmit}
          className="mt-10 max-w-xl mx-auto flex flex-col sm:flex-row gap-2 bg-[#1c140d] border border-amber-900/30 p-2 rounded-xl"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your business email"
            required
            className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
          />
          <button
            type="submit"
            className="sm:w-auto w-full px-6 py-3 bg-[#F8A201] text-[#130D08] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[#e09200] transition-colors whitespace-nowrap"
          >
            Join Waitlist
          </button>
        </motion.form>

      </div>
    </section>
  );
}

export default CtaSection;