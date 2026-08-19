import React from 'react';
import {
  LuShieldCheck as ShieldCheck,
  LuHeartHandshake as HeartHandshake,
  LuUserCheck as UserCheck,
  LuLock as Lock,
  LuShieldAlert as ShieldAlert,
  LuUserX as UserX,
  LuTag as Tag,
  LuScale as Scale,
  LuOctagonAlert as AlertOctagon,
  LuTriangleAlert as AlertTriangle,
  LuMail as Mail
} from 'react-icons/lu';

export default function ContentPolicy() {
  const rules = [
    {
      ruleNumber: "Rule 1",
      title: "Respect Individual Dignity",
      icon: HeartHandshake,
      content: "Fointer is a place for building community and belonging, not for attacking or marginalizing groups of people. Harassment, bullying, and threats of violence against any groups or individuals will not be tolerated. Communities or individuals that promote hate or violence based on identity or vulnerabilities will face strict actions, potentially including bans."
    },
    {
      ruleNumber: "Rule 2",
      title: "Participate Authentically",
      icon: UserCheck,
      content: "Contribute genuine content in communities where you share an interest. Refrain from engaging in manipulation of content such as spamming, vote manipulation, or subscriber fraud. Do not interfere with the functioning of any community or its members."
    },
    {
      ruleNumber: "Rule 3",
      title: "Privacy is Paramount",
      icon: Lock,
      content: "Respect everyone’s privacy. Do not engage in harassment by revealing someone’s personal or confidential information. Posting or threatening to post intimate or sexually explicit media of someone without their consent is strictly prohibited."
    },
    {
      ruleNumber: "Rule 4",
      title: "Safe Content Only",
      icon: ShieldAlert,
      content: "Do not share or promote content that is sexual, abusive, or suggestive involving minors. Engaging in or promoting predatory behavior or inappropriate content involving minors is strictly forbidden and will result in immediate action."
    },
    {
      ruleNumber: "Rule 5",
      title: "Integrity in Representation",
      icon: UserX,
      content: "You are not required to use your real name on Fointer, but impersonation of individuals or entities in a misleading or deceptive manner is prohibited."
    },
    {
      ruleNumber: "Rule 6",
      title: "Content Labeling",
      icon: Tag,
      content: "Provide clear labeling of content and communities, especially those that feature graphic, sexually explicit, or offensive material to ensure users have predictable experiences on Fointer."
    },
    {
      ruleNumber: "Rule 7",
      title: "Legal Compliance",
      icon: Scale,
      content: "Keep your activities legal. Avoid posting or engaging in illegal content or facilitating illegal and prohibited transactions."
    },
    {
      ruleNumber: "Rule 8",
      title: "Platform Integrity",
      icon: AlertOctagon,
      content: "Do not engage in activities that break the site or hinder the normal use of Fointer."
    }
  ];

  const enforcementPoints = [
    "Polite reminders to cease unacceptable behavior.",
    "Less polite warnings for continued violations.",
    "Temporary or permanent suspension of accounts.",
    "Removal of content privileges or addition of restrictions to accounts.",
    "Imposition of restrictions on Fointer communities, such as NSFW tags or quarantining.",
    "Deletion of content.",
    "Banning communities."
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
            Fointer <span className="italic font-normal text-[#F8A201]">Content Policy</span>
          </h1>
          
          <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed pt-2">
            Welcome to Fointer, a vibrant network of communities where you can explore, share, and connect over shared interests and activities. Fointer is built and shaped by its diverse users who create, manage, and participate in these communities.
          </p>
          
          <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed">
            We encourage you to find your niche within Fointer or even start a new community. While every community might not suit every individual, and some may find certain topics unappealing or offensive, it’s essential that no community is used to attack or demean others. Each community should foster a sense of inclusion and belonging for its members.
          </p>
        </div>

        {/* Community and User Guidelines Section */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
              Community and User Guidelines
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            As members of Fointer, it's crucial to respect the culture and rules of the communities you engage with, as well as the broader Fointer environment. Below are the platform-wide rules that apply to everyone on Fointer. These rules support our shared values and ensure a safe and respectful environment for all users.
          </p>
        </div>

        {/* Rules List */}
        <div className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-serif text-amber-50 text-center">
            Rules
          </h2>

          <div className="grid grid-cols-1 gap-6">
            {rules.map((rule, idx) => {
              const IconComponent = rule.icon;
              return (
                <div 
                  key={idx}
                  className="bg-[#1A130C]/90 border border-[#F8A201]/25 hover:border-[#F8A201]/50 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl transition-all duration-300 relative overflow-hidden"
                >
                  <div className="flex items-center gap-4 border-b border-white/10 pb-4 mb-4">
                    <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
                      <IconComponent className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <div>
                      <span className="text-xs font-mono tracking-widest text-[#F8A201] uppercase font-bold">
                        {rule.ruleNumber}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-serif text-amber-50">
                        {rule.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                    {rule.content}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enforcement Section */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
              Enforcement
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            We take the enforcement of these rules seriously and utilize a range of measures to ensure compliance, including but not limited to:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {enforcementPoints.map((point, pIdx) => (
              <div key={pIdx} className="bg-[#130D08]/80 border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-gray-300 font-light flex items-start gap-3">
                <span className="text-[#F8A201] font-bold mt-0.5">•</span>
                <span>{point}</span>
              </div>
            ))}
          </div>

          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed pt-4">
            Fointer is dedicated to maintaining a welcoming and safe environment for all users to express themselves freely within the bounds of respect and legality. By participating in our communities, you agree to uphold these standards and encourage others to do the same.
          </p>
        </div>

        {/* Contact Section */}
        <div className="bg-[#1A130C]/90 border border-[#F8A201]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl space-y-4">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="p-3 rounded-2xl bg-[#F8A201]/10 text-[#F8A201] border border-[#F8A201]/30 flex-shrink-0">
              <Mail className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
              Contact Us
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
            If you have any questions or concerns about our content policy, please feel free to contact us at: <a href="mailto:userservices@fointer.net" className="text-[#F8A201] font-mono hover:underline">userservices@fointer.net</a>. We are here to help and ensure that your experience on Fointer is positive and enriching.
          </p>
        </div>

      </div>
    </div>
  );
}