import React from 'react';
import { motion } from 'framer-motion';
import { useSiteContact } from '../../../../context/SiteContactContext';

const ContactInfo = () => {
  const { contactEmail, contactPhone } = useSiteContact();
  const telHref = contactPhone
    ? `tel:${contactPhone.replace(/[^\d+]/g, "")}`
    : "";

  return (
    <>
      <section className="relative min-h-[85vh] w-full bg-[#130D08] text-white flex items-center justify-center py-12 md:py-20 overflow-hidden">
        
        {/* Background Radial Glow (Exact same as About Hero) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#F8A201]/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Main Container */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center z-10">
          
          {/* Left Column: Content & Quick Info */}
          <div className="flex flex-col space-y-6">
            
            {/* Badge */}
            <div>
              <span className="inline-block bg-[#1c140d]/80 text-[#F8A201] border border-[#F8A201]/30 text-xs md:text-sm font-semibold tracking-wider uppercase px-4 py-1.5 rounded-full backdrop-blur-md">
                Stronger Together
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Connecting Our <span className="text-[#F8A201]">Community</span> & Building Society
            </h1>

            {/* Description */}
            <p className="text-gray-400 text-base md:text-lg leading-relaxed font-light">
              Have questions, ideas, or want to contribute to our next community initiative? 
              We're here to listen, collaborate, and make our society a better place for everyone.
            </p>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              
              <div className="bg-[#1c140d]/40 backdrop-blur-md p-4 rounded-xl border-l-4 border-[#F8A201] border-y border-r border-white/10 shadow-sm">
                <h4 className="text-[#F8A201] font-semibold text-sm mb-1">
                  Community Hub
                </h4>
                <p className="text-xs md:text-sm text-gray-400 leading-snug">
                  123 Unity Street, Suite 4<br />
                  Civic Center, NY 10001
                </p>
              </div>

              <div className="bg-[#1c140d]/40 backdrop-blur-md p-4 rounded-xl border-l-4 border-[#F8A201] border-y border-r border-white/10 shadow-sm">
                <h4 className="text-[#F8A201] font-semibold text-sm mb-1">
                  Get in Touch
                </h4>
                <p className="text-xs md:text-sm text-gray-400 leading-snug">
                  {contactEmail ? (
                    <a href={`mailto:${contactEmail}`} className="hover:text-[#F8A201] transition-colors">
                      {contactEmail}
                    </a>
                  ) : (
                    "Email coming soon"
                  )}
                  <br />
                  {contactPhone ? (
                    <a href={telHref} className="hover:text-[#F8A201] transition-colors">
                      {contactPhone}
                    </a>
                  ) : (
                    "Phone coming soon"
                  )}
                </p>
              </div>

            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="bg-[#1c140d]/40 backdrop-blur-md p-6 sm:p-8 md:p-10 rounded-2xl border border-white/10 shadow-2xl">
            
            <div className="mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Send Us a Message
              </h3>
              <p className="text-sm text-gray-400">
                Fill out the form and a team member will reach out within 24 hours.
              </p>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              
              <div>
                <label htmlFor="name" className="block text-xs md:text-sm font-medium text-gray-200 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  placeholder="John Doe"
                  className="w-full bg-[#130D08] border border-white/10 focus:border-[#F8A201] text-white placeholder-gray-500 rounded-lg px-4 py-3 text-sm outline-none transition duration-200"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs md:text-sm font-medium text-gray-200 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  placeholder="john@example.com"
                  className="w-full bg-[#130D08] border border-white/10 focus:border-[#F8A201] text-white placeholder-gray-500 rounded-lg px-4 py-3 text-sm outline-none transition duration-200"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-xs md:text-sm font-medium text-gray-200 mb-1.5">
                  Your Message
                </label>
                <textarea
                  id="message"
                  rows={4}
                  placeholder="How can we help or collaborate?"
                  className="w-full bg-[#130D08] border border-white/10 focus:border-[#F8A201] text-white placeholder-gray-500 rounded-lg px-4 py-3 text-sm outline-none transition duration-200 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#F8A201] hover:bg-[#e09200] text-[#130D08] font-bold text-sm sm:text-base py-3.5 px-6 rounded-lg transition duration-200 transform active:scale-[0.99] shadow-lg shadow-[#F8A201]/10"
              >
                Send Message
              </button>

            </form>
          </div>

        </div>
      </section>
    </>
  );
};

export default ContactInfo;