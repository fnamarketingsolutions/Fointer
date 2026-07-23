import React from "react";
import { Clock } from "lucide-react";

export default function ComingSoon({ title = "This feature", description }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-5">
        <Clock className="w-7 h-7 text-[#D4AF37]" />
      </div>
      <h2 className="text-2xl font-semibold text-[#E5E0D8] mb-2">
        {title} will be coming soon
      </h2>
      <p className="text-sm text-[#A69B8D] max-w-md">
        {description ||
          "We are building this experience. Check back shortly for updates."}
      </p>
    </div>
  );
}
