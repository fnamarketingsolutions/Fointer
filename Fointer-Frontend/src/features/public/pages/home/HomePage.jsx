import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LuArrowRight as ArrowRight,
  LuBriefcase as Briefcase,
  LuCalendar as Calendar,
  LuCpu as Cpu,
  LuFilm as Film,
  LuHash as Hash,
  LuImage as ImageIcon,
  LuMusic as Music,
  LuPlus as Plus,
  LuShoppingBag as ShoppingBag,
  LuSparkles as Sparkles,
  LuTrophy as Trophy,
  LuUsers as Users,
  LuVideo as Video,
} from "react-icons/lu";
import { fetchBrowsableCommunities } from "../../../../api/communities";
import { fetchChannels } from "../../../../api/channels";
import { communitySegment } from "../../../../shared/services/entityLinks";
import { formatCount } from "../../../../shared/utils/format";
import { EXPLORE_PATH } from "../../../../shared/constants/paths";

function iconForChannel(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("sport")) return Trophy;
  if (n.includes("music")) return Music;
  if (n.includes("entertain") || n.includes("film") || n.includes("movie")) return Film;
  if (n.includes("business") || n.includes("career")) return Briefcase;
  if (n.includes("tech")) return Cpu;
  if (n.includes("life") || n.includes("fashion") || n.includes("travel")) {
    return Sparkles;
  }
  if (n.includes("communit")) return Users;
  return Hash;
}

const FEATURES = [
  {
    icon: Users,
    text: "Discover communities and conversations around your interests.",
  },
  {
    icon: Sparkles,
    text: "Connect with people who share your passions.",
  },
  {
    icon: Calendar,
    text: "Discuss events before, during and after they happen.",
  },
  {
    icon: Plus,
    text: "Create your own communities and invite others to join.",
  },
  {
    icon: ImageIcon,
    text: "Share ideas, photos, videos, questions and opinions.",
  },
  {
    icon: Video,
    text: "Watch Together with friends and communities during live events.",
  },
  {
    icon: ShoppingBag,
    text: "Discover & Sell goods and services through the Fointer Marketplace.",
  },
];

const SHELL = "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8";

function PrimaryButton({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto h-12 px-6 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a] transition-colors"
    >
      {children}
    </Link>
  );
}

