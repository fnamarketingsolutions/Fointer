import React, { useState } from 'react';

const sections = [
  { id: 'collection', title: '1. Information We Collect' },
  { id: 'usage', title: '2. How We Use Your Data' },
  { id: 'cookies', title: '3. Cookies & Tracking' },
  { id: 'sharing', title: '4. Information Sharing' },
  { id: 'security', title: '5. Data Security' },
  { id: 'rights', title: '6. Your Privacy Rights' },
  { id: 'children', title: "7. Children's Privacy" },
  { id: 'contact', title: '8. Contact Our DPO' },
];

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState('collection');

  const scrollToSection = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#110C08] text-[#E0D8D0] font-sans">
      
      {/* Header Banner */}
      <header className="bg-[#1A1A1A] border-b border-[#261E15] py-14 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <span className="inline-flex items-center gap-1.5 bg-[#F8A201]/10 text-[#F8A201] text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-full mb-4 border border-[#F8A201]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F8A201]"></span>
            Data Protection
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-normal text-white tracking-tight">
            Privacy <span className="text-[#F8A201] italic">Policy</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-xl mx-auto font-light">
            Learn how we collect, use, and safeguard your personal information across our elite community.
          </p>
          <p className="mt-3 text-xs text-[#F8A201]/70 font-mono">
            LAST REVISED: JULY 2026
          </p>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sticky Navigation Sidebar */}
          <aside className="lg:col-span-4">
            <div className="sticky top-8 bg-[#1A1A1A]/90 backdrop-blur-md p-5 rounded-xl border border-[#261E15] shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#261E15]">
                <h2 className="text-xs font-bold text-[#F8A201] uppercase tracking-widest font-mono">
                  Table of Contents
                </h2>
                <span className="text-xs text-gray-500 font-mono">{sections.length} SECTIONS</span>
              </div>
              <nav className="space-y-1.5">
                {sections.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`w-full text-left px-3.5 py-2.5 text-sm rounded-lg transition-all duration-200 flex items-center justify-between ${
                        isActive
                          ? 'bg-[#261E15] text-[#F8A201] border-l-2 border-[#F8A201] font-medium shadow-sm'
                          : 'text-gray-400 hover:bg-[#261E15]/50 hover:text-gray-200'
                      }`}
                    >
                      <span className="truncate">{item.title}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F8A201] shrink-0 ml-2"></span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content Body */}
          <main className="lg:col-span-8 bg-[#1A1A1A]/60 p-6 sm:p-10 rounded-xl border border-[#261E15] space-y-12">
            
            {/* Section 1 */}
            <section id="collection" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">01</span>
                Information We Collect
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light mb-5">
                We collect information to provide a personalized, secure, and engaging community experience. This includes:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-[#261E15]/60 border border-[#F8A201]/20 rounded-lg">
                  <h3 className="font-semibold text-sm text-[#F8A201] mb-1">Directly Provided Information</h3>
                  <p className="text-xs text-gray-400 font-light leading-relaxed">Account registration details (username, email, password), profile avatar, bio, and community forum contributions.</p>
                </div>
                <div className="p-4 bg-[#261E15]/60 border border-[#F8A201]/20 rounded-lg">
                  <h3 className="font-semibold text-sm text-[#F8A201] mb-1">Automatically Collected Data</h3>
                  <p className="text-xs text-gray-400 font-light leading-relaxed">IP address, browser type, device details, operating system, and interaction logs within the community platform.</p>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section id="usage" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">02</span>
                How We Use Your Data
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light mb-3">
                Your data helps us maintain operational security and enhance member interactions:
              </p>
              <ul className="space-y-3 text-sm sm:text-base text-gray-300 font-light">
                <li className="flex items-start gap-3">
                  <span className="text-[#F8A201] mt-1 font-bold">›</span>
                  <span><strong className="text-white font-medium">Platform Operations:</strong> To authenticate account access, process member notifications, and maintain community feature functionality.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F8A201] mt-1 font-bold">›</span>
                  <span><strong className="text-white font-medium">Safety & Moderation:</strong> To detect malicious bots, enforce guidelines, and prevent fraudulent activity.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F8A201] mt-1 font-bold">›</span>
                  <span><strong className="text-white font-medium">Communication:</strong> To deliver essential account alerts, security warnings, and optional newsletter updates.</span>
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="cookies" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">03</span>
                Cookies & Tracking Technologies
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light mb-5">
                We use cookies and similar browser session storage technologies to maintain login sessions and remember site display preferences.
              </p>
              <div className="p-4 bg-[#261E15] text-gray-300 rounded-lg border-l-2 border-[#F8A201] text-xs sm:text-sm">
                <p>
                  <strong className="text-[#F8A201] font-semibold">Managing Preferences:</strong> You can choose to disable non-essential cookies via your web browser settings. However, disabling essential cookies may impact your ability to stay logged in.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section id="sharing" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">04</span>
                Information Sharing & Disclosure
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light mb-3">
                <strong className="text-white font-medium">We do not sell or rent your personal information to third parties.</strong> We only disclose information under the following conditions:
              </p>
              <ul className="space-y-3 text-sm sm:text-base text-gray-300 font-light">
                <li className="flex items-start gap-3">
                  <span className="text-[#F8A201] mt-1 font-bold">›</span>
                  <span><strong className="text-white font-medium">Trusted Infrastructure Providers:</strong> Hosting and cloud database vendors processing data securely on our behalf.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F8A201] mt-1 font-bold">›</span>
                  <span><strong className="text-white font-medium">Legal Compliance:</strong> When required by court orders, subpoenas, or official government requests.</span>
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="security" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">05</span>
                Data Security
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light">
                We implement modern physical, electronic, and administrative safeguards including standard SSL/TLS encryption for transit, salted password hashing, and restricted database access controls.
              </p>
            </section>

            {/* Section 6 */}
            <section id="rights" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">06</span>
                Your Privacy Rights
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light mb-3">
                Depending on your geographic location, you hold specific data rights:
              </p>
              <ul className="space-y-2 text-sm text-gray-300 font-light">
                <li className="flex items-center gap-2">
                  <span className="text-[#F8A201] font-bold">•</span>
                  <span><strong className="text-white font-medium">Access & Export:</strong> Request a copy of the personal data we store about you.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#F8A201] font-bold">•</span>
                  <span><strong className="text-white font-medium">Correction:</strong> Edit inaccurate account information via your user profile page.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#F8A201] font-bold">•</span>
                  <span><strong className="text-white font-medium">Erasure:</strong> Request the complete deletion of your account and associated profile data.</span>
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="children" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">07</span>
                Children's Privacy
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light">
                Our services are strictly designed for users aged 13 and older (or 16 depending on regional standards). We do not knowingly collect information from children under this threshold.
              </p>
            </section>

            {/* Section 8 / Contact Box */}
            <section id="contact" className="scroll-mt-8 pt-2">
              <div className="bg-[#261E15] border border-[#F8A201]/40 rounded-xl p-6 sm:p-8 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-6 shadow-xl">
                <div>
                  <h2 className="text-lg sm:text-xl font-serif text-white mb-1">
                    Have privacy concerns or data requests?
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 font-light">
                    Direct your inquiries to our Data Protection Officer.
                  </p>
                </div>
                <a
                  href="mailto:privacy@community.com"
                  className="mt-4 sm:mt-0 inline-block bg-[#F8A201] hover:bg-[#F8A201]/90 text-[#110C08] font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-lg transition-colors duration-200 shadow-md shrink-0"
                >
                  Email Data Team
                </a>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}   