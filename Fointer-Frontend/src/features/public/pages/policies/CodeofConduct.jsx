import React, { useState, useEffect } from 'react';
import {
  LuShieldCheck as ShieldCheck,
  LuHeartHandshake as HeartHandshake,
  LuEye as Eye,
  LuLock as Lock,
  LuActivity as Activity,
  LuScale as Scale,
  LuTriangleAlert as AlertTriangle,
  LuBookOpen as BookOpen,
  LuMail as Mail,
  LuMapPin as MapPin
} from 'react-icons/lu';
import { SiteEmail, SiteEmailPlain } from '../../../../context/SiteContactContext';

export default function CodeOfConduct() {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const rules = [
    {
      ruleNumber: "Rule 1",
      title: "Foster a Supportive Environment",
      icon: HeartHandshake,
      points: [
        "Moderators are expected to cultivate community norms and rules that encourage constructive and respectful discourse. Your responsibilities include not only adhering to our platform-wide policies but also actively promoting adherence among community members.",
        "Ensure that all content, including posts, comments, and direct communications within the community, complies with Fointer’s Content Policy."
      ]
    },
    {
      ruleNumber: "Rule 2",
      title: "Transparency and Clarity",
      icon: Eye,
      points: [
        "Clearly communicate the purpose and rules of the community to its members to ensure that expectations are understood, and experiences are consistent.",
        "Be transparent about the community guidelines and moderate consistently according to these rules to maintain order and respect within the community."
      ]
    },
    {
      ruleNumber: "Rule 3",
      title: "Respect Privacy and Safety",
      icon: Lock,
      points: [
        "Respect the privacy and safety of all members. Do not engage in or allow the sharing of personal information without explicit consent.",
        "Actively prevent and combat harassment, bullying, and any form of abuse within the community."
      ]
    },
    {
      ruleNumber: "Rule 4",
      title: "Active and Constructive Engagement",
      icon: Activity,
      points: [
        "Maintain active involvement in your community to effectively address issues and support positive interactions among members.",
        "Ensure your community is adequately moderated by a team sufficient in size and activity level to manage the community’s needs."
      ]
    },
    {
      ruleNumber: "Rule 5",
      title: "Integrity in Moderation",
      icon: Scale,
      points: [
        "Moderation actions must be fair, unbiased, and free from personal gain. Moderators must not accept any form of incentive, compensation, or favor in exchange for actions or decisions within the community.",
        "Conflicts of interest should be transparently disclosed and appropriately managed."
      ]
    }
  ];

  const enforcementActions = [
    "Reaching out to discuss and resolve issues.",
    "Temporary or permanent revocation of moderation privileges.",
    "Suspension or ban from moderation roles across the platform.",
    "Additional training or guidance to prevent future violations."
  ];

  const resources = [
    {
      title: "Moderator Support",
      description: "Access to tools and channels for direct communication with Fointer staff for support and to discuss issues or feedback."
    },
    {
      title: "Education and Training",
      description: "Resources and training materials designed to enhance your moderation skills and knowledge of Fointer’s policies."
    },
    {
      title: "Community of Moderators",
      description: "Opportunities to connect with other moderators on Fointer to share advice, strategies, and experiences."
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
          <span className="text-[11px] font-semibold tracking-[0.25em] text-[#F8A201] uppercase px-4 py-1.5 rounded-full border border-[#F8A201]/30 bg-[#1A130C]/80 inline-block backdrop-blur-md">
            Community Standards
          </span>
          
          <h1 className="text-4xl sm:text-6xl font-serif text-amber-50 leading-tight">
            Moderator <span className="italic font-normal text-[#F8A201]">Code of Conduct</span>
          </h1>
          
          <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed pt-2">
            Welcome to the Fointer Moderator Team! Moderators play a crucial role in shaping the environment and culture of Fointer’s diverse communities. Your dedication, decision-making, and passion are essential in creating engaging and enjoyable spaces for members to connect and share interests.
          </p>

          <div className="pt-2 flex items-center justify-center gap-2 text-xs text-[#F8A201]/90 font-mono tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#F8A201] animate-pulse" />
            <span>
              EFFECTIVE: June 1, 2024 | LAST REVISED: {currentDate.toLocaleDateString()} {currentDate.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Roles & Responsibilities Overview Card */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6 mb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">Overview</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                Role and Responsibilities of Moderators
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            Your role as a moderator is pivotal in fostering a positive experience within the community. Whether you are new to moderation or a seasoned veteran, our aim is to ensure you feel supported and secure in your role. We expect all moderators to uphold Fointer’s Content Policy and adhere to the User Agreement, particularly in ensuring that all community interactions are respectful, legal, and in line with our community guidelines.
          </p>
        </div>

        {/* Conduct Guidelines List */}
        <div className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-serif text-amber-50 text-center">
            Moderator Conduct Guidelines
          </h2>

          <div className="grid grid-cols-1 gap-6">
            {rules.map((rule, idx) => {
              const IconComponent = rule.icon;
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
                        {rule.ruleNumber}
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-serif text-amber-50">
                        {rule.title}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {rule.points.map((pt, pIdx) => (
                      <div key={pIdx} className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-gray-300 font-light leading-relaxed flex items-start gap-3">
                        <span className="text-[#F8A201] font-bold mt-0.5">•</span>
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enforcement & Compliance Card */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">Compliance</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                Enforcement and Compliance
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            Failure to adhere to this Code of Conduct can result in corrective action by Fointer administrators, which may include:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {enforcementActions.map((action, aIdx) => (
              <div key={aIdx} className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-gray-300 font-light flex items-start gap-3">
                <span className="text-[#F8A201] font-bold mt-0.5">•</span>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resources and Support Section */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <BookOpen className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">Support</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                Resources and Support for Moderators
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            We provide a range of resources to assist you in your moderation duties:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {resources.map((res, rIdx) => (
              <div key={rIdx} className="bg-[#130D08]/80 border border-white/10 rounded-2xl p-5 space-y-2">
                <h3 className="text-sm sm:text-base font-serif text-[#F8A201] font-semibold">
                  {res.title}
                </h3>
                <p className="text-xs text-gray-300 font-light leading-relaxed">
                  {res.description}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed pt-2">
            We value the hard work and dedication of our moderators and are committed to supporting you in creating welcoming and engaging communities. Your efforts in upholding these standards are vital to the success and health of Fointer. Thank you for your commitment to maintaining a friendly and respectful platform.
          </p>
        </div>

        {/* Contact Footer Box */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <Mail className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">Inquiries</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                Contact & Support
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            For further inquiries or to report conduct violations, please contact us by email at <SiteEmail /> or by mail using the details provided below:
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
              <SiteEmailPlain />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}