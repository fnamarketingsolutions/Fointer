import React from 'react';
import {
  LuCookie as Cookie,
  LuCircleHelp as HelpCircle,
  LuCircleCheck as CheckCircle2,
  LuSettings as Settings,
  LuChartColumn as BarChart3,
  LuTarget as Target,
  LuShare2 as Share2,
  LuSlidersHorizontal as Sliders,
  LuMonitor as Monitor,
  LuSmartphone as Smartphone,
  LuExternalLink as ExternalLink,
  LuUserCheck as UserCheck,
  LuMail as Mail
} from 'react-icons/lu';

export default function CookiePolicy() {
  const cookieTypes = [
    {
      title: "Strictly Necessary Cookies",
      icon: CheckCircle2,
      description: "These are essential for you to browse Fointer and use its features. Without these cookies, services like logging in to your account cannot be provided.",
      exampleTitle: "Session Cookies",
      exampleDesc: "These are used to maintain your session and remember your login on Fointer for the duration of your visit."
    },
    {
      title: "Functional Cookies",
      icon: Settings,
      description: "These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings.",
      exampleTitle: "Preferences Cookies",
      exampleDesc: "These are used to remember settings and preferences (like your language or region)."
    },
    {
      title: "Analytics and Performance Cookies",
      icon: BarChart3,
      description: "These cookies collect information about how you interact with our services and enable us to improve the performance and design of Fointer. They help us understand user patterns and improve site functionality.",
      exampleTitle: "Traffic and Performance Metrics Cookies",
      exampleDesc: "These track the number of visitors and the performance of different pages on the site."
    },
    {
      title: "Advertising Cookies",
      icon: Target,
      description: "These cookies are used to deliver advertisements more relevant to you and your interests. They are also used to limit the number of times you see an advertisement as well as help measure the effectiveness of the advertising campaign.",
      exampleTitle: "Targeting or Advertising Cookies",
      exampleDesc: "These track your browsing habits and usage to better target advertisements to you."
    },
    {
      title: "Third-Party Cookies",
      icon: Share2,
      description: "These cookies are set by a third party (not by Fointer) and may be used by those companies to build a profile of your interests and show you relevant ads on other sites.",
      exampleTitle: "Social Media Cookies",
      exampleDesc: "These are used to integrate social media on our platform which can track your browser across other sites and build a profile of your interests."
    }
  ];

  const managementOptions = [
    {
      title: "Browser Settings",
      icon: Monitor,
      content: "You can set your browser to refuse all or some cookies, or to alert you when websites set or access cookies. If you disable or refuse cookies, please note that some parts of this site may become inaccessible or not function properly."
    },
    {
      title: "Mobile Device Settings",
      icon: Smartphone,
      content: "Your mobile device may offer settings that allow you to choose whether browser cookies are set and to delete them. For more information about these controls, visit your device's settings menu."
    },
    {
      title: "Third-Party Opt-Outs",
      icon: ExternalLink,
      content: "Most advertising networks offer you a way to opt out of targeted advertising. For more information, you can visit www.aboutads.info/choices/ or www.youronlinechoices.com."
    },
    {
      title: "Fointer User Settings",
      icon: UserCheck,
      content: "You can review your settings and adjust your privacy controls anytime by accessing your account settings on Fointer."
    }
  ];

  return (
    <div className="bg-[#130D08] text-white min-h-screen py-16 font-sans relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#F8A201]/10 rounded-full blur-[180px] pointer-events-none z-0" />
      <div className="absolute bottom-10 right-0 w-[500px] h-[500px] bg-[#F8A201]/5 rounded-full blur-[160px] pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-8">
          <h1 className="text-4xl sm:text-6xl font-serif text-amber-50 leading-tight">
            Fointer <span className="italic font-normal text-[#F8A201]">Cookie Notice</span>
          </h1>
          
          <p className="text-xs sm:text-sm font-mono text-[#F8A201]">
            Last Updated: {new Date().getFullYear()}-{new Date().getMonth() + 1}-{new Date().getDate()}
          </p>

          <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed pt-2">
            This Cookie Notice explains how Fointer Networks ("Fointer," "we," "us," or "our") uses cookies and similar technologies to enhance your experience while you navigate through our platform. This notice also outlines the choices you have regarding these technologies.
          </p>
        </div>

        {/* Overview Box */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-4">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
              What are cookies and how does Fointer use them?
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            A cookie is a small text file stored on your computer or mobile device when you visit our site. Like many other online platforms, Fointer utilizes cookies and similar technologies (such as local storage and pixels) to remember information about your visit, which helps us improve your experience and analyze site usage.
          </p>
        </div>

        {/* Cookie Types Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 justify-center">
            <Cookie className="w-7 h-7 text-[#F8A201]" />
            <h2 className="text-2xl sm:text-3xl font-serif text-amber-50 text-center">
              Types of Cookies We Use
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {cookieTypes.map((item, idx) => {
              const IconComponent = item.icon;
              return (
                <div 
                  key={idx}
                  className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl transition-all duration-300 relative overflow-hidden space-y-4"
                >
                  <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                    <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
                      <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-serif text-amber-50">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                    {item.description}
                  </p>

                  {/* Example Highlight Box */}
                  <div className="bg-[#130D08]/80 border border-white/10 rounded-2xl p-4 space-y-1">
                    <span className="text-xs font-mono text-[#F8A201] font-semibold uppercase tracking-wider">
                      Example: {item.exampleTitle}
                    </span>
                    <p className="text-xs text-gray-300 font-light leading-relaxed">
                      {item.exampleDesc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Managing Cookie Preferences Section */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <Sliders className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
              Managing Your Cookie Preferences
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {managementOptions.map((opt, oIdx) => {
              const IconComponent = opt.icon;
              return (
                <div key={oIdx} className="bg-[#130D08]/80 border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/20">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm sm:text-base font-serif text-amber-50 font-semibold">
                      {opt.title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-300 font-light leading-relaxed">
                    {opt.content}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer / Contact Information Box */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-4">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <Mail className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
              Questions & Privacy Controls
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            For more detailed information on how we use, store, and keep your personal data secure, refer to our Privacy Policy. If you have any questions about our use of cookies or other technologies, please email us at <a href="mailto:userservices@fointer.net" className="text-[#F8A201] font-mono hover:underline">userservices@fointer.net</a>.
          </p>

          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed pt-2">
            Thank you for being part of Fointer. We're committed to providing you with a personalized experience while respecting your privacy preferences.
          </p>
        </div>

      </div>
    </div>
  );
}