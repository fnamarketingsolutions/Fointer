import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Database, 
  ListChecks, 
  Share2, 
  UserCheck, 
  Clock, 
  Baby, 
  RefreshCw, 
  Mail, 
  MapPin,
  Lock
} from 'lucide-react';

export default function PrivacyPolicy() {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#130D08] text-white min-h-screen py-16 font-sans relative overflow-hidden">
      
      {/* Background Radial Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#F8A201]/10 rounded-full blur-[180px] pointer-events-none z-0" />
      <div className="absolute bottom-10 right-0 w-[500px] h-[500px] bg-[#F8A201]/5 rounded-full blur-[160px] pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-8">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-[#F8A201] uppercase px-4 py-1.5 rounded-full border border-[#F8A201]/30 bg-[#1A130C]/80 inline-block backdrop-blur-md">
            Data Protection
          </span>
          
          <h1 className="text-4xl sm:text-6xl font-serif text-amber-50 leading-tight">
            Fointer Networks <span className="italic font-normal text-[#F8A201]">Privacy Policy</span>
          </h1>
          
          <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed pt-2">
            We believe privacy is a fundamental right. Learn how we collect, use, and safeguard your personal information.
          </p>

          <div className="pt-2 flex items-center justify-center gap-2 text-xs text-[#F8A201]/90 font-mono tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#F8A201] animate-pulse" />
            <span>
              EFFECTIVE: {currentDate.toLocaleDateString()} {currentDate.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Main Privacy Cards List */}
        <div className="space-y-8">
          
          {/* 01. Introduction */}
          <div className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl transition-all duration-300 relative overflow-hidden">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6 mb-6">
              <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30">
                <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">01</span>
                <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                  Introduction
                </h2>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              At Fointer, we believe that privacy is a fundamental right. We are committed to empowering our users to control their personal information. This privacy policy explains how Fointer Networks, Inc. ("Fointer," "we," "us," or "our") collects, uses, and shares information about you when you use our websites, mobile apps, widgets, APIs, emails, and other online products and services (collectively, the "Services") or when you otherwise interact with us.
            </p>
          </div>

          {/* 02. Information We Collect */}
          <div className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl transition-all duration-300 relative overflow-hidden">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6 mb-6">
              <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30">
                <Database className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">02</span>
                <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                  Information We Collect
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-base font-serif font-semibold text-[#F8A201]">Information You Provide to Us</h3>
                <div className="space-y-3">
                  <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
                    <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                      <strong className="text-white font-medium">Account Information:</strong> You may use our Services without creating an account, but to engage fully, you need to create an account. During registration, you provide us with a username and password, and you may provide other optional information such as your email address, profile picture, and bio.
                    </p>
                  </div>
                  <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
                    <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                      <strong className="text-white font-medium">Content You Submit:</strong> We collect content that you submit to the Services, such as posts, comments, and messages to other users.
                    </p>
                  </div>
                  <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
                    <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                      <strong className="text-white font-medium">Transactional Information:</strong> If you make purchases through our Services, we collect information necessary to complete the transaction, including payment information.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-serif font-semibold text-[#F8A201]">Information We Collect Automatically</h3>
                <div className="space-y-3">
                  <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
                    <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                      <strong className="text-white font-medium">Log Information:</strong> We log information about your use of the Services, including IP addresses, browser type, operating system, and device information.
                    </p>
                  </div>
                  <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
                    <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                      <strong className="text-white font-medium">Cookies and Tracking Technologies:</strong> We use cookies and other tracking technologies to provide functionality and to recognize you across different Services and devices.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 03. How We Use Your Information */}
          <div className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl transition-all duration-300 relative overflow-hidden">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6 mb-6">
              <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30">
                <ListChecks className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">03</span>
                <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                  How We Use Your Information
                </h2>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "To provide and maintain our Services;",
                "To improve and personalize your experience;",
                "To understand and analyze how you use our Services;",
                "To communicate with you, either directly or through one of our partners, including for customer service, to provide updates and other information, and for marketing;",
                "To process your transactions."
              ].map((item, index) => (
                <li key={index} className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-gray-300 font-light flex items-start gap-3">
                  <span className="text-[#F8A201] font-bold mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 04. Sharing Your Information */}
          <div className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl transition-all duration-300 relative overflow-hidden">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6 mb-6">
              <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30">
                <Share2 className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">04</span>
                <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                  Sharing Your Information
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
                <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                  <strong className="text-[#F8A201] font-medium">With Your Consent:</strong> We may share and disclose information with your consent or at your direction.
                </p>
              </div>
              <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
                <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                  <strong className="text-[#F8A201] font-medium">Service Providers:</strong> We engage service providers to perform functions and provide services to us. We may share your private personal information with such service providers subject to confidentiality obligations consistent with this privacy policy.
                </p>
              </div>
              <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
                <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                  <strong className="text-[#F8A201] font-medium">Compliance with Law:</strong> We may disclose your information to a third party if (a) it's necessary to comply with a legal obligation, (b) it's necessary to protect and defend our rights or property, or (c) it's necessary to prevent or investigate possible wrongdoing in connection with the Services.
                </p>
              </div>
            </div>
          </div>

          {/* 05. Your Choices */}
          <div className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl transition-all duration-300 relative overflow-hidden">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6 mb-6">
              <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30">
                <UserCheck className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">05</span>
                <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                  Your Choices
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#130D08]/80 border border-white/10 rounded-2xl p-5 space-y-2">
                <h3 className="text-sm font-serif font-semibold text-[#F8A201]">Account Information</h3>
                <p className="text-xs text-gray-300 font-light leading-relaxed">
                  You may update, correct or delete information from your account at any time by logging into your online account.
                </p>
              </div>
              <div className="bg-[#130D08]/80 border border-white/10 rounded-2xl p-5 space-y-2">
                <h3 className="text-sm font-serif font-semibold text-[#F8A201]">Cookies</h3>
                <p className="text-xs text-gray-300 font-light leading-relaxed">
                  You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
                </p>
              </div>
              <div className="bg-[#130D08]/80 border border-white/10 rounded-2xl p-5 space-y-2">
                <h3 className="text-sm font-serif font-semibold text-[#F8A201]">Marketing Communications</h3>
                <p className="text-xs text-gray-300 font-light leading-relaxed">
                  You can opt-out of receiving promotional communications from us by following the unsubscribe instructions included in our messages.
                </p>
              </div>
            </div>
          </div>

          {/* 06 & 07. Data Retention & Children's Privacy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="p-2.5 rounded-xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-mono text-[#F8A201] font-bold">06</span>
                  <h3 className="text-lg font-serif text-amber-50">Data Retention</h3>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                We retain personal information we collect from you where we have an ongoing legitimate business need to do so. When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize it.
              </p>
            </div>

            <div className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="p-2.5 rounded-xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30">
                  <Baby className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-mono text-[#F8A201] font-bold">07</span>
                  <h3 className="text-lg font-serif text-amber-50">Children's Privacy</h3>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                Fointer does not knowingly collect or solicit any information from anyone under the age of 13 or knowingly allow such persons to register for the Services. The Services and their content are not directed at children under the age of 13.
              </p>
            </div>
          </div>

          {/* 08. Changes to This Policy */}
          <div className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-mono text-[#F8A201] font-bold">08</span>
              <h3 className="text-xl font-serif text-amber-50 mb-2">Changes to This Policy</h3>
              <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                We may update this privacy policy from time to time in order to reflect, for example, changes to our practices or for other operational, legal, or regulatory reasons.
              </p>
            </div>
          </div>

          {/* 09. Contact Us Box */}
          <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-6">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6">
              <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30">
                <Mail className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">09</span>
                <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                  Contact Us
                </h2>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              For more information about our privacy practices, if you have questions, or if you would like to make a complaint, please contact us by email at <a href="mailto:userservices@fointer.net" className="text-[#F8A201] font-mono hover:underline">userservices@fointer.net</a> or by mail using the details provided below:
            </p>

            <div className="bg-[#130D08]/90 border border-[#F8A201]/30 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#F8A201]">
                <MapPin className="w-4 h-4" />
                <h3 className="text-base font-serif font-semibold text-white">Fointer Networks, Inc.</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed pl-6">
                50 Southgate Road<br />
                Valley Stream, NY 11581
              </p>
              <div className="pt-3 border-t border-white/10 pl-6">
                <span className="text-xs text-gray-400 font-mono">Email Inquiry: userservices@fointer.net</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 font-light italic text-center pt-2">
              This policy is designed to provide transparency into our privacy practices and principles in a format that users can navigate, read, and understand. We are committed to treating your personal data with care and respect.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}