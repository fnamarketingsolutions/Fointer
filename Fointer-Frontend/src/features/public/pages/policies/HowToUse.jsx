import React from 'react';
import {
  LuUserPlus as UserPlus,
  LuCompass as Compass,
  LuMessageSquare as MessageSquare,
  LuUsers as Users,
  LuSettings as Settings,
  LuCircleHelp as HelpCircle,
  LuArrowRight as ArrowRight,
  LuCircleCheck as CheckCircle2,
  LuShieldCheck as ShieldCheck,
  LuSearch as Search,
  LuBell as Bell,
  LuHeart as Heart
} from 'react-icons/lu';

export default function HowToUse() {
  const steps = [
    {
      stepNumber: "Step 1",
      title: "Sign Up and Create Your Profile",
      icon: UserPlus,
      subsections: [
        {
          heading: "1. Register for an Account:",
          points: [
            "Visit Fointer's Sign Up Page.",
            "Fill in the required fields with your details, such as your email address and a password.",
            "Complete the sign-up process by verifying your email."
          ]
        },
        {
          heading: "2. Set Up Your Profile:",
          points: [
            "Add a profile picture and a short bio. Your bio is a great way to share more about your interests with other community members.",
            "Customize your settings according to your preferences, such as privacy settings and notification preferences."
          ]
        }
      ]
    },
    {
      stepNumber: "Step 2",
      title: "Explore and Join Communities",
      icon: Compass,
      subsections: [
        {
          heading: "1. Browse Interest Groups:",
          points: [
            "Use the search bar to find topics or groups that capture your interest.",
            "Check out the categories on our Explore page to discover new and trending topics."
          ]
        },
        {
          heading: "2. Join Communities:",
          points: [
            "Once you find a community that interests you, click “Join” to become a member.",
            "Some communities may have specific joining requirements or rules—make sure to review these before joining."
          ]
        }
      ]
    },
    {
      stepNumber: "Step 3",
      title: "Engage with Content",
      icon: MessageSquare,
      subsections: [
        {
          heading: "1. Read and Respond:",
          points: [
            "Browse through posts, discussions, and other content. Feel free to leave comments, ask questions, or provide answers.",
            "Use upvotes and downvotes to express your opinions on posts and comments."
          ]
        },
        {
          heading: "2. Create Your Own Posts:",
          points: [
            "Share your thoughts, experiences, or questions by creating posts in communities you belong to.",
            "Add images, links, or videos to enrich your posts and engage more users."
          ]
        }
      ]
    },
    {
      stepNumber: "Step 4",
      title: "Connect and Collaborate",
      icon: Users,
      subsections: [
        {
          heading: "1. Follow Users:",
          points: [
            "Follow other users whose posts or comments resonate with you. This way, you can keep track of their future activities on Fointer.",
            "You’ll see updates from users you follow in your personalized feed."
          ]
        },
        {
          heading: "2. Participate in Events:",
          points: [
            "Join community events, virtual meetups, or discussions. These are great opportunities to deepen connections and learn more about topics you care about."
          ]
        }
      ]
    },
    {
      stepNumber: "Step 5",
      title: "Manage Your Account",
      icon: Settings,
      subsections: [
        {
          heading: "1. Customize Notifications:",
          points: [
            "Adjust your notification settings to stay updated on replies to your posts, new posts in your communities, or messages from other users.",
            "Opt for email notifications to catch major updates and community news."
          ]
        },
        {
          heading: "2. Stay Safe and Secure:",
          points: [
            "Review Fointer’s safety tips and guidelines to ensure a positive experience.",
            "Report any inappropriate content or behavior you encounter. Community safety is a collaborative effort."
          ]
        }
      ]
    }
  ];

  return (
    <div className="bg-[#0E0C0A] text-white min-h-screen py-16 font-sans relative overflow-hidden">
      
      {/* Radial Ambient Theme Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#D4AF37]/10 rounded-full blur-[180px] pointer-events-none z-0" />
      <div className="absolute bottom-10 right-0 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-[160px] pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        
        {/* Page Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-8">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-[#D4AF37] uppercase px-4 py-1.5 rounded-full border border-[#D4AF37]/30 bg-[#14100D]/80 inline-block backdrop-blur-md">
            New User Guide
          </span>
          
          <h1 className="text-4xl sm:text-6xl font-serif text-amber-50 leading-tight">
            How to Use <span className="italic font-normal text-[#D4AF37]">Fointer</span>
          </h1>
          
          <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light leading-relaxed pt-2">
            Welcome to Fointer! Whether you're here to dive into your hobbies, connect with like-minded individuals, or explore new interests, here’s a simple guide to help you get started on your journey with Fointer. Follow these steps to make the most of all that our platform has to offer.
          </p>
        </div>

        {/* Step-by-Step Sections */}
        <div className="space-y-8">
          {steps.map((step, idx) => {
            const IconComponent = step.icon;
            return (
              <div 
                key={idx}
                className="bg-[#14100D]/90 border border-[#D4AF37]/25 hover:border-[#D4AF37]/50 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl relative overflow-hidden transition-all duration-300"
              >
                {/* Subtle Card Accent Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />

                {/* Card Title Header */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-white/10 pb-6 mb-6">
                  <div className="p-3 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 w-fit">
                    <IconComponent className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div>
                    <span className="text-xs font-mono tracking-widest text-[#D4AF37] uppercase font-bold">
                      {step.stepNumber}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-serif text-amber-50">
                      {step.title}
                    </h2>
                  </div>
                </div>

                {/* Subsections Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {step.subsections.map((sub, subIdx) => (
                    <div key={subIdx} className="space-y-3">
                      <h3 className="text-base sm:text-lg font-medium text-[#D4AF37] font-serif">
                        {sub.heading}
                      </h3>
                      <ul className="space-y-2.5">
                        {sub.points.map((point, ptIdx) => (
                          <li key={ptIdx} className="flex items-start gap-3 text-xs sm:text-sm text-gray-300 font-light leading-relaxed">
                            <CheckCircle2 className="w-4 h-4 text-[#D4AF37]/70 flex-shrink-0 mt-1" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

              </div>
            );
          })}
        </div>

        {/* Need Help Box */}
        <div className="bg-[#14100D]/80 border border-white/10 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center space-y-4">
          <div className="p-3 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-serif text-amber-50">
            Need Help?
          </h3>
          <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed max-w-xl">
            If you encounter any issues or have questions about using Fointer, please visit our Help Center or contact our support team. We are here to help you navigate and enjoy your experience on Fointer.
          </p>
        </div>

        {/* Welcome Aboard Footer Note */}
        <div className="text-center border-t border-amber-900/30 pt-10 pb-6 space-y-2">
          <p className="text-lg sm:text-2xl font-serif text-amber-50 italic">
            "Welcome aboard, and happy exploring!"
          </p>
          <p className="text-xs sm:text-sm text-gray-400 font-light">
            With these simple steps, you’ll be well on your way to discovering all that Fointer has to offer. Let your interests lead the way.
          </p>
        </div>

      </div>
    </div>
  );
}