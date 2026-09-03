import React from 'react';
import { motion } from 'framer-motion';
import { useSiteContact } from '../../../../context/SiteContactContext';

const ContactInfo = () => {
  const { contactEmail, contactPhone, contactAddress } = useSiteContact();
  const telHref = contactPhone
    ? `tel:${contactPhone.replace(/[^\d+]/g, "")}`
    : "";

  return (
    <>
      <section className="relative min-h-[85vh] w-full bg-fo-bg text-fo-text flex items-center justify-center py-12 md:py-20 overflow-hidden">
        
        {/* Background Radial Glow (Exact same as About Hero) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-fo-accent/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Main Container */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center z-10">
          
          {/* Left Column: Content & Quick Info */}
          <div className="flex flex-col space-y-6">
            
            {/* Badge */}
            <div>
              <span className="inline-block bg-fo-surface/80 text-fo-accent border border-fo-accent/30 text-xs md:text-sm font-semibold tracking-wider uppercase px-4 py-1.5 rounded-full backdrop-blur-md">
                Stronger Together
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Connecting Our <span className="text-fo-accent">Community</span> & Building Society
            </h1>

            {/* Description */}
            <p className="text-fo-subtle text-base md:text-lg leading-relaxed font-light">
              Have questions, ideas, or want to contribute to our next community initiative? 
              We're here to listen, collaborate, and make our society a better place for everyone.
            </p>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              
              <div className="bg-fo-surface/40 backdrop-blur-md p-4 rounded-xl border-l-4 border-fo-accent border-y border-r border-fo-border shadow-sm">
                <h4 className="text-fo-accent font-semibold text-sm mb-1">
                  Community Hub
                </h4>
                <p className="text-xs md:text-sm text-fo-subtle leading-snug whitespace-pre-line">
                  {contactAddress || "Address coming soon"}
                </p>
              </div>

              <div className="bg-fo-surface/40 backdrop-blur-md p-4 rounded-xl border-l-4 border-fo-accent border-y border-r border-fo-border shadow-sm">
                <h4 className="text-fo-accent font-semibold text-sm mb-1">
                  Get in Touch
                </h4>
                <p className="text-xs md:text-sm text-fo-subtle leading-snug">
                  {contactEmail ? (
                    <a href={`mailto:${contactEmail}`} className="hover:text-fo-accent transition-colors">
                      {contactEmail}
                    </a>
                  ) : (
                    "Email coming soon"
                  )}
                  <br />
                  {contactPhone ? (
                    <a href={telHref} className="hover:text-fo-accent transition-colors">
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
          <div className="bg-fo-surface/40 backdrop-blur-md p-6 sm:p-8 md:p-10 rounded-2xl border border-fo-border shadow-2xl">
            
            <div className="mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-fo-text mb-2">
                Send Us a Message
              </h3>
              <p className="text-sm text-fo-subtle">
                Fill out the form and a team member will reach out within 24 hours.
              </p>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              
              <div>
                <label htmlFor="name" className="block text-xs md:text-sm font-medium text-fo-muted mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  placeholder="John Doe"
                  className="w-full bg-fo-bg border border-fo-border focus:border-fo-accent text-fo-text placeholder:text-fo-subtle rounded-lg px-4 py-3 text-sm outline-none transition duration-200"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs md:text-sm font-medium text-fo-muted mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  placeholder="john@example.com"
                  className="w-full bg-fo-bg border border-fo-border focus:border-fo-accent text-fo-text placeholder:text-fo-subtle rounded-lg px-4 py-3 text-sm outline-none transition duration-200"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-xs md:text-sm font-medium text-fo-muted mb-1.5">
                  Your Message
                </label>
                <textarea
                  id="message"
                  rows={4}
                  placeholder="How can we help or collaborate?"
                  className="w-full bg-fo-bg border border-fo-border focus:border-fo-accent text-fo-text placeholder:text-fo-subtle rounded-lg px-4 py-3 text-sm outline-none transition duration-200 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-fo-accent hover:bg-fo-accent-hover text-fo-bg font-bold text-sm sm:text-base py-3.5 px-6 rounded-lg transition duration-200 transform active:scale-[0.99] shadow-lg shadow-[#D4AF37]/10"
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