function SecondaryButton({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto h-12 px-6 rounded-lg border border-[#2A241E] text-[#E5E0D8] text-sm font-semibold hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-colors"
    >
      {children}
    </Link>
  );
}

function communityChannelName(community) {
  const channel = community?.channel;
  if (!channel) return "";
  if (typeof channel === "string") return channel;
  return channel.name || "";
}

function CommunityThumb({ community, name }) {
  if (community?.coverImage) {
    return (
      <img
        src={community.coverImage}
        alt=""
        className="w-10 h-10 rounded-xl object-cover"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-[#241C16] text-[#D4AF37] flex items-center justify-center font-semibold">
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function HeroPreview({ communities, loading }) {
  const preview = communities.slice(0, 4);
  const channels = [
    ...new Set(preview.map(communityChannelName).filter(Boolean)),
  ].slice(0, 4);

  return (
    <div className="relative rounded-xl border border-[#2A241E] bg-[#14100D] p-4 sm:p-6 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-sm font-semibold text-[#E5E0D8]">Communities</p>
            <p className="text-xs text-[#8C8070] mt-0.5">
              Around what you love
            </p>
          </div>
          <Link
            to={EXPLORE_PATH}
            className="text-[11px] font-medium text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-2.5 py-1 rounded-full hover:bg-[#D4AF37]/15 shrink-0"
          >
            Explore
          </Link>
        </div>

        {channels.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-5">
            {channels.map((tag) => (
              <span
                key={tag}
                className="text-xs text-[#C9C0B4] bg-[#1F1914] border border-[#2A241E] rounded-full px-3 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="space-y-2.5">
          {loading ? (
            [0, 1, 2, 3].map((key) => (
              <div
                key={key}
                className="h-[58px] rounded-2xl bg-[#1C1612] border border-[#2A241E] animate-pulse"
              />
            ))
          ) : preview.length === 0 ? (
            <p className="text-sm text-[#8C8070] py-6 text-center">
              Public communities will show up here as they are created.
            </p>
          ) : (
            preview.map((community, index) => {
              const segment = communitySegment(community) || community.id;
              const name = community.name || "Community";
              const channel = communityChannelName(community);
              return (
                <Link
                  key={community.id || segment}
                  to={`/communities/${segment}`}
                  className="flex items-center gap-3 rounded-2xl bg-[#1C1612] border border-[#2A241E] p-3 hover:border-[#D4AF37]/35 transition-colors"
                >
                  <CommunityThumb community={community} name={name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#E5E0D8] truncate">
                      {name}
                    </p>
                    <p className="text-xs text-[#8C8070] truncate">
                      {channel ||
                        community.description ||
                        `${formatCount(community.memberCount || 0)} members`}
                    </p>
                  </div>
                  {index === 0 ? (
                    <span className="hidden sm:inline text-[10px] text-[#D4AF37] font-medium">
                      Popular
                    </span>
                  ) : (
                    <span className="hidden sm:inline text-[10px] text-[#8C8070]">
                      {formatCount(community.memberCount || 0)}
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </div>
    </div>
  );
}

export default function HomePage() {
  const [communities, setCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(true);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Fointer — Find Your Interests. Find Your Community.";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCommunitiesLoading(true);
      try {
        const data = await fetchBrowsableCommunities({
          limit: 6,
          sortBy: "members",
        });
        if (!cancelled) setCommunities(data?.communities || []);
      } catch {
        if (!cancelled) setCommunities([]);
      } finally {
        if (!cancelled) setCommunitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChannelsLoading(true);
      try {
        const data = await fetchChannels();
        if (!cancelled) setChannels(data?.channels || []);
      } catch {
        if (!cancelled) setChannels([]);
      } finally {
        if (!cancelled) setChannelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-[#0E0C0A] text-[#E5E0D8] overflow-x-hidden">
      <section className="pt-8 sm:pt-16 lg:pt-20 pb-12 sm:pb-16 lg:pb-24">
        <div className={`${SHELL} grid lg:grid-cols-2 gap-8 lg:gap-16 items-center`}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="min-w-0"
          >
            <h1 className="text-[1.75rem] sm:text-5xl lg:text-[64px] font-semibold tracking-tight leading-[1.15] sm:leading-[1.08] text-white">
              Find Your Interests.{' '}
              <span className="sm:block">Find Your Community.</span>
            </h1>
            <p className="mt-4 sm:mt-5 text-[15px] sm:text-lg text-[#A69B8D] max-w-xl leading-relaxed">
              Fointer - from FOcused INTERests - brings people together around
              the things they care about.
            </p>
            <p className="mt-3 sm:mt-4 text-[15px] sm:text-base text-[#A69B8D] max-w-xl leading-relaxed">
              Discover communities built around your interests, hobbies and
              passions. Share ideas, join conversations, follow live events,
              connect with people who share your interests, or create a
              community of your own.
            </p>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-[#8C8070] max-w-xl">
              Whatever you&apos;re into, there&apos;s a place for you on Fointer.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3">
              <PrimaryButton to="/signup">
                Join Fointer <ArrowRight size={16} />
              </PrimaryButton>
              <SecondaryButton to={EXPLORE_PATH}>Explore Communities</SecondaryButton>
            </div>
            <p className="mt-5 text-sm text-[#8C8070]">
              Already a Fointer?{" "}
              <Link to="/login" className="text-[#D4AF37] font-medium hover:underline">
                Log in
              </Link>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="min-w-0"
          >
            <HeroPreview
              communities={communities}
              loading={communitiesLoading}
            />
          </motion.div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-24 border-t border-[#2A241E]">
        <div className={SHELL}>
          <div className="max-w-3xl min-w-0">
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
              What are you into?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#A69B8D] leading-relaxed">
              Sports. Music. Entertainment. Politics. Business. Technology.
              Fashion. Books. Travel. Schools. Professional groups. Families.
              Towns and communities - and just about anything else.
            </p>
            <p className="mt-4 text-[#A69B8D] leading-relaxed">
              Fointer turns focused interests into communities. Join the
              conversation, share what you know, discover what others are
              saying, and connect with people who care about the same things
              you do.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {channelsLoading ? (
              [0, 1, 2, 3].map((key) => (
                <div
                  key={key}
                  className="rounded-2xl border border-[#2A241E] bg-[#14100D] p-5 h-36 animate-pulse"
                />
              ))
            ) : channels.length === 0 ? (
              <p className="sm:col-span-2 lg:col-span-4 text-sm text-[#8C8070]">
                Channels will appear here as they are added.
              </p>
            ) : (
              channels.map((channel) => {
                const name = channel.name || "Channel";
                const Icon = iconForChannel(name);
                return (
                  <Link
                    key={channel.id || name}
                    to={`${EXPLORE_PATH}?channel=${encodeURIComponent(name)}`}
                    className="group rounded-2xl border border-[#2A241E] bg-[#14100D] p-5 hover:border-[#D4AF37]/35 hover:bg-[#1A140F] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center mb-4">
                      <Icon size={20} />
                    </div>
                    <h3 className="text-base font-semibold text-white group-hover:text-[#D4AF37] transition-colors">
                      {name}
                    </h3>
                    <p className="mt-1.5 text-sm text-[#8C8070] leading-relaxed">
                      Communities and conversations around {name.toLowerCase()}.
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-24 border-t border-[#2A241E]">
        <div className={SHELL}>
          <div className="max-w-3xl min-w-0">
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
              More than a social feed
            </h2>
            <p className="mt-4 text-[#A69B8D] leading-relaxed">
              On Fointer, you don&apos;t just follow people - you participate in
              communities built around what matters to you.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.text}
                  className="rounded-2xl border border-[#2A241E] bg-[#14100D] p-5 sm:p-6"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center mb-4">
                    <Icon size={20} />
                  </div>
                  <p className="text-sm text-[#C9C0B4] leading-relaxed">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {!communitiesLoading && communities.length > 0 ? (
        <section className="py-12 sm:py-16 lg:py-24 border-t border-[#2A241E]">
          <div className={SHELL}>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#D4AF37]">Active communities</p>
                <h2 className="mt-3 text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
                  Find the people who share it.
                </h2>
              </div>
              <Link
                to={EXPLORE_PATH}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#D4AF37] hover:underline"
              >
                Explore all <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mt-10 divide-y divide-[#2A241E] border border-[#2A241E] rounded-2xl overflow-hidden bg-[#14100D]">
              {communities.map((community) => {
                const segment = communitySegment(community) || community.id;
                const name = community.name || "Community";
                return (
                  <Link
                    key={community.id || segment}
                    to={`/communities/${segment}`}
                    className="flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-[#1C1612] transition-colors"
                  >
                    {community.coverImage ? (
                      <img
                        src={community.coverImage}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[#241C16] text-[#D4AF37] flex items-center justify-center font-semibold shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{name}</p>
                      {community.description ? (
                        <p className="text-xs text-[#8C8070] truncate mt-0.5">
                          {community.description}
                        </p>
                      ) : null}
                    </div>
                    {typeof community.memberCount === "number" ? (
                      <p className="hidden sm:block text-xs text-[#A69B8D] shrink-0">
                        {formatCount(community.memberCount)} members
                      </p>
                    ) : null}
                    <ArrowRight size={16} className="text-[#5C5348] shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-12 sm:py-16 lg:py-24 border-t border-[#2A241E]">
        <div className={`${SHELL} grid lg:grid-cols-2 gap-8 lg:gap-20 items-center`}>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#D4AF37] inline-flex items-center gap-2">
              <ShoppingBag size={14} /> Fointer Marketplace
            </p>
            <h2 className="mt-3 text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
              Discover and sell — without losing the community.
            </h2>
            <p className="mt-4 text-[#A69B8D] leading-relaxed max-w-lg">
              The Marketplace is an important way Fointers share goods and
              services around their interests. It supports the community. It is
              not what Fointer is.
            </p>
            <div className="mt-8">
              <PrimaryButton to="/signup">Join Fointer</PrimaryButton>
            </div>
          </div>
          <div className="rounded-2xl sm:rounded-3xl border border-[#2A241E] bg-[#14100D] p-5 sm:p-8 min-w-0">
            <p className="text-sm font-semibold text-white">Around your interests</p>
            <div className="mt-5 space-y-3">
              {[
                "Goods from people in your communities",
                "Services tied to hobbies and skills",
                "Always secondary to the conversation",
              ].map((line) => (
                <div
                  key={line}
                  className="flex items-start gap-3 text-sm text-[#A69B8D]"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shrink-0" />
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-24 border-t border-[#2A241E]">
        <div className={`${SHELL} grid lg:grid-cols-2 gap-8 lg:gap-20`}>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#D4AF37]">FOINTER</p>
            <h2 className="mt-3 text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
              <span className="text-[#D4AF37]">FO</span>cused +{" "}
              <span className="text-[#D4AF37]">INTER</span>ests
            </h2>
            <p className="mt-4 text-[#A69B8D] leading-relaxed">
              Your interests. Your communities. Your conversations.
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#D4AF37]">Our mission</p>
            <p className="mt-4 text-lg text-[#C9C0B4] leading-relaxed">
              To bring community, belonging and empowerment to everyone by
              connecting people through the interests, hobbies and passions that
              matter to them.
            </p>
            <p className="mt-6 text-sm text-[#8C8070]">
              Find what interests you. Find the people who share it. Join the
              conversation.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-16 sm:pb-20 lg:pb-28">
        <div className={SHELL}>
          <div className="rounded-2xl sm:rounded-3xl bg-[#D4AF37] px-5 py-8 sm:px-12 sm:py-14 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 sm:gap-8">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#0E0C0A] leading-tight">
                Find your place on Fointer.
              </h2>
              <p className="mt-3 text-[#0E0C0A]/75 max-w-md text-sm sm:text-base">
                Join communities built around what you care about — or start one
                of your own.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center w-full sm:w-auto h-12 px-6 rounded-lg bg-[#0E0C0A] text-[#D4AF37] text-sm font-semibold hover:bg-[#1C1612] transition-colors"
              >
                Join Fointer
              </Link>
              <Link
                to={EXPLORE_PATH}
                className="inline-flex items-center justify-center w-full sm:w-auto h-12 px-6 rounded-lg border border-[#0E0C0A]/20 text-[#0E0C0A] text-sm font-semibold hover:bg-[#0E0C0A]/5 transition-colors"
              >
                Explore communities
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}