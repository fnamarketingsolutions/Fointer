import {
  LuBookOpen as BookOpen,
  LuBriefcase as Briefcase,
  LuCamera as Camera,
  LuCar as Car,
  LuChartColumn as ChartColumn,
  LuClapperboard as Clapperboard,
  LuCpu as Cpu,
  LuDumbbell as Dumbbell,
  LuGamepad2 as Gamepad2,
  LuGlobe as Globe,
  LuGraduationCap as GraduationCap,
  LuHash as Hash,
  LuHeart as Heart,
  LuHeartPulse as HeartPulse,
  LuHouse as House,
  LuLeaf as Leaf,
  LuMap as Map,
  LuMessageCircle as MessageCircle,
  LuMusic as Music,
  LuNewspaper as Newspaper,
  LuPalette as Palette,
  LuPlane as Plane,
  LuShoppingBag as ShoppingBag,
  LuSmartphone as Smartphone,
  LuSparkles as Sparkles,
  LuTrophy as Trophy,
  LuUtensils as Utensils,
  LuUsers as Users,
} from "react-icons/lu";

const CHANNEL_ICONS = [
  { id: "palette", label: "Arts", Icon: Palette },
  { id: "camera", label: "Photography", Icon: Camera },
  { id: "music", label: "Music", Icon: Music },
  { id: "clapperboard", label: "Entertainment", Icon: Clapperboard },
  { id: "car", label: "Auto", Icon: Car },
  { id: "sparkles", label: "Beauty", Icon: Sparkles },
  { id: "leaf", label: "Lifestyle", Icon: Leaf },
  { id: "briefcase", label: "Business", Icon: Briefcase },
  { id: "chart", label: "Finance", Icon: ChartColumn },
  { id: "graduation", label: "Education", Icon: GraduationCap },
  { id: "book", label: "Reading", Icon: BookOpen },
  { id: "heart", label: "Relationships", Icon: Heart },
  { id: "users", label: "Community", Icon: Users },
  { id: "home", label: "Family", Icon: House },
  { id: "utensils", label: "Food", Icon: Utensils },
  { id: "dumbbell", label: "Fitness", Icon: Dumbbell },
  { id: "heart-pulse", label: "Health", Icon: HeartPulse },
  { id: "cpu", label: "Technology", Icon: Cpu },
  { id: "smartphone", label: "Mobile", Icon: Smartphone },
  { id: "plane", label: "Travel", Icon: Plane },
  { id: "map", label: "Places", Icon: Map },
  { id: "globe", label: "World", Icon: Globe },
  { id: "shopping-bag", label: "Shopping", Icon: ShoppingBag },
  { id: "trophy", label: "Sports", Icon: Trophy },
  { id: "gamepad", label: "Gaming", Icon: Gamepad2 },
  { id: "newspaper", label: "News", Icon: Newspaper },
  { id: "message", label: "Discussion", Icon: MessageCircle },
  { id: "hash", label: "General", Icon: Hash },
];

const ICON_MAP = Object.fromEntries(
  CHANNEL_ICONS.map((item) => [item.id, item])
);

function getChannelIcon(iconId) {
  return ICON_MAP[String(iconId || "").trim().toLowerCase()] || null;
}

export function ChannelIconGlyph({ icon, size = 16, className = "" }) {
  const match = getChannelIcon(icon);
  const Glyph = match?.Icon || Hash;
  return <Glyph size={size} className={className} aria-hidden />;
}
