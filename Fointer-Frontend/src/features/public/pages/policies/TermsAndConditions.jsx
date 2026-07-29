import React, { useState } from 'react';

const sections = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'conduct', title: '2. Community Guidelines' },
  { id: 'accounts', title: '3. User Accounts' },
  { id: 'content', title: '4. User-Generated Content' },
  { id: 'intellectual', title: '5. Intellectual Property' },
  { id: 'moderation', title: '6. Moderation & Termination' },
  { id: 'liability', title: '7. Limitation of Liability' },
  { id: 'contact', title: '8. Contact Us' },
];

export default function TermsAndConditions() {
  const [activeSection, setActiveSection] = useState('acceptance');

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
      <header className="bg-[#1A1A1A] border-b border-[#261E15] py-14 text-center relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <span className="inline-flex items-center gap-1.5 bg-[#F8A201]/10 text-[#F8A201] text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-full mb-4 border border-[#F8A201]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F8A201]"></span>
            Legal Framework
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-normal text-white tracking-tight">
            Terms & <span className="text-[#F8A201] italic">Conditions</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-xl mx-auto font-light">
            Please review the legal standards and operational guidelines governing our elite network.
          </p>
          <p className="mt-3 text-xs text-[#F8A201]/70 font-mono">
            LAST REVISED: JULY 2026
          </p>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Navigation Sidebar */}
          <aside className="lg:col-span-4">
            <div className="sticky top-8 bg-[#1A1A1A]/90 backdrop-blur-md p-5 rounded-xl border border-[#261E15] shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#261E15]">
                <h2 className="text-xs font-bold text-[#F8A201] uppercase tracking-widest font-mono">
                  Navigation Index
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
            <section id="acceptance" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">01</span>
                Acceptance of Terms
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light">
                By accessing, creating an account, or participating in our community, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions along with our Privacy Policy. If you do not agree to all terms, please discontinue use immediately.
              </p>
            </section>

            {/* Section 2 */}
            <section id="conduct" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">02</span>
                Community Guidelines & Conduct
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light mb-5">
                To keep our community helpful and welcoming, all members agree to adhere to our conduct standards. You agree <strong className="text-white font-medium">NOT</strong> to:
              </p>
              
              {/* Dark Styled Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-[#261E15]/60 border border-[#F8A201]/20 rounded-lg">
                  <h3 className="font-semibold text-sm text-[#F8A201] mb-1">No Harassment or Hate</h3>
                  <p className="text-xs text-gray-400 font-light leading-relaxed">Personal attacks, slurs, bullying, or targeted hostility toward any individual or group will not be tolerated.</p>
                </div>
                <div className="p-4 bg-[#261E15]/60 border border-[#F8A201]/20 rounded-lg">
                  <h3 className="font-semibold text-sm text-[#F8A201] mb-1">No Spam or Promotion</h3>
                  <p className="text-xs text-gray-400 font-light leading-relaxed">Unsolicited commercial self-promotion, affiliate link drops, or bot behavior is strictly forbidden.</p>
                </div>
              </div>

              {/* Dark Highlight Banner */}
              <div className="p-4 bg-[#261E15] text-gray-300 rounded-lg border-l-2 border-[#F8A201] text-xs sm:text-sm">
                <strong className="text-[#F8A201] font-semibold">Moderation Enforcement:</strong> We reserve the right to edit, mute, or permanently delete posts and accounts that violate these core principles.
              </div>
            </section>

            {/* Section 3 */}
            <section id="accounts" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">03</span>
                User Accounts & Security
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light">
                When registering, you agree to provide authentic details. You are solely responsible for maintaining the confidentiality of your login credentials and for all activities carried out under your account.
              </p>
            </section>

            {/* Section 4 */}
            <section id="content" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">04</span>
                User-Generated Content
              </h2>
              <ul className="space-y-3 text-sm sm:text-base text-gray-300 font-light">
                <li className="flex items-start gap-3">
                  <span className="text-[#F8A201] mt-1 font-bold">›</span>
                  <span><strong className="text-white font-medium">Your Ownership:</strong> You retain ownership rights to all original content, discussions, and media you submit.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F8A201] mt-1 font-bold">›</span>
                  <span><strong className="text-white font-medium">Platform License:</strong> By publishing content here, you grant us a worldwide, royalty-free license to render, distribute, and format your contribution across our services.</span>
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="intellectual" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">05</span>
                Intellectual Property
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light">
                All platform themes, branding, graphics, icons, and interface code are proprietary property of the community operator and are protected by applicable intellectual property rights.
              </p>
            </section>

            {/* Section 6 */}
            <section id="moderation" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">06</span>
                Moderation & Termination
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light">
                Accounts engaging in continuous policy breaches, malicious exploits, or illegal activity will be suspended or permanently terminated without advance notice.
              </p>
            </section>

            {/* Section 7 */}
            <section id="liability" className="scroll-mt-8">
              <h2 className="text-xl sm:text-2xl font-serif text-white flex items-center gap-3 border-b border-[#261E15] pb-3 mb-4">
                <span className="text-[#F8A201] font-mono text-sm font-bold">07</span>
                Limitation of Liability
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-gray-300 font-light">
                The platform is supplied on an "AS IS" basis without warranties of any kind. We are not liable for user-generated statements, external hyperlinks shared by members, or unexpected service downtime.
              </p>
            </section>

            {/* Section 8 / Contact Box */}
            <section id="contact" className="scroll-mt-8 pt-2">
              <div className="bg-[#261E15] border border-[#F8A201]/40 rounded-xl p-6 sm:p-8 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-6 shadow-xl">
                <div>
                  <h2 className="text-lg sm:text-xl font-serif text-white mb-1">
                    Have questions about these terms?
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 font-light">
                    Reach out to our community support team anytime.
                  </p>
                </div>
                <a
                  href="mailto:support@community.com"
                  className="mt-4 sm:mt-0 inline-block bg-[#F8A201] hover:bg-[#F8A201]/90 text-[#110C08] font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-lg transition-colors duration-200 shadow-md shrink-0"
                >
                  Contact Support
                </a>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}