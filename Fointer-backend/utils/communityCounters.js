import Community from "../models/community.js";

/** Keep Community.memberCount in step with active memberships. */
export const adjustMemberCount = async (communityId, delta) => {
  const change = Number(delta) || 0;
  if (!communityId || !change) return;

  await Community.updateOne(
    { _id: communityId },
    { $inc: { memberCount: change } }
  );

  if (change < 0) {
    await Community.updateOne(
      { _id: communityId, memberCount: { $lt: 0 } },
      { $set: { memberCount: 0 } }
    );
  }
};
