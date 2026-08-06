import React from "react";
import { useParams } from "react-router-dom";
import CommunityBrowseDetail from "../../components/CommunityBrowseDetail";
import useEntityId from "../../../../shared/hooks/useEntityId";

export default function CommunityBrowsePage() {
  const { id } = useParams();
  const { id: communityId } = useEntityId("community", id);

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <CommunityBrowseDetail communityId={communityId} variant="page" />
      </div>
    </div>
  );
}
