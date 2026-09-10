import React from 'react';
import { Link } from 'react-router-dom';
import {
  LuMail as Mail,
  LuArrowRight as ArrowRight,
  LuSparkles as Sparkles
} from 'react-icons/lu';
import { useSiteContact } from '../../../../context/SiteContactContext';

export default function CTASection() {
  const { contactEmail } = useSiteContact();
  const emailReady = Boolean(contactEmail);
  const ActionTag = emailReady ? 'a' : Link;
  const actionProps = emailReady
    ? { href: `mailto:${contactEmail}` }
    : { to: '/contact-us' };

  return (
    <section className="bg-fo-bg text-fo-text py-20 border-t border-fo-border font-sans relative overflow-hidden">
      
      {/* Background Radial Ambient Glow for the outer section */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fo-accent/10 rounded-full blur-[150px] pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Main CTA Block Container */}
        <div className="bg-fo-surface border border-fo-accent/30 rounded-3xl p-8 sm:p-12 lg:p-16 shadow-2xl relative overflow-hidden text-center flex flex-col items-center space-y-8">
          
          {/* Background Image restricted to ONLY inside this CTA Card Block */}
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25 filter contrast-125 brightness-75 pointer-events-none"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1920&auto=format&fit=crop')`,
            }}
          />

          {/* Dark Overlay Gradient inside the CTA Card for readability */}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#14100D]/90 via-fo-surface/80 to-fo-surface/95 pointer-events-none" />

          {/* Subtle Top Inner Glow inside Card */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-fo-accent/15 rounded-full blur-3xl pointer-events-none z-0" />

          {/* Badge */}
          <span className="relative z-10 text-[11px] font-semibold tracking-[0.25em] text-fo-accent uppercase px-4 py-1.5 rounded-full border border-fo-accent/30 bg-fo-bg/80 inline-flex items-center gap-2 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-fo-accent" />
            Get In Touch
          </span>

          {/* Headline & Body Text */}
          <div className="relative z-10 max-w-3xl space-y-4">
            <h2 className="text-3xl sm:text-5xl font-serif text-fo-text leading-tight">
              Contact <span className="italic font-normal text-fo-accent">Us</span>
            </h2>
            
            <p className="text-fo-muted text-sm sm:text-base md:text-lg font-light leading-relaxed">
              We love hearing from our community! If you have questions, suggestions, or feedback, please don’t hesitate to reach out.
            </p>
          </div>

          {/* Direct Email Action Card / Button */}
          <div className="relative z-10 w-full max-w-md">
            <ActionTag
              {...actionProps}
              className="group flex items-center justify-between bg-fo-bg/90 hover:bg-[#24180f] border border-fo-accent/40 hover:border-fo-accent rounded-2xl p-4 sm:p-5 transition-all duration-300 shadow-lg hover:shadow-[#D4AF37]/10 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                <div className="p-2.5 rounded-xl bg-fo-accent/10 text-fo-accent border border-fo-accent/20 group-hover:scale-105 transition-transform">
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-left truncate">
                  <p className="text-[10px] text-fo-subtle font-mono uppercase tracking-wider">
                    {emailReady ? "Email Us Direct" : "Get in Touch"}
                  </p>
                  <p className="text-sm sm:text-base font-semibold text-fo-text group-hover:text-fo-accent transition-colors truncate">
                    {contactEmail || "Contact Us"}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-fo-subtle group-hover:text-fo-accent group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
            </ActionTag>
          </div>

          {/* Closing Tagline / Mission Message */}
          <div className="relative z-10 pt-6 border-t border-fo-border max-w-2xl">
            <p className="text-xs sm:text-sm text-fo-muted italic font-serif leading-relaxed">
              "Discover your community, explore your passions, and connect with the world at Fointer—where your interests bring us together."
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}