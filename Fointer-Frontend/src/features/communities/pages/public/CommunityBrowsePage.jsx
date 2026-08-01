import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CommunityBrowseDetail from "../../components/CommunityBrowseDetail";

export default function CommunityBrowsePage() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      

        <CommunityBrowseDetail communityId={id} variant="page" />
      </div>
    </div>
  );
}
