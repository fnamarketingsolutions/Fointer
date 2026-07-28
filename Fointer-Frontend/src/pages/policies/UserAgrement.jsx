import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  UserCheck, 
  FileCheck, 
  ExternalLink, 
  AlertOctagon, 
  Sliders, 
  UserX, 
  AlertTriangle, 
  Scale, 
  RefreshCw, 
  Mail, 
  MapPin 
} from 'lucide-react';

export default function UserAgreement() {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const agreementSections = [
    {
      num: "01",
      title: "Access to Services",
      icon: UserCheck,
      content: (
        <div className="space-y-3">
          <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              <strong className="text-white font-medium">No Age Restriction:</strong> Our Services are for everyone, and there are no age restrictions for access or use.
            </p>
          </div>
          <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              <strong className="text-white font-medium">Account Creation:</strong> You may need to create an account to use some parts of our Services. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
            </p>
          </div>
        </div>
      )
    },
    {
      num: "02",
      title: "Privacy",
      icon: ShieldCheck,
      content: (
        <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
          Our Privacy Policy details how we handle the information you provide to us when you use our Services. You acknowledge that by using our Services, you consent to the collection and use of this information.
        </p>
      )
    },
    {
      num: "03",
      title: "Your Use of the Services",
      icon: FileCheck,
      content: (
        <div className="space-y-3">
          <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              <strong className="text-white font-medium">License to Use:</strong> We grant you a personal, non-exclusive, non-transferable, revocable license to access and use the Services according to this Agreement.
            </p>
          </div>
          <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              <strong className="text-white font-medium">Prohibited Activities:</strong> You agree not to engage in activities such as selling, transferring, or exploiting the Services for any commercial purposes without our permission.
            </p>
          </div>
        </div>
      )
    },
    {
      num: "04",
      title: "Content",
      icon: FileText,
      content: (
        <div className="space-y-3">
          <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              <strong className="text-white font-medium">Your Content:</strong> You may post content such as text, images, and videos. You retain all rights in, and are solely responsible for, the content you post to Fointer.
            </p>
          </div>
          <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              <strong className="text-white font-medium">License Grant:</strong> By posting content, you grant Fointer a non-exclusive, royalty-free, worldwide license to use, reproduce, modify, and display such content in connection with the Services.
            </p>
          </div>
          <div className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4">
            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              <strong className="text-white font-medium">Content Removal:</strong> We reserve the right to remove or modify content at our discretion, for any reason, including content that violates this Agreement or our policies.
            </p>
          </div>
        </div>
      )
    },
    {
      num: "05",
      title: "Third-Party Content and Services",
      icon: ExternalLink,
      content: (
        <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
          Our Services may contain links to third-party websites or services that are not owned or controlled by Fointer. We are not responsible for the content, policies, or practices of any third-party websites or services.
        </p>
      )
    },
    {
      num: "06",
      title: "Conduct Prohibitions",
      icon: AlertOctagon,
      content: (
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            You agree not to misuse our Services or help anyone else do so. Specifically, you agree not to:
          </p>
          <ul className="space-y-2">
            <li className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-gray-300 font-light flex items-start gap-3">
              <span className="text-[#F8A201] font-bold mt-0.5">•</span>
              <span>Interfere with our Services or try to access them using a method other than the interface and the instructions that we provide.</span>
            </li>
            <li className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-gray-300 font-light flex items-start gap-3">
              <span className="text-[#F8A201] font-bold mt-0.5">•</span>
              <span>Circumvent any access or use restrictions put into place to prevent certain uses of our Services.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      num: "07",
      title: "Modification of Services",
      icon: Sliders,
      content: (
        <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
          We are constantly changing and improving our Services. We may add or remove functionalities or features, and we may suspend or stop a Service altogether.
        </p>
      )
    },
    {
      num: "08",
      title: "Account Suspension or Termination",
      icon: UserX,
      content: (
        <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
          We may suspend or terminate your access to all or part of our Services at any time, for any reason, including, but not limited to, violation of this Agreement.
        </p>
      )
    },
    {
      num: "09",
      title: "Disclaimers and Limitations of Liability",
      icon: AlertTriangle,
      content: (
        <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
          The Services are provided "as is" and we make no warranties regarding the reliability, safety, or performance of our Services. To the fullest extent permitted by law, we shall not be liable for any direct, indirect, punitive, incidental, special or consequential damages arising out of or in connection with our Services.
        </p>
      )
    },
    {
      num: "10",
      title: "Governing Law and Jurisdiction",
      icon: Scale,
      content: (
        <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
          This Agreement shall be governed by the laws of the State of New York, without respect to its conflict of laws principles. In the event of a conflict, local law will apply. All disputes under this Agreement will be resolved in the applicable state or federal courts of Valley Stream, New York.
        </p>
      )
    },
    {
      num: "11",
      title: "Changes to this Agreement",
      icon: RefreshCw,
      content: (
        <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
          We may make changes to this Agreement at any time. We will notify you of any changes by posting the revised Agreement and updating the Effective Date above. By continuing to access or use the Services on or after the Effective Date of the revised Agreement, you agree to be bound by the revised Agreement. If you do not agree to the revised Agreement, you must stop accessing and using our Services before the changes become effective.
        </p>
      )
    }
  ];

  return (
    <div className="bg-[#130D08] text-white min-h-screen py-16 font-sans relative overflow-hidden">
      
      {/* Background Radial Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#F8A201]/10 rounded-full blur-[180px] pointer-events-none z-0" />
      <div className="absolute bottom-10 right-0 w-[500px] h-[500px] bg-[#F8A201]/5 rounded-full blur-[160px] pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-8">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-[#F8A201] uppercase px-4 py-1.5 rounded-full border border-[#F8A201]/30 bg-[#1A130C]/80 inline-block backdrop-blur-md">
            Terms of Service
          </span>
          
          <h1 className="text-4xl sm:text-6xl font-serif text-amber-50 leading-tight">
            Fointer <span className="italic font-normal text-[#F8A201]">User Agreement</span>
          </h1>
          
          <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed pt-2">
            Welcome to Fointer, your dedicated platform for connecting over shared interests and passions! This User Agreement governs your access to and use of Fointer's websites, mobile apps, widgets, APIs, and other online services provided by Fointer Networks.
          </p>

          <div className="pt-2 flex items-center justify-center gap-2 text-xs text-[#F8A201]/90 font-mono tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#F8A201] animate-pulse" />
            <span>
              EFFECTIVE: June 1, 2024 | LAST REVISED: {currentDate.toLocaleDateString()} {currentDate.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Intro Acceptance Box */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
          By accessing or using our Services, you agree to be bound by the terms and conditions contained in this Agreement and all other operating rules, policies, and procedures that may be published by us from time to time. If you do not agree with the Agreement, you should not use our Services.
        </div>

        {/* Main Agreement Cards List */}
        <div className="space-y-6">
          {agreementSections.map((sec, idx) => {
            const IconComponent = sec.icon;
            return (
              <div 
                key={idx}
                className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="flex items-center gap-4 border-b border-white/10 pb-6 mb-6">
                  <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
                    <IconComponent className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div>
                    <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">
                      {sec.num}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                      {sec.title}
                    </h2>
                  </div>
                </div>

                {sec.content}
              </div>
            );
          })}

          {/* 12. Contact Information */}
          <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-6">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6">
              <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
                <Mail className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">12</span>
                <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                  Contact Information
                </h2>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
              If you have any questions about this User Agreement, please contact Fointer Networks by emailing to <a href="mailto:userservices@fointer.net" className="text-[#F8A201] font-mono hover:underline">userservices@fointer.net</a>.
            </p>

            <div className="bg-[#130D08]/90 border border-[#F8A201]/30 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#F8A201]">
                <MapPin className="w-4 h-4" />
                <h3 className="text-base font-serif font-semibold text-white">Fointer Networks</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed pl-6">
                50 Southgate Road<br />
                Valley Stream, NY 11581
              </p>
              <div className="pt-3 border-t border-white/10 pl-6">
                <span className="text-xs text-gray-400 font-mono">Email Inquiry: userservices@fointer.net</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}