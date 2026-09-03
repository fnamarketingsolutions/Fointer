import React from 'react';
import {
  LuBuilding2 as Building2,
  LuUsersRound as Users2,
  LuLandmark as Landmark,
  LuUser as User
} from 'react-icons/lu';

export default function NetworkUseCase() {
  const useCases = [
    {
      icon: Building2,
      content: "Businesses can use the platform to connect with potential customers and partners, share information about their products and services, and collaborate on projects."
    },
    {
      icon: Users2,
      content: "Organizations can use the platform to connect with members and supporters, share information about their activities and events, and collaborate on initiatives."
    },
    {
      icon: Landmark,
      content: "Villages, Towns, Counties, Local Governments, and States can deploy the platform to manage and interact with residents/constituents and tourists useful information, providing services, and to receive feedback"
    },
    {
      icon: User,
      content: "Individuals can use the platform to connect with friends and family, share information about their interests, and collaborate on projects."
    }
  ];

  return (
    <div className="bg-fo-bg text-fo-text min-h-screen py-16 font-sans relative overflow-hidden">
      
      {/* Background Radial Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-fo-accent/10 rounded-full blur-[180px] pointer-events-none z-0" />
      <div className="absolute bottom-10 right-0 w-[500px] h-[500px] bg-fo-accent/5 rounded-full blur-[160px] pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-8">
          <h1 className="text-4xl sm:text-6xl font-serif text-fo-text leading-tight">
            Fointer Platform’s <span className="italic font-normal text-fo-accent">Use Cases</span>
          </h1>
          
          <p className="text-fo-muted text-sm sm:text-base md:text-lg font-light leading-relaxed pt-2">
            The networking platform will be used by a variety of users, including businesses, organizations, and individuals.
          </p>
        </div>

        {/* Use Cases Cards */}
        <div className="space-y-6">
          {useCases.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div 
                key={idx}
                className="bg-fo-surface/90 border border-fo-accent/25 hover:border-fo-accent/50 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl transition-all duration-300 flex items-start gap-5"
              >
                <div className="p-3.5 rounded-2xl bg-fo-accent/10 text-fo-accent border border-fo-accent/30 flex-shrink-0">
                  <IconComponent className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <p className="text-xs sm:text-sm text-fo-muted font-light leading-relaxed pt-1.5">
                  {item.content}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}