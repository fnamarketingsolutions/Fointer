import React, { useState } from 'react';
import { motion } from 'framer-motion';

const CtaSection = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitted email:', email);
  };

  return (
    <section className="bg-[#130D08] text-white py-28 border-t border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        
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
 
      </div>
    </section>
  );
}

export default CtaSection;