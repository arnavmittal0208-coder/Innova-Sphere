import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { createServer } from "node:http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const server = createServer(app);

const rawAllowedOrigins = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const allowedOrigins = rawAllowedOrigins.split(",").map((origin) => origin.trim()).filter(Boolean);

const isAllowedOrigin = (origin: string): boolean => {
  if (allowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    return url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
};

const corsOrigin = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  callback(null, isAllowedOrigin(origin));
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST", "PATCH"]
  }
});

app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "DevMatch backend",
    status: "ok",
    message: "Backend is running"
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const jwtSecret = process.env.JWT_SECRET ?? "change_me_in_production";
const maxTeamSize = 5;
const githubToken = process.env.GITHUB_TOKEN?.trim() ?? "";
const githubSyncIntervalMs = Number(process.env.GITHUB_SYNC_INTERVAL_MS ?? 15 * 60 * 1000);

type ExperienceLevel = "beginner" | "intermediate" | "advanced";

type HackathonFeedItem = {
  id: string;
  name: string;
  organizer: string;
  location: string;
  status: "open" | "hot" | "soon";
  dateLabel: string;
  prize: string;
  registrations: number;
  url: string;
  source: "devpost" | "fallback";
};

type HackathonFeedSource = "devpost" | "fallback" | "mixed";

type AuthRequest = Request & {
  authUserId?: string;
};

const SkillSetSchema = new Schema(
  {
    tech: { type: [String], default: [] },
    soft: { type: [String], default: [] },
    domains: { type: [String], default: [] }
  },
  { _id: false }
);

const GithubMetricsSchema = new Schema(
  {
    commits: { type: Number, default: 0 },
    pullRequests: { type: Number, default: 0 },
    repos: { type: Number, default: 0 },
    consistency: { type: Number, default: 0 }
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    skills: { type: SkillSetSchema, required: true, default: () => ({}) },
    preferredRoles: { type: [String], default: [] },
    experienceLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    interests: { type: [String], default: [] },
    hackathonHistory: { type: [String], default: [] },
    githubUrl: { type: String, default: "" },
    linkedinUrl: { type: String, default: "" },
    githubMetrics: { type: GithubMetricsSchema, default: () => ({}) },
    lastGithubSyncAt: { type: Date },
    ratingSummary: { type: Number, default: 0 },
    skillSwapScore: { type: Number, default: 0.5 },
    rankScore: { type: Number, default: 0 },
    profileCompleted: { type: Boolean, default: false },
    rankFieldsLockedUntil: { type: Date }
  },
  { timestamps: true }
);

const TeamRoleSchema = new Schema(
  {
    role: { type: String, required: true, trim: true },
    mustHaveSkills: { type: [String], default: [] }
  },
  { _id: false }
);

const TeamSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    hackathon: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requiredRoles: { type: [TeamRoleSchema], required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    maxMembers: { type: Number, default: maxTeamSize, min: 2 },
    status: { type: String, enum: ["open", "closed"], default: "open" }
  },
  { timestamps: true }
);

const JoinRequestSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    matchPercent: { type: Number, required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" }
  },
  { timestamps: true }
);

JoinRequestSchema.index({ teamId: 1, userId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

const TeamInviteSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    fromUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    toUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    message: { type: String, default: "" },
    responseMessage: { type: String, default: "" }
  },
  { timestamps: true }
);

TeamInviteSchema.index({ teamId: 1, toUserId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

const FriendRequestSchema = new Schema(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    toUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    message: { type: String, default: "" }
  },
  { timestamps: true }
);

FriendRequestSchema.index({ fromUserId: 1, toUserId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

const FriendshipSchema = new Schema(
  {
    userAId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userBId: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

FriendshipSchema.index({ userAId: 1, userBId: 1 }, { unique: true });

const SkillSwapSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    canTeach: { type: [String], default: [] },
    wantsToLearn: { type: [String], default: [] },
    status: { type: String, enum: ["open", "matched", "closed"], default: "open" },
    matchedWith: { type: Schema.Types.ObjectId, ref: "User" },
    acceptedRequestId: { type: Schema.Types.ObjectId, ref: "SkillSwapRequest" }
  },
  { timestamps: true }
);

const SkillSwapRequestSchema = new Schema(
  {
    swapId: { type: Schema.Types.ObjectId, ref: "SkillSwap", required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, default: "" },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    chatRoomId: { type: String, default: "" }
  },
  { timestamps: true }
);

SkillSwapRequestSchema.index({ swapId: 1, requesterId: 1 }, { unique: true });

const TaskSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    budget: { type: Number, required: true },
    status: { type: String, enum: ["open", "assigned", "submitted", "completed"], default: "open" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    rating: { type: Number },
    paymentStatus: { type: String, enum: ["unpaid", "escrowed", "released"], default: "unpaid" },
    escrowAmount: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 10 },
    commissionAmount: { type: Number, default: 0 },
    payoutAmount: { type: Number, default: 0 },
    escrowFundedAt: { type: Date },
    paymentReleasedAt: { type: Date },
    extensionRequestMessage: { type: String, default: "" },
    extensionRequestedAt: { type: Date }
  },
  { timestamps: true }
);

const TaskProposalSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    developerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    price: { type: Number, required: true },
    reasoning: { type: String, required: true },
    portfolioUrl: { type: String, default: "" },
    resumeUrl: { type: String, default: "" },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" }
  },
  { timestamps: true }
);

TaskProposalSchema.index({ taskId: 1, developerId: 1 }, { unique: true });

const UserModel = mongoose.model("User", UserSchema);
const TeamModel = mongoose.model("Team", TeamSchema);
const JoinRequestModel = mongoose.model("JoinRequest", JoinRequestSchema);
const TeamInviteModel = mongoose.model("TeamInvite", TeamInviteSchema);
const FriendRequestModel = mongoose.model("FriendRequest", FriendRequestSchema);
const FriendshipModel = mongoose.model("Friendship", FriendshipSchema);
const SkillSwapModel = mongoose.model("SkillSwap", SkillSwapSchema);
const SkillSwapRequestModel = mongoose.model("SkillSwapRequest", SkillSwapRequestSchema);
const TaskModel = mongoose.model("Task", TaskSchema);
const TaskProposalModel = mongoose.model("TaskProposal", TaskProposalSchema);

type UserDoc = HydratedDocument<InferSchemaType<typeof UserSchema>>;
type TeamDoc = HydratedDocument<InferSchemaType<typeof TeamSchema>>;

const normalize = (arr: string[]) => arr.map((s) => s.trim().toLowerCase()).filter(Boolean);

const normalizeHackathon = (value: string): string => value.trim().toLowerCase();

const getFriendPairIds = (userAId: string, userBId: string) => {
  const [userA, userB] = [userAId, userBId].sort();
  return { userAId: userA, userBId: userB };
};

const buildFriendProfile = (userRaw: any) => ({
  userId: userRaw._id,
  name: userRaw.name,
  email: userRaw.email,
  rankScore: userRaw.rankScore ?? 0,
  preferredRole: userRaw.preferredRoles?.[0] ?? "Developer",
  experienceLevel: userRaw.experienceLevel ?? "beginner",
  coreLanguage: userRaw.skills?.tech?.[0] ?? "Not specified",
  githubUrl: userRaw.githubUrl ?? "",
  linkedinUrl: userRaw.linkedinUrl ?? ""
});

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasTeamInSameHackathon = async (userId: string, hackathon: string, excludeTeamId?: string): Promise<boolean> => {
  const normalized = normalizeHackathon(hackathon);
  const query: Record<string, unknown> = {
    members: userId,
    status: "open",
    hackathon: new RegExp(`^${escapeRegex(normalized)}$`, "i")
  };

  if (excludeTeamId) {
    query._id = { $ne: excludeTeamId };
  }

  const existing = await TeamModel.findOne(query).select("_id").lean();
  return Boolean(existing);
};

const getTeamCapacity = (team: Pick<TeamDoc, "maxMembers"> | { maxMembers?: number | null }): number => {
  const capacity = Number(team.maxMembers ?? maxTeamSize);
  if (!Number.isFinite(capacity) || capacity < 2) return maxTeamSize;
  return Math.floor(capacity);
};

const extractGithubUsername = (githubUrl: string): string | null => {
  const value = githubUrl.trim();
  if (!value) return null;

  const normalized = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
  try {
    const url = new URL(normalized);
    if (!url.hostname.toLowerCase().includes("github.com")) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (!segments.length) return null;

    const candidate = segments[0].replace(/\.git$/i, "");
    if (!/^[A-Za-z0-9-]{1,39}$/.test(candidate)) {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
};

type GithubMetricsSnapshot = {
  commits: number;
  pullRequests: number;
  repos: number;
  consistency: number;
};

const fetchGithubMetrics = async (username: string): Promise<GithubMetricsSnapshot> => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "devmatch-autosync"
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const [userRes, eventsRes] = await Promise.all([
    fetch(`https://api.github.com/users/${username}`, { headers }),
    fetch(`https://api.github.com/users/${username}/events/public?per_page=100`, { headers })
  ]);

  if (!userRes.ok) {
    throw new Error(`github user fetch failed for ${username}`);
  }

  const userJson = (await userRes.json()) as { public_repos?: number };
  const repos = Number(userJson.public_repos ?? 0);

  let commits = 0;
  let pullRequests = 0;
  const activeDays = new Set<string>();

  if (eventsRes.ok) {
    const events = (await eventsRes.json()) as Array<{
      type?: string;
      created_at?: string;
      payload?: { commits?: unknown[]; action?: string };
    }>;

    for (const event of events) {
      if (event.created_at) {
        activeDays.add(event.created_at.slice(0, 10));
      }

      if (event.type === "PushEvent") {
        commits += event.payload?.commits?.length ?? 0;
      }

      if (event.type === "PullRequestEvent" && event.payload?.action === "opened") {
        pullRequests += 1;
      }
    }
  }

  const consistency = Math.min(activeDays.size / 14, 1);
  return { commits, pullRequests, repos, consistency };
};

const intersectionRatio = (a: string[], b: string[]): number => {
  if (!a.length || !b.length) return 0;
  const bSet = new Set(normalize(b));
  const hits = normalize(a).filter((x) => bSet.has(x)).length;
  return hits / Math.max(a.length, 1);
};

const computeProfileCompleted = (user: UserDoc): boolean => {
  return Boolean(
    user.skills.tech.length &&
      user.skills.soft.length &&
      user.skills.domains.length &&
      user.preferredRoles.length &&
      user.interests.length &&
      user.githubUrl &&
      user.linkedinUrl
  );
};

const rankUser = (user: UserDoc): number => {
  const githubRaw = user.githubMetrics.commits + user.githubMetrics.pullRequests + user.githubMetrics.repos;
  const githubScore = Math.min(githubRaw / 300, 1) * 0.8 + (user.githubUrl ? 0.2 : 0);
  const hackathonScore = Math.min(user.hackathonHistory.length / 8, 1);
  const taskRatingScore = user.ratingSummary ? Math.min(user.ratingSummary / 5, 1) : 0.5;
  const skillSwapScore = user.skillSwapScore ? Math.min(user.skillSwapScore, 1) : 0.5;
  const score = 0.35 * githubScore + 0.25 * hackathonScore + 0.2 * taskRatingScore + 0.2 * skillSwapScore;
  return Math.round(score * 100);
};

const syncGithubForUser = async (user: UserDoc): Promise<boolean> => {
  const username = extractGithubUsername(user.githubUrl ?? "");
  if (!username) return false;

  const metrics = await fetchGithubMetrics(username);
  const previousRank = user.rankScore;

  user.githubMetrics.commits = metrics.commits;
  user.githubMetrics.pullRequests = metrics.pullRequests;
  user.githubMetrics.repos = metrics.repos;
  user.githubMetrics.consistency = metrics.consistency;
  user.lastGithubSyncAt = new Date();
  user.rankScore = rankUser(user);

  await user.save();

  if (previousRank !== user.rankScore) {
    io.emit("user.profile.updated", { userId: user._id.toString(), rankScore: user.rankScore });
  }

  return true;
};

let githubSyncRunning = false;
const runGithubAutoSync = async () => {
  if (githubSyncRunning) return;
  githubSyncRunning = true;
  try {
    const users = await UserModel.find({ githubUrl: { $exists: true, $ne: "" } });
    for (const user of users) {
      try {
        await syncGithubForUser(user);
      } catch (error) {
        console.warn("GitHub autosync failed for user", user._id.toString(), error);
      }
    }
  } finally {
    githubSyncRunning = false;
  }
};

const teamToUserMatch = (team: TeamDoc, user: UserDoc): number => {
  const teamRoleNames = normalize(team.requiredRoles.map((r) => r.role));
  const teamSkillNeeds = normalize(team.requiredRoles.flatMap((r) => r.mustHaveSkills));
  const userRoleSkills = normalize([...user.skills.tech, ...user.skills.soft]);
  const userRoleSignals = normalize([...user.preferredRoles, ...user.skills.domains]);

  const requiredSkillFit = intersectionRatio(teamSkillNeeds, userRoleSkills);
  const requiredRoleFit = intersectionRatio(teamRoleNames, userRoleSignals);
  const roleSkillFit =
    teamSkillNeeds.length || teamRoleNames.length
      ? 0.7 * requiredSkillFit + 0.3 * requiredRoleFit
      : 0;

  if ((teamSkillNeeds.length > 0 || teamRoleNames.length > 0) && roleSkillFit === 0) {
    return 0;
  }

  const experienceFit = user.experienceLevel === "advanced" ? 1 : user.experienceLevel === "intermediate" ? 0.75 : 0.5;
  const domainFit = intersectionRatio([team.hackathon], user.interests);
  const availabilityFit = 0.8;
  const rankFit = user.rankScore / 100;

  const weighted =
    0.55 * roleSkillFit +
    0.15 * experienceFit +
    0.1 * domainFit +
    0.1 * availabilityFit +
    0.1 * rankFit;

  return Math.max(Math.round(weighted * 100), 0);
};

const signToken = (userId: string): string => jwt.sign({ userId }, jwtSecret, { expiresIn: "7d" });

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "missing bearer token" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret) as { userId: string };
    req.authUserId = payload.userId;
    return next();
  } catch {
    return res.status(401).json({ message: "invalid token" });
  }
};

const canEditRankCriticalFields = (user: UserDoc): boolean => {
  return !user.rankFieldsLockedUntil || user.rankFieldsLockedUntil.getTime() <= Date.now();
};

const DEMO_USERS = [
  {
    name: "Priya Sharma",
    email: "priya@iit.ac.in",
    password: "demo",
    experienceLevel: "advanced" as ExperienceLevel,
    skills: { tech: ["react", "javascript", "figma"], soft: ["communication", "pitching"], domains: ["frontend"] },
    preferredRoles: ["frontend developer"],
    interests: ["fintech", "healthcare"],
    hackathonHistory: ["Smart India Hackathon 2025", "HackIndia 2025"],
    githubUrl: "https://github.com/priya",
    linkedinUrl: "https://linkedin.com/in/priya",
    githubMetrics: { commits: 240, pullRequests: 42, repos: 14, consistency: 0.92 },
    rankScore: 88
  },
  {
    name: "Rahul Verma",
    email: "rahul@bits.ac.in",
    password: "demo",
    experienceLevel: "advanced" as ExperienceLevel,
    skills: { tech: ["node", "mongodb", "aws"], soft: ["leadership", "planning"], domains: ["backend"] },
    preferredRoles: ["backend developer"],
    interests: ["saas", "platform engineering"],
    hackathonHistory: ["HackMIT India", "Devfolio Season 2"],
    githubUrl: "https://github.com/rahul",
    linkedinUrl: "https://linkedin.com/in/rahul",
    githubMetrics: { commits: 310, pullRequests: 58, repos: 19, consistency: 0.95 },
    rankScore: 92
  },
  {
    name: "Aanya Patel",
    email: "aanya@nit.ac.in",
    password: "demo",
    experienceLevel: "intermediate" as ExperienceLevel,
    skills: { tech: ["python", "ml/ai", "javascript"], soft: ["research", "communication"], domains: ["ai"] },
    preferredRoles: ["ml/ai engineer"],
    interests: ["healthcare", "education"],
    hackathonHistory: ["AI Challenge 2025"],
    githubUrl: "https://github.com/aanya",
    linkedinUrl: "https://linkedin.com/in/aanya",
    githubMetrics: { commits: 150, pullRequests: 21, repos: 10, consistency: 0.81 },
    rankScore: 74
  },
  {
    name: "Dev Kumar",
    email: "dev@vit.ac.in",
    password: "demo",
    experienceLevel: "intermediate" as ExperienceLevel,
    skills: { tech: ["react", "node.js", "mongodb"], soft: ["teamwork", "delivery"], domains: ["full stack"] },
    preferredRoles: ["full stack developer"],
    interests: ["productivity", "developer tools"],
    hackathonHistory: ["HackIndia 2025"],
    githubUrl: "https://github.com/dev",
    linkedinUrl: "https://linkedin.com/in/dev",
    githubMetrics: { commits: 130, pullRequests: 17, repos: 11, consistency: 0.77 },
    rankScore: 69
  },
  {
    name: "Sneha Rao",
    email: "sneha@manipal.edu",
    password: "demo",
    experienceLevel: "advanced" as ExperienceLevel,
    skills: { tech: ["figma", "ui design"], soft: ["presentation", "storytelling"], domains: ["design"] },
    preferredRoles: ["ui/ux designer", "pitcher/presenter"],
    interests: ["consumer apps", "education"],
    hackathonHistory: ["Smart India Hackathon 2024", "Design Jam 2025"],
    githubUrl: "https://github.com/sneha",
    linkedinUrl: "https://linkedin.com/in/sneha",
    githubMetrics: { commits: 80, pullRequests: 12, repos: 6, consistency: 0.7 },
    rankScore: 79
  }
];

const DEMO_TEAMS = [
  {
    name: "Nexus Builders",
    description: "Fast-moving hackathon team building a fintech dashboard.",
    hackathon: "HackIndia 2025",
    requiredRoles: [
      { role: "backend developer", mustHaveSkills: ["node", "mongodb"] },
      { role: "ui/ux designer", mustHaveSkills: ["figma", "ui design"] }
    ],
    memberEmails: ["rahul@bits.ac.in", "sneha@manipal.edu"]
  },
  {
    name: "AI Forge",
    description: "ML + product team creating an AI assistant for students.",
    hackathon: "AI Challenge 2025",
    requiredRoles: [
      { role: "ml/ai engineer", mustHaveSkills: ["python", "ml/ai"] },
      { role: "frontend developer", mustHaveSkills: ["react", "javascript"] }
    ],
    memberEmails: ["aanya@nit.ac.in", "priya@iit.ac.in"]
  },
  {
    name: "Build Sprint",
    description: "Generalist team looking for strong full stack contributors.",
    hackathon: "Devfolio Season 2",
    requiredRoles: [
      { role: "full stack developer", mustHaveSkills: ["react", "node.js", "mongodb"] },
      { role: "pitcher/presenter", mustHaveSkills: ["pitching", "storytelling"] }
    ],
    memberEmails: ["dev@vit.ac.in"]
  }
];

const FALLBACK_HACKATHONS: HackathonFeedItem[] = [
  {
    id: "fallback-1",
    name: "HackIndia 2026",
    organizer: "DevMatch Community",
    location: "Online",
    status: "open",
    dateLabel: "Apr 20 - Apr 22, 2026",
    prize: "Rs 5,00,000",
    registrations: 1200,
    url: "https://devpost.com/hackathons",
    source: "fallback"
  },
  {
    id: "fallback-2",
    name: "Smart India Hackathon",
    organizer: "Govt + Partner Colleges",
    location: "India",
    status: "hot",
    dateLabel: "May 04 - May 07, 2026",
    prize: "Rs 1,00,000",
    registrations: 2600,
    url: "https://devpost.com/hackathons",
    source: "fallback"
  },
  {
    id: "fallback-3",
    name: "University Build Sprint",
    organizer: "Campus Tech Council",
    location: "Hybrid",
    status: "soon",
    dateLabel: "Jun 12 - Jun 13, 2026",
    prize: "Rs 75,000",
    registrations: 430,
    url: "https://devpost.com/hackathons",
    source: "fallback"
  }
];

const CURATED_HACKATHONS: HackathonFeedItem[] = [
  {
    id: "curated-1",
    name: "DevMatch Campus Clash",
    organizer: "DevMatch",
    location: "India",
    status: "open",
    dateLabel: "Apr 25 - Apr 27, 2026",
    prize: "Rs 2,00,000",
    registrations: 640,
    url: "https://devpost.com/hackathons",
    source: "fallback"
  },
  {
    id: "curated-2",
    name: "Realtime Build Challenge",
    organizer: "DevMatch Labs",
    location: "Online",
    status: "soon",
    dateLabel: "May 10 - May 11, 2026",
    prize: "Rs 1,20,000",
    registrations: 410,
    url: "https://devpost.com/hackathons",
    source: "fallback"
  }
];

const stripHtml = (raw: string): string => raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const inferHackathonStatus = (openState: string, timeLeft: string): "open" | "hot" | "soon" => {
  if (openState === "open" && /(hour|day)/i.test(timeLeft)) return "hot";
  if (openState === "open") return "open";
  return "soon";
};

const fetchLiveHackathons = async (
  limit: number
): Promise<{ source: HackathonFeedSource; hackathons: HackathonFeedItem[] }> => {
  try {
    const response = await fetch("https://devpost.com/api/hackathons");
    if (!response.ok) {
      return { source: "fallback", hackathons: FALLBACK_HACKATHONS.slice(0, limit) };
    }

    const data = (await response.json()) as {
      hackathons?: Array<{
        id: number;
        title: string;
        organization_name?: string;
        displayed_location?: { location?: string };
        open_state?: string;
        submission_period_dates?: string;
        time_left_to_submission?: string;
        prize_amount?: string;
        registrations_count?: number;
        url?: string;
      }>;
    };

    const mapped = (data.hackathons ?? []).map((hackathon) => ({
      id: String(hackathon.id),
      name: hackathon.title,
      organizer: hackathon.organization_name || "Devpost",
      location: hackathon.displayed_location?.location || "Online",
      status: inferHackathonStatus(hackathon.open_state || "open", hackathon.time_left_to_submission || ""),
      dateLabel: hackathon.submission_period_dates || "Dates to be announced",
      prize: stripHtml(hackathon.prize_amount || "Prize to be announced"),
      registrations: hackathon.registrations_count || 0,
      url: hackathon.url || "https://devpost.com/hackathons",
      source: "devpost" as const
    }));

    if (!mapped.length) {
      return { source: "fallback", hackathons: FALLBACK_HACKATHONS.slice(0, limit) };
    }

    // Keep feed mostly real: ~90% from live source, small curated slice for demo stability.
    const fakeCount = Math.min(1, Math.max(0, Math.round(limit * 0.1)));
    const realCount = Math.max(1, limit - fakeCount);
    const realItems = mapped.slice(0, realCount);
    const curatedItems = CURATED_HACKATHONS.slice(0, Math.max(0, limit - realItems.length));

    if (!curatedItems.length) {
      return { source: "devpost", hackathons: realItems.slice(0, limit) };
    }

    const mixed = [...realItems, ...curatedItems].slice(0, limit);
    return { source: "mixed", hackathons: mixed };
  } catch {
    return { source: "fallback", hackathons: FALLBACK_HACKATHONS.slice(0, limit) };
  }
};

const seedDemoData = async () => {
  const passwordHash = await bcrypt.hash("123456", 10);

  const userByEmail = new Map<string, UserDoc>();
  for (const demoUser of DEMO_USERS) {
    let user = await UserModel.findOne({ email: demoUser.email });
    if (!user) {
      user = await UserModel.create({
        name: demoUser.name,
        email: demoUser.email,
        passwordHash,
        skills: demoUser.skills,
        preferredRoles: demoUser.preferredRoles,
        experienceLevel: demoUser.experienceLevel,
        interests: demoUser.interests,
        hackathonHistory: demoUser.hackathonHistory,
        githubUrl: demoUser.githubUrl,
        linkedinUrl: demoUser.linkedinUrl,
        githubMetrics: demoUser.githubMetrics,
        ratingSummary: 4.6,
        skillSwapScore: 0.8,
        rankScore: demoUser.rankScore,
        profileCompleted: true
      });
    }

    user.passwordHash = passwordHash;

    if (user.rankScore !== demoUser.rankScore) {
      user.rankScore = demoUser.rankScore;
      user.profileCompleted = true;
    }

    await user.save();

    userByEmail.set(demoUser.email, user);
  }

  for (const teamSeed of DEMO_TEAMS) {
    const exists = await TeamModel.findOne({ name: teamSeed.name }).lean();
    if (exists) continue;

    const members = teamSeed.memberEmails
      .map((email) => userByEmail.get(email)?._id)
      .filter((memberId): memberId is NonNullable<typeof memberId> => Boolean(memberId));

    const creator = members[0] ?? userByEmail.get(DEMO_USERS[0].email)?._id;
    if (!creator) continue;

    await TeamModel.create({
      name: teamSeed.name,
      description: teamSeed.description,
      hackathon: teamSeed.hackathon,
      createdBy: creator,
      requiredRoles: teamSeed.requiredRoles,
      members: members.length ? members : [creator],
      status: "open"
    });
  }
};

app.get("/health", async (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.json({ ok: true, service: "devmatch-backend", dbOk });
});

app.get("/hackathons/live", async (req, res) => {
  const parsedLimit = Number(req.query.limit ?? 8);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 20) : 8;
  const { source, hackathons } = await fetchLiveHackathons(limit);
  return res.json({ source, count: hackathons.length, hackathons });
});

app.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, password are required" });
  }

  const existing = await UserModel.findOne({ email: email.toLowerCase().trim() }).lean();
  if (existing) {
    return res.status(409).json({ message: "email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ name, email, passwordHash });
  const token = signToken(user._id.toString());
  return res.status(201).json({ token, user: { _id: user._id, name: user.name, email: user.email, rankScore: user.rankScore } });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return res.status(401).json({ message: "invalid credentials" });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: "invalid credentials" });
  }

  const token = signToken(user._id.toString());
  return res.json({ token, user: { _id: user._id, name: user.name, email: user.email, rankScore: user.rankScore } });
});

app.get("/auth/me", authMiddleware, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.authUserId)
    .select("name email rankScore profileCompleted githubMetrics ratingSummary skillSwapScore githubUrl linkedinUrl experienceLevel skills hackathonHistory preferredRoles")
    .lean();
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }
  return res.json(user);
});

app.get("/users/:id", authMiddleware, async (req, res) => {
  const user = await UserModel.findById(req.params.id).select("-passwordHash").lean();
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }
  return res.json(user);
});

app.patch("/users/:id", authMiddleware, async (req: AuthRequest, res) => {
  if (req.authUserId !== req.params.id) {
    return res.status(403).json({ message: "you can only update your own profile" });
  }

  const user = await UserModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }

  const payload = req.body as {
    name?: string;
    skills?: { tech: string[]; soft: string[]; domains: string[] };
    preferredRoles?: string[];
    interests?: string[];
    hackathonHistory?: string[];
    experienceLevel?: ExperienceLevel;
    githubUrl?: string;
    linkedinUrl?: string;
    githubMetrics?: { commits?: number; pullRequests?: number; repos?: number; consistency?: number };
  };

  const hasSkillsChanged =
    payload.skills !== undefined &&
    JSON.stringify(payload.skills) !== JSON.stringify(user.skills);
  const hasPreferredRolesChanged =
    payload.preferredRoles !== undefined &&
    JSON.stringify(payload.preferredRoles) !== JSON.stringify(user.preferredRoles);
  const hasInterestsChanged =
    payload.interests !== undefined &&
    JSON.stringify(payload.interests) !== JSON.stringify(user.interests);
  const hasHackathonHistoryChanged =
    payload.hackathonHistory !== undefined &&
    JSON.stringify(payload.hackathonHistory) !== JSON.stringify(user.hackathonHistory);
  const hasExperienceLevelChanged =
    payload.experienceLevel !== undefined && payload.experienceLevel !== user.experienceLevel;
  const hasGithubUrlChanged =
    payload.githubUrl !== undefined && payload.githubUrl !== user.githubUrl;

  const updatesRankCritical =
    hasSkillsChanged ||
    hasPreferredRolesChanged ||
    hasInterestsChanged ||
    hasHackathonHistoryChanged ||
    hasExperienceLevelChanged ||
    hasGithubUrlChanged;

  if (updatesRankCritical && !canEditRankCriticalFields(user)) {
    return res.status(429).json({
      message: "rank critical fields are temporarily locked",
      rankFieldsLockedUntil: user.rankFieldsLockedUntil
    });
  }

  if (payload.skills) user.skills = payload.skills;
  if (payload.name) user.name = payload.name.trim();
  if (payload.preferredRoles) user.preferredRoles = payload.preferredRoles;
  if (payload.interests) user.interests = payload.interests;
  if (payload.hackathonHistory) user.hackathonHistory = payload.hackathonHistory;
  if (payload.experienceLevel) user.experienceLevel = payload.experienceLevel;
  if (payload.githubUrl !== undefined) user.githubUrl = payload.githubUrl;
  if (payload.linkedinUrl !== undefined) user.linkedinUrl = payload.linkedinUrl;

  if (payload.githubMetrics) {
    user.githubMetrics.commits = payload.githubMetrics.commits ?? user.githubMetrics.commits;
    user.githubMetrics.pullRequests = payload.githubMetrics.pullRequests ?? user.githubMetrics.pullRequests;
    user.githubMetrics.repos = payload.githubMetrics.repos ?? user.githubMetrics.repos;
    user.githubMetrics.consistency = payload.githubMetrics.consistency ?? user.githubMetrics.consistency;
    user.lastGithubSyncAt = new Date();
  }

  if (updatesRankCritical) {
    user.rankFieldsLockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  user.profileCompleted = computeProfileCompleted(user);
  user.rankScore = rankUser(user);

  await user.save();

  if (payload.githubUrl !== undefined) {
    try {
      await syncGithubForUser(user);
    } catch (error) {
      console.warn("Immediate GitHub sync failed", req.params.id, error);
    }
  }

  io.emit("user.profile.updated", { userId: user._id.toString(), rankScore: user.rankScore });
  return res.json(user);
});

app.get("/users/:id/rank", authMiddleware, async (req, res) => {
  const user = await UserModel.findById(req.params.id).select("rankScore").lean();
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }
  return res.json({ userId: req.params.id, rankScore: user.rankScore });
});

app.post("/users/:id/rank/refresh", authMiddleware, async (req: AuthRequest, res) => {
  if (req.authUserId !== req.params.id) {
    return res.status(403).json({ message: "you can only refresh your own rank" });
  }

  const user = await UserModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }

  user.rankScore = rankUser(user);
  await user.save();
  return res.json({ userId: req.params.id, rankScore: user.rankScore });
});

app.post("/users/:id/github/sync", authMiddleware, async (req: AuthRequest, res) => {
  if (req.authUserId !== req.params.id) {
    return res.status(403).json({ message: "you can only sync your own github profile" });
  }

  const user = await UserModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }

  const synced = await syncGithubForUser(user);
  if (!synced) {
    return res.status(400).json({ message: "valid githubUrl is required for sync" });
  }

  return res.json({
    userId: user._id,
    rankScore: user.rankScore,
    githubMetrics: user.githubMetrics,
    lastGithubSyncAt: user.lastGithubSyncAt
  });
});

app.post("/teams", authMiddleware, async (req: AuthRequest, res) => {
  const { name, description, hackathon, requiredRoles } = req.body as {
    name?: string;
    description?: string;
    hackathon?: string;
    requiredRoles?: Array<{ role: string; mustHaveSkills: string[] }>;
  };

  if (!name || !description || !hackathon || !requiredRoles?.length) {
    return res.status(400).json({ message: "name, description, hackathon, requiredRoles are required" });
  }

  const creator = await UserModel.findById(req.authUserId);
  if (!creator) {
    return res.status(404).json({ message: "creator not found" });
  }

  const creatorAlreadyInHackathon = await hasTeamInSameHackathon(creator._id.toString(), hackathon);
  if (creatorAlreadyInHackathon) {
    return res.status(409).json({ message: "you are already in a team for this hackathon. Leave it before creating another" });
  }

  const team = await TeamModel.create({
    name,
    description,
    hackathon,
    createdBy: creator._id,
    requiredRoles,
    members: [creator._id],
    maxMembers: maxTeamSize,
    status: "open"
  });

  io.emit("team.created", team.toObject());
  return res.status(201).json(team);
});

app.get("/teams/open", authMiddleware, async (_req, res) => {
  const open = await TeamModel.find({ status: "open" }).sort({ createdAt: -1 }).lean();
  return res.json(open);
});

app.get("/teams/:id/details", authMiddleware, async (req, res) => {
  const team = await TeamModel.findById(req.params.id).lean();
  if (!team) {
    return res.status(404).json({ message: "team not found" });
  }

  const memberIds = Array.from(new Set(team.members.map((memberId) => memberId.toString())));
  const members = await UserModel.find({ _id: { $in: memberIds } })
    .select("name email preferredRoles experienceLevel skills rankScore githubUrl linkedinUrl")
    .lean();

  const memberMap = new Map(members.map((member) => [member._id.toString(), member]));
  const orderedMembers = memberIds
    .map((id) => memberMap.get(id))
    .filter((member): member is NonNullable<typeof member> => Boolean(member))
    .map((member) => ({
      _id: member._id,
      name: member.name,
      email: member.email,
      preferredRole: member.preferredRoles?.[0] ?? "Developer",
      experienceLevel: member.experienceLevel ?? "beginner",
      coreLanguage: member.skills?.tech?.[0] ?? "Not specified",
      rankScore: member.rankScore,
      githubUrl: member.githubUrl ?? "",
      linkedinUrl: member.linkedinUrl ?? ""
    }));

  return res.json({
    _id: team._id,
    name: team.name,
    description: team.description,
    hackathon: team.hackathon,
    createdBy: team.createdBy,
    status: team.status,
    maxMembers: getTeamCapacity(team),
    members: orderedMembers
  });
});

app.patch("/teams/:id/status", authMiddleware, async (req: AuthRequest, res) => {
  const { status } = req.body as { status?: "open" | "closed" };
  if (!status || !["open", "closed"].includes(status)) {
    return res.status(400).json({ message: "status must be open or closed" });
  }

  const team = await TeamModel.findById(req.params.id);
  if (!team) {
    return res.status(404).json({ message: "team not found" });
  }

  if (team.createdBy.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only team creator can change team status" });
  }

  team.status = status;
  await team.save();

  io.emit("team.status.updated", {
    teamId: team._id.toString(),
    status: team.status
  });

  return res.json(team);
});

app.patch("/teams/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { name, description, maxMembers } = req.body as { name?: string; description?: string; maxMembers?: number };
  if (name === undefined && description === undefined && maxMembers === undefined) {
    return res.status(400).json({ message: "name, description, or maxMembers is required" });
  }

  const team = await TeamModel.findById(req.params.id);
  if (!team) {
    return res.status(404).json({ message: "team not found" });
  }

  if (team.createdBy.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only team creator can update team details" });
  }

  const currentMembers = team.members.length;
  const nextMaxMembers = maxMembers === undefined ? getTeamCapacity(team) : Math.floor(Number(maxMembers));
  if (maxMembers !== undefined) {
    if (!Number.isFinite(nextMaxMembers) || nextMaxMembers < 2) {
      return res.status(400).json({ message: "maxMembers must be at least 2" });
    }
    if (nextMaxMembers < currentMembers) {
      return res.status(409).json({ message: "maxMembers cannot be less than current member count" });
    }
    team.maxMembers = nextMaxMembers;
  }

  if (typeof name === "string" && name.trim()) {
    team.name = name.trim();
  }

  if (typeof description === "string") {
    team.description = description.trim();
  }

  await team.save();

  io.emit("team.updated", team.toObject());
  return res.json(team);
});

app.patch("/teams/:id/leave", authMiddleware, async (req: AuthRequest, res) => {
  const team = await TeamModel.findById(req.params.id);
  if (!team) {
    return res.status(404).json({ message: "team not found" });
  }

  const userId = req.authUserId;
  if (!userId) {
    return res.status(401).json({ message: "unauthorized" });
  }

  const isMember = team.members.some((memberId) => memberId.toString() === userId);
  if (!isMember) {
    return res.status(409).json({ message: "you are not a member of this team" });
  }

  team.members = team.members.filter((memberId) => memberId.toString() !== userId);
  if (team.members.length === 0) {
    team.status = "closed";
  }
  await team.save();

  io.emit("team.member.left", {
    teamId: team._id.toString(),
    userId,
    members: team.members,
    status: team.status
  });

  return res.json(team);
});

app.get("/teams/:id/suggestions", authMiddleware, async (req, res) => {
  const team = await TeamModel.findById(req.params.id).lean();
  if (!team) {
    return res.status(404).json({ message: "team not found" });
  }

  const users = await UserModel.find({
    _id: { $nin: team.members }
  }).lean();

  const teamDoc = new TeamModel(team);
  const suggestions = users
    .map((userRaw) => {
      const userDoc = new UserModel(userRaw);
      const coreLanguage = userRaw.skills?.tech?.[0] ?? "Not specified";
      const preferredRole = userRaw.preferredRoles?.[0] ?? "Developer";
      const matchPercent = teamToUserMatch(teamDoc, userDoc);

      return {
        userId: userRaw._id,
        name: userRaw.name,
        rankScore: userRaw.rankScore,
        coreLanguage,
        preferredRole,
        experienceLevel: userRaw.experienceLevel ?? "beginner",
        topTechSkills: (userRaw.skills?.tech ?? []).slice(0, 3),
        githubUrl: userRaw.githubUrl ?? "",
        linkedinUrl: userRaw.linkedinUrl ?? "",
        matchPercent,
        updatedAt: userRaw.updatedAt ? new Date(userRaw.updatedAt).getTime() : 0
      };
    })
    .filter((item) => item.matchPercent > 0)
    .sort((a, b) => {
      if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      return a.name.localeCompare(b.name);
    })
    .map(({ updatedAt: _updatedAt, ...item }) => item)
    .slice(0, 20);

  return res.json(suggestions);
});

app.get("/users/:id/open-teams", authMiddleware, async (req, res) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }

  const teams = await TeamModel.find({ status: "open", members: { $ne: user._id } }).lean();
  const userDoc = user;
  const ranked = teams
    .map((teamRaw) => {
      const teamDoc = new TeamModel(teamRaw);
      return {
        teamId: teamRaw._id,
        teamName: teamRaw.name,
        hackathon: teamRaw.hackathon,
        requiredRoles: (teamRaw.requiredRoles ?? []).map((roleItem) => roleItem.role),
        matchPercent: teamToUserMatch(teamDoc, userDoc)
      };
    })
    .sort((a, b) => b.matchPercent - a.matchPercent);

  return res.json(ranked);
});

app.post("/teams/:id/join-requests", authMiddleware, async (req: AuthRequest, res) => {
  const team = await TeamModel.findById(req.params.id).lean();
  if (!team) {
    return res.status(404).json({ message: "team not found" });
  }

  const user = await UserModel.findById(req.authUserId);
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }

  const alreadyInHackathonTeam = await hasTeamInSameHackathon(user._id.toString(), team.hackathon, team._id.toString());
  if (alreadyInHackathonTeam) {
    return res.status(409).json({ message: "you are already in another team for this hackathon. Leave it first" });
  }

  if (team.members.length >= getTeamCapacity(team)) {
    return res.status(409).json({ message: "team is full" });
  }

  const existingPending = await JoinRequestModel.findOne({ teamId: team._id, userId: user._id, status: "pending" }).lean();
  if (existingPending) {
    return res.status(409).json({ message: "pending request already exists" });
  }

  const matchPercent = teamToUserMatch(new TeamModel(team), user);
  const requestDoc = await JoinRequestModel.create({
    teamId: team._id,
    userId: user._id,
    matchPercent,
    status: "pending"
  });

  io.emit("team.join.requested", requestDoc.toObject());
  return res.status(201).json(requestDoc);
});

app.get("/teams/:id/join-requests", authMiddleware, async (req, res) => {
  const requests = await JoinRequestModel.find({ teamId: req.params.id }).sort({ createdAt: -1 }).lean();
  return res.json(requests);
});

app.get("/users/:id/incoming-join-requests", authMiddleware, async (req: AuthRequest, res) => {
  if (req.authUserId !== req.params.id) {
    return res.status(403).json({ message: "you can only view your own incoming requests" });
  }

  const creatorTeams = await TeamModel.find({ createdBy: req.params.id }).select("_id name").lean();
  if (!creatorTeams.length) {
    return res.json([]);
  }

  const teamMap = new Map(creatorTeams.map((team) => [team._id.toString(), team.name]));
  const teamIds = creatorTeams.map((team) => team._id);

  const requests = await JoinRequestModel.find({ teamId: { $in: teamIds } })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  if (!requests.length) {
    return res.json([]);
  }

  const requesterIds = Array.from(new Set(requests.map((requestItem) => requestItem.userId.toString())));
  const requesters = await UserModel.find({ _id: { $in: requesterIds } }).select("name").lean();
  const requesterMap = new Map(requesters.map((user) => [user._id.toString(), user.name]));

  const incoming = requests.map((requestItem) => ({
    requestId: requestItem._id,
    teamId: requestItem.teamId,
    teamName: teamMap.get(requestItem.teamId.toString()) ?? "Team",
    fromUserId: requestItem.userId,
    fromUserName: requesterMap.get(requestItem.userId.toString()) ?? "Unknown user",
    matchPercent: requestItem.matchPercent,
    status: requestItem.status,
    createdAt: requestItem.createdAt
  }));

  return res.json(incoming);
});

app.get("/users/:id/sent-join-requests", authMiddleware, async (req: AuthRequest, res) => {
  if (req.authUserId !== req.params.id) {
    return res.status(403).json({ message: "you can only view your own sent requests" });
  }

  const requests = await JoinRequestModel.find({ userId: req.params.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  if (!requests.length) {
    return res.json([]);
  }

  const teamIds = Array.from(new Set(requests.map((requestItem) => requestItem.teamId.toString())));
  const teams = await TeamModel.find({ _id: { $in: teamIds } }).select("name createdBy").lean();
  const creatorIds = Array.from(new Set(teams.map((team) => team.createdBy.toString())));
  const creators = await UserModel.find({ _id: { $in: creatorIds } }).select("name").lean();

  const teamMap = new Map(teams.map((team) => [team._id.toString(), team]));
  const creatorMap = new Map(creators.map((creator) => [creator._id.toString(), creator.name]));

  const sent = requests.map((requestItem) => {
    const team = teamMap.get(requestItem.teamId.toString());
    const creatorName = team ? creatorMap.get(team.createdBy.toString()) : undefined;
    return {
      requestId: requestItem._id,
      teamId: requestItem.teamId,
      teamName: team?.name ?? "Team",
      creatorName: creatorName ?? "Unknown creator",
      matchPercent: requestItem.matchPercent,
      status: requestItem.status,
      createdAt: requestItem.createdAt
    };
  });

  return res.json(sent);
});

app.patch("/join-requests/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { status } = req.body as { status?: "accepted" | "declined" };
  if (!status || !["accepted", "declined"].includes(status)) {
    return res.status(400).json({ message: "status must be accepted or declined" });
  }

  const requestDoc = await JoinRequestModel.findById(req.params.id);
  if (!requestDoc) {
    return res.status(404).json({ message: "join request not found" });
  }

  const team = await TeamModel.findById(requestDoc.teamId);
  if (!team) {
    return res.status(404).json({ message: "team not found" });
  }

  if (team.createdBy.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only team leader can accept or decline requests" });
  }

  if (requestDoc.status !== "pending") {
    return res.status(409).json({ message: "request already resolved" });
  }

  if (status === "accepted") {
    const userAlreadyInHackathonTeam = await hasTeamInSameHackathon(requestDoc.userId.toString(), team.hackathon, team._id.toString());
    if (userAlreadyInHackathonTeam) {
      return res.status(409).json({ message: "user is already in another team for this hackathon" });
    }

    const teamCapacity = getTeamCapacity(team);

    const teamUpdate = await TeamModel.findOneAndUpdate(
      {
        _id: team._id,
        status: "open",
        members: { $ne: requestDoc.userId },
        $expr: { $lt: [{ $size: "$members" }, teamCapacity] }
      },
      {
        $addToSet: { members: requestDoc.userId }
      },
      { new: true }
    );

    if (!teamUpdate) {
      return res.status(409).json({ message: "team is full or no longer open" });
    }

    if (teamUpdate.members.length >= getTeamCapacity(teamUpdate)) {
      teamUpdate.status = "closed";
      await teamUpdate.save();
    }

    io.emit("team.member.added", { teamId: teamUpdate._id, userId: requestDoc.userId, members: teamUpdate.members });
  }

  requestDoc.status = status;
  await requestDoc.save();
  io.emit("team.join.request.updated", requestDoc.toObject());
  return res.json(requestDoc);
});

app.post("/teams/:id/invites", authMiddleware, async (req: AuthRequest, res) => {
  const { toUserId, message } = req.body as { toUserId?: string; message?: string };
  if (!toUserId) {
    return res.status(400).json({ message: "toUserId is required" });
  }

  const team = await TeamModel.findById(req.params.id);
  if (!team) {
    return res.status(404).json({ message: "team not found" });
  }

  if (team.createdBy.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only team creator can send invites" });
  }

  if (team.members.some((memberId) => memberId.toString() === toUserId)) {
    return res.status(409).json({ message: "user is already in this team" });
  }

  if (toUserId === req.authUserId) {
    return res.status(409).json({ message: "cannot invite yourself" });
  }

  const targetUser = await UserModel.findById(toUserId).lean();
  if (!targetUser) {
    return res.status(404).json({ message: "target user not found" });
  }

  const targetAlreadyInHackathonTeam = await hasTeamInSameHackathon(toUserId, team.hackathon, team._id.toString());
  if (targetAlreadyInHackathonTeam) {
    return res.status(409).json({ message: "target user is already in another team for this hackathon" });
  }

  if (team.members.length >= getTeamCapacity(team)) {
    return res.status(409).json({ message: "team is full" });
  }

  const existingPending = await TeamInviteModel.findOne({
    teamId: team._id,
    toUserId,
    status: "pending"
  }).lean();
  if (existingPending) {
    return res.status(409).json({ message: "pending invite already exists for this user" });
  }

  const invite = await TeamInviteModel.create({
    teamId: team._id,
    fromUserId: req.authUserId,
    toUserId,
    status: "pending",
    message: (message ?? "").trim().slice(0, 300)
  });

  io.emit("team.invite.created", invite.toObject());
  return res.status(201).json(invite);
});

app.get("/users/:id/incoming-team-invites", authMiddleware, async (req: AuthRequest, res) => {
  if (req.authUserId !== req.params.id) {
    return res.status(403).json({ message: "you can only view your own incoming invites" });
  }

  const invites = await TeamInviteModel.find({ toUserId: req.params.id }).sort({ createdAt: -1 }).limit(100).lean();
  if (!invites.length) {
    return res.json([]);
  }

  const teamIds = Array.from(new Set(invites.map((invite) => invite.teamId.toString())));
  const inviterIds = Array.from(new Set(invites.map((invite) => invite.fromUserId.toString())));

  const teams = await TeamModel.find({ _id: { $in: teamIds } }).select("name").lean();
  const inviters = await UserModel.find({ _id: { $in: inviterIds } }).select("name").lean();

  const teamMap = new Map(teams.map((team) => [team._id.toString(), team.name]));
  const inviterMap = new Map(inviters.map((user) => [user._id.toString(), user.name]));

  const incoming = invites.map((invite) => ({
    inviteId: invite._id,
    teamId: invite.teamId,
    teamName: teamMap.get(invite.teamId.toString()) ?? "Team",
    fromUserId: invite.fromUserId,
    fromUserName: inviterMap.get(invite.fromUserId.toString()) ?? "Unknown user",
    status: invite.status,
    message: invite.message,
    responseMessage: invite.responseMessage,
    createdAt: invite.createdAt
  }));

  return res.json(incoming);
});

app.patch("/team-invites/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { status, responseMessage } = req.body as { status?: "accepted" | "declined"; responseMessage?: string };
  if (!status || !["accepted", "declined"].includes(status)) {
    return res.status(400).json({ message: "status must be accepted or declined" });
  }

  const invite = await TeamInviteModel.findById(req.params.id);
  if (!invite) {
    return res.status(404).json({ message: "invite not found" });
  }

  if (invite.toUserId.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only invited user can respond" });
  }

  if (invite.status !== "pending") {
    return res.status(409).json({ message: "invite already resolved" });
  }

  const team = await TeamModel.findById(invite.teamId);
  if (!team) {
    return res.status(404).json({ message: "team not found" });
  }

  if (status === "accepted") {
    const invitedUserAlreadyInHackathonTeam = await hasTeamInSameHackathon(invite.toUserId.toString(), team.hackathon, team._id.toString());
    if (invitedUserAlreadyInHackathonTeam) {
      return res.status(409).json({ message: "you are already in another team for this hackathon" });
    }

    const teamCapacity = getTeamCapacity(team);

    const teamUpdate = await TeamModel.findOneAndUpdate(
      {
        _id: team._id,
        status: "open",
        members: { $ne: invite.toUserId },
        $expr: { $lt: [{ $size: "$members" }, teamCapacity] }
      },
      {
        $addToSet: { members: invite.toUserId }
      },
      { new: true }
    );

    if (!teamUpdate) {
      return res.status(409).json({ message: "team is full or no longer open" });
    }

    if (teamUpdate.members.length >= getTeamCapacity(teamUpdate)) {
      teamUpdate.status = "closed";
      await teamUpdate.save();
    }

    io.emit("team.member.added", { teamId: teamUpdate._id, userId: invite.toUserId, members: teamUpdate.members });
  }

  invite.status = status;
  invite.responseMessage = status === "declined" ? (responseMessage ?? "").trim().slice(0, 300) : "";
  await invite.save();

  io.emit("team.invite.updated", invite.toObject());
  return res.json(invite);
});

app.post("/friend-requests", authMiddleware, async (req: AuthRequest, res) => {
  const { toUserId, message } = req.body as { toUserId?: string; message?: string };
  if (!toUserId) {
    return res.status(400).json({ message: "toUserId is required" });
  }

  if (toUserId === req.authUserId) {
    return res.status(409).json({ message: "cannot send a friend request to yourself" });
  }

  const targetUser = await UserModel.findById(toUserId).lean();
  if (!targetUser) {
    return res.status(404).json({ message: "target user not found" });
  }

  const existingFriendship = await FriendshipModel.findOne({
    $or: [
      getFriendPairIds(req.authUserId ?? "", toUserId),
      getFriendPairIds(toUserId, req.authUserId ?? "")
    ]
  }).lean();
  if (existingFriendship) {
    return res.status(409).json({ message: "you are already friends" });
  }

  const existingPending = await FriendRequestModel.findOne({ fromUserId: req.authUserId, toUserId, status: "pending" }).lean();
  if (existingPending) {
    return res.status(409).json({ message: "pending friend request already exists" });
  }

  const reversePending = await FriendRequestModel.findOne({ fromUserId: toUserId, toUserId: req.authUserId, status: "pending" }).lean();
  if (reversePending) {
    return res.status(409).json({ message: "this user already sent you a friend request" });
  }

  const requestDoc = await FriendRequestModel.create({
    fromUserId: req.authUserId,
    toUserId,
    status: "pending",
    message: (message ?? "").trim().slice(0, 300)
  });

  io.emit("friend.request.created", requestDoc.toObject());
  return res.status(201).json(requestDoc);
});

app.get("/users/:id/incoming-friend-requests", authMiddleware, async (req: AuthRequest, res) => {
  if (req.authUserId !== req.params.id) {
    return res.status(403).json({ message: "you can only view your own incoming requests" });
  }

  const requests = await FriendRequestModel.find({ toUserId: req.params.id }).sort({ createdAt: -1 }).limit(100).lean();
  if (!requests.length) {
    return res.json([]);
  }

  const requesterIds = Array.from(new Set(requests.map((requestItem) => requestItem.fromUserId.toString())));
  const requesters = await UserModel.find({ _id: { $in: requesterIds } })
    .select("name email rankScore preferredRoles experienceLevel skills githubUrl linkedinUrl")
    .lean();
  const requesterMap = new Map(requesters.map((user) => [user._id.toString(), buildFriendProfile(user)]));

  return res.json(
    requests.map((requestItem) => ({
      requestId: requestItem._id,
      fromUserId: requestItem.fromUserId,
      fromUser: requesterMap.get(requestItem.fromUserId.toString()) ?? null,
      message: requestItem.message,
      status: requestItem.status,
      createdAt: requestItem.createdAt
    }))
  );
});

app.get("/users/:id/sent-friend-requests", authMiddleware, async (req: AuthRequest, res) => {
  if (req.authUserId !== req.params.id) {
    return res.status(403).json({ message: "you can only view your own sent requests" });
  }

  const requests = await FriendRequestModel.find({ fromUserId: req.params.id }).sort({ createdAt: -1 }).limit(100).lean();
  if (!requests.length) {
    return res.json([]);
  }

  const targetIds = Array.from(new Set(requests.map((requestItem) => requestItem.toUserId.toString())));
  const targets = await UserModel.find({ _id: { $in: targetIds } })
    .select("name email rankScore preferredRoles experienceLevel skills githubUrl linkedinUrl")
    .lean();
  const targetMap = new Map(targets.map((user) => [user._id.toString(), buildFriendProfile(user)]));

  return res.json(
    requests.map((requestItem) => ({
      requestId: requestItem._id,
      toUserId: requestItem.toUserId,
      toUser: targetMap.get(requestItem.toUserId.toString()) ?? null,
      message: requestItem.message,
      status: requestItem.status,
      createdAt: requestItem.createdAt
    }))
  );
});

app.get("/users/:id/friends", authMiddleware, async (req: AuthRequest, res) => {
  if (req.authUserId !== req.params.id) {
    return res.status(403).json({ message: "you can only view your own friends" });
  }

  const friendships = await FriendshipModel.find({
    $or: [{ userAId: req.params.id }, { userBId: req.params.id }]
  }).sort({ createdAt: -1 }).lean();

  if (!friendships.length) {
    return res.json([]);
  }

  const friendIds = friendships.map((friendship) =>
    friendship.userAId.toString() === req.params.id ? friendship.userBId.toString() : friendship.userAId.toString()
  );
  const friends = await UserModel.find({ _id: { $in: friendIds } })
    .select("name email rankScore preferredRoles experienceLevel skills githubUrl linkedinUrl")
    .lean();
  const friendMap = new Map(friends.map((user) => [user._id.toString(), buildFriendProfile(user)]));

  return res.json(
    friendships
      .map((friendship) => {
        const friendId = friendship.userAId.toString() === req.params.id ? friendship.userBId.toString() : friendship.userAId.toString();
        return {
          friendshipId: friendship._id,
          friend: friendMap.get(friendId) ?? null,
          createdAt: friendship.createdAt
        };
      })
      .filter((item) => item.friend)
  );
});

app.patch("/friend-requests/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { status } = req.body as { status?: "accepted" | "declined" };
  if (!status || !["accepted", "declined"].includes(status)) {
    return res.status(400).json({ message: "status must be accepted or declined" });
  }

  const requestDoc = await FriendRequestModel.findById(req.params.id);
  if (!requestDoc) {
    return res.status(404).json({ message: "friend request not found" });
  }

  if (requestDoc.toUserId.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only invited user can respond" });
  }

  if (requestDoc.status !== "pending") {
    return res.status(409).json({ message: "friend request already resolved" });
  }

  if (status === "accepted") {
    const pair = getFriendPairIds(requestDoc.fromUserId.toString(), requestDoc.toUserId.toString());
    const existingFriendship = await FriendshipModel.findOne(pair).lean();
    if (!existingFriendship) {
      await FriendshipModel.create(pair);
    }
  }

  requestDoc.status = status;
  await requestDoc.save();

  io.emit("friend.request.updated", requestDoc.toObject());
  if (status === "accepted") {
    io.emit("friendship.created", {
      userAId: requestDoc.fromUserId,
      userBId: requestDoc.toUserId
    });
  }

  return res.json(requestDoc);
});

app.post("/skill-swaps", authMiddleware, async (req: AuthRequest, res) => {
  const { canTeach, wantsToLearn } = req.body as { canTeach?: string[]; wantsToLearn?: string[] };
  if (!canTeach?.length || !wantsToLearn?.length) {
    return res.status(400).json({ message: "canTeach and wantsToLearn are required" });
  }

  const swap = await SkillSwapModel.create({
    createdBy: req.authUserId,
    canTeach,
    wantsToLearn,
    status: "open"
  });

  io.emit("skill.swap.created", swap.toObject());

  return res.status(201).json(swap);
});

app.get("/skill-swaps/open", authMiddleware, async (_req, res) => {
  const swaps = await SkillSwapModel.find({ status: { $in: ["open", "matched"] } }).sort({ createdAt: -1 }).limit(100).lean();
  return res.json(swaps);
});

app.get("/skill-swaps/:id/requests", authMiddleware, async (req: AuthRequest, res) => {
  const swap = await SkillSwapModel.findById(req.params.id).lean();
  if (!swap) {
    return res.status(404).json({ message: "skill swap not found" });
  }

  const requests = await SkillSwapRequestModel.find({ swapId: req.params.id }).sort({ createdAt: -1 }).lean();
  const isOwner = swap.createdBy.toString() === req.authUserId;
  const isRequester = requests.some((request) => request.requesterId.toString() === req.authUserId);

  if (!isOwner && !isRequester) {
    return res.status(403).json({ message: "not allowed to view these requests" });
  }

  return res.json(requests);
});

app.post("/skill-swaps/:id/requests", authMiddleware, async (req: AuthRequest, res) => {
  const { message } = req.body as { message?: string };
  const swap = await SkillSwapModel.findById(req.params.id);
  if (!swap) {
    return res.status(404).json({ message: "skill swap not found" });
  }

  if (swap.createdBy.toString() === req.authUserId) {
    return res.status(409).json({ message: "you cannot request your own skill swap" });
  }

  if (swap.status !== "open") {
    return res.status(409).json({ message: "skill swap is no longer open" });
  }

  const requestDoc = await SkillSwapRequestModel.create({
    swapId: swap._id,
    ownerId: swap.createdBy,
    requesterId: req.authUserId,
    message: (message ?? "").trim().slice(0, 500),
    status: "pending"
  });

  io.emit("skill.swap.request.created", requestDoc.toObject());
  return res.status(201).json(requestDoc);
});

app.patch("/skill-swap-requests/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { status } = req.body as { status?: "accepted" | "declined" };
  if (!status || !["accepted", "declined"].includes(status)) {
    return res.status(400).json({ message: "status must be accepted or declined" });
  }

  const requestDoc = await SkillSwapRequestModel.findById(req.params.id);
  if (!requestDoc) {
    return res.status(404).json({ message: "skill swap request not found" });
  }

  if (requestDoc.ownerId.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only swap owner can update request status" });
  }

  const swap = await SkillSwapModel.findById(requestDoc.swapId);
  if (!swap) {
    return res.status(404).json({ message: "skill swap not found" });
  }

  requestDoc.status = status;
  if (status === "accepted") {
    requestDoc.chatRoomId = `skill-swap-room-${requestDoc._id.toString()}`;
    swap.status = "matched";
    swap.matchedWith = requestDoc.requesterId;
    swap.acceptedRequestId = requestDoc._id;
  }

  await Promise.all([requestDoc.save(), swap.save()]);
  io.emit("skill.swap.request.updated", requestDoc.toObject());
  return res.json(requestDoc);
});

app.post("/tasks", authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, budget } = req.body as { title?: string; description?: string; budget?: number };
  if (!title || !description || budget === undefined) {
    return res.status(400).json({ message: "title, description, budget are required" });
  }

  const task = await TaskModel.create({
    createdBy: req.authUserId,
    title,
    description,
    budget
  });

  io.emit("task.created", task.toObject());
  return res.status(201).json(task);
});

app.get("/tasks/open", authMiddleware, async (_req, res) => {
  const tasks = await TaskModel.find({ status: { $in: ["open", "assigned", "submitted"] } }).sort({ createdAt: -1 }).lean();
  return res.json(tasks);
});

app.post("/tasks/:id/proposals", authMiddleware, async (req: AuthRequest, res) => {
  const task = await TaskModel.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "task not found" });
  }

  if (task.status !== "open") {
    return res.status(409).json({ message: "task is not open for proposals" });
  }

  const { price, reasoning, portfolioUrl, resumeUrl } = req.body as {
    price?: number;
    reasoning?: string;
    portfolioUrl?: string;
    resumeUrl?: string;
  };
  if (price === undefined || !reasoning) {
    return res.status(400).json({ message: "price and reasoning are required" });
  }

  const proposal = await TaskProposalModel.create({
    taskId: task._id,
    developerId: req.authUserId,
    price,
    reasoning,
    portfolioUrl: (portfolioUrl ?? "").trim().slice(0, 300),
    resumeUrl: (resumeUrl ?? "").trim().slice(0, 300)
  });

  io.emit("task.proposal.created", proposal.toObject());
  return res.status(201).json(proposal);
});

app.get("/tasks/:id/proposals", authMiddleware, async (req: AuthRequest, res) => {
  const task = await TaskModel.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "task not found" });
  }

  const proposals = await TaskProposalModel.find({ taskId: req.params.id }).sort({ createdAt: -1 }).lean();
  return res.json(proposals);
});

app.patch("/tasks/proposals/:id", authMiddleware, async (req: AuthRequest, res) => {
  const { status } = req.body as { status?: "accepted" | "declined" };
  if (!status || !["accepted", "declined"].includes(status)) {
    return res.status(400).json({ message: "status must be accepted or declined" });
  }

  const proposal = await TaskProposalModel.findById(req.params.id);
  if (!proposal) {
    return res.status(404).json({ message: "proposal not found" });
  }

  const task = await TaskModel.findById(proposal.taskId);
  if (!task) {
    return res.status(404).json({ message: "task not found" });
  }

  if (task.createdBy.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only task owner can update proposal status" });
  }

  proposal.status = status;
  await proposal.save();

  if (status === "accepted") {
    task.status = "assigned";
    task.assignedTo = proposal.developerId;
    await task.save();
  }

  io.emit("task.proposal.updated", proposal.toObject());
  return res.json(proposal);
});

app.patch("/tasks/:id/submit", authMiddleware, async (req: AuthRequest, res) => {
  const task = await TaskModel.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "task not found" });
  }

  if (task.assignedTo?.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only assigned developer can submit work" });
  }

  if (task.paymentStatus !== "escrowed") {
    return res.status(409).json({ message: "task payment must be funded before submission" });
  }

  task.status = "submitted";
  await task.save();
  io.emit("task.submitted", task.toObject());
  return res.json(task);
});

app.patch("/tasks/:id/fund-escrow", authMiddleware, async (req: AuthRequest, res) => {
  const task = await TaskModel.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "task not found" });
  }

  if (task.createdBy.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only task owner can fund escrow" });
  }

  if (task.status !== "assigned") {
    return res.status(409).json({ message: "task must be assigned before funding escrow" });
  }

  if (task.paymentStatus !== "unpaid") {
    return res.status(409).json({ message: "task escrow is already funded or released" });
  }

  task.paymentStatus = "escrowed";
  task.escrowAmount = task.budget;
  task.commissionAmount = Number((task.budget * (task.commissionRate / 100)).toFixed(2));
  task.payoutAmount = Number((task.budget - task.commissionAmount).toFixed(2));
  task.escrowFundedAt = new Date();
  await task.save();

  io.emit("task.payment.funded", task.toObject());
  return res.json(task);
});

app.patch("/tasks/:id/extension-request", authMiddleware, async (req: AuthRequest, res) => {
  const { message } = req.body as { message?: string };
  if (!message || !message.trim()) {
    return res.status(400).json({ message: "message is required" });
  }

  const task = await TaskModel.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "task not found" });
  }

  if (task.assignedTo?.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only assigned developer can request extension" });
  }

  if (task.status !== "assigned" && task.status !== "submitted") {
    return res.status(409).json({ message: "task must be assigned or submitted for extension request" });
  }

  task.extensionRequestMessage = message.trim().slice(0, 500);
  task.extensionRequestedAt = new Date();
  await task.save();

  io.emit("task.extension.requested", {
    taskId: task._id,
    assignedTo: task.assignedTo,
    message: task.extensionRequestMessage,
    requestedAt: task.extensionRequestedAt
  });

  return res.json(task);
});

app.patch("/tasks/:id/complete", authMiddleware, async (req: AuthRequest, res) => {
  const { rating } = req.body as { rating?: number };
  const task = await TaskModel.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "task not found" });
  }

  if (task.createdBy.toString() !== req.authUserId) {
    return res.status(403).json({ message: "only task owner can mark complete" });
  }

  if (rating === undefined || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "rating must be between 1 and 5" });
  }

  if (task.paymentStatus !== "escrowed") {
    return res.status(409).json({ message: "task payment must be funded before completion" });
  }

  if (task.status !== "submitted") {
    return res.status(409).json({ message: "task must be submitted before completion" });
  }

  task.status = "completed";
  task.rating = rating;
  task.paymentStatus = "released";
  task.paymentReleasedAt = new Date();
  await task.save();

  if (task.assignedTo) {
    const user = await UserModel.findById(task.assignedTo);
    if (user) {
      const previous = user.ratingSummary ?? 0;
      user.ratingSummary = previous === 0 ? rating : (previous + rating) / 2;
      user.rankScore = rankUser(user);
      await user.save();
    }
  }

  io.emit("task.payment.released", {
    taskId: task._id,
    assignedTo: task.assignedTo,
    payoutAmount: task.payoutAmount ?? task.budget,
    commissionAmount: task.commissionAmount ?? 0,
    rating: task.rating,
    releasedAt: task.paymentReleasedAt
  });
  io.emit("task.completed", task.toObject());
  return res.json(task);
});

app.get("/stranger-devs/token", authMiddleware, (req: AuthRequest, res) => {
  // This token can be used by the frontend to join a random matchmaking room over Socket.io.
  const roomToken = jwt.sign({ userId: req.authUserId, mode: "stranger-devs" }, jwtSecret, { expiresIn: "15m" });
  return res.json({ roomToken });
});

const strangerQueue: Array<{ socketId: string; userId: string; alias: string; anonymous: boolean }> = [];
const socketMeta = new Map<string, { userId: string; roomId?: string }>();
const skillSwapChatHistory = new Map<string, Array<{ fromUserId: string; fromUserName: string; text: string; timestamp: number }>>();
const skillSwapSocketRooms = new Map<string, string>();
const teamChatHistory = new Map<string, Array<{ fromUserId: string; fromUserName: string; text: string; timestamp: number }>>();
const teamSocketRooms = new Map<string, string>();

io.on("connection", (socket) => {
  socket.emit("system.connected", { socketId: socket.id, now: Date.now() });

  socket.on("team.chat.join", async ({ teamId, userId }) => {
    if (typeof teamId !== "string" || typeof userId !== "string") return;

    const team = await TeamModel.findById(teamId).select("_id members").lean();
    if (!team) {
      socket.emit("team.chat.error", { message: "team not found" });
      return;
    }

    const allowed = team.members.some((memberId) => memberId.toString() === userId);
    if (!allowed) {
      socket.emit("team.chat.error", { message: "only team members can join chat" });
      return;
    }

    const roomId = `team-room-${teamId}`;
    socket.join(roomId);
    teamSocketRooms.set(socket.id, roomId);
    socket.emit("team.chat.history", {
      teamId,
      messages: teamChatHistory.get(teamId) ?? []
    });
  });

  socket.on("team.message", async ({ teamId, userId, userName, text }) => {
    if (typeof teamId !== "string" || typeof userId !== "string" || typeof userName !== "string" || typeof text !== "string") return;
    if (!text.trim()) return;

    const team = await TeamModel.findById(teamId).select("_id members").lean();
    if (!team) return;

    const allowed = team.members.some((memberId) => memberId.toString() === userId);
    if (!allowed) return;

    const message = {
      fromUserId: userId,
      fromUserName: userName.trim().slice(0, 50),
      text: text.trim().slice(0, 500),
      timestamp: Date.now()
    };

    const history = teamChatHistory.get(teamId) ?? [];
    history.push(message);
    teamChatHistory.set(teamId, history.slice(-150));

    io.to(`team-room-${teamId}`).emit("team.message", { teamId, ...message });
  });

  socket.on("team.chat.leave", ({ teamId }) => {
    if (typeof teamId !== "string") return;
    const roomId = teamSocketRooms.get(socket.id) || `team-room-${teamId}`;
    socket.leave(roomId);
    teamSocketRooms.delete(socket.id);
  });

  socket.on("skill.swap.chat.join", async ({ requestId, userId }) => {
    if (typeof requestId !== "string" || typeof userId !== "string") return;
    const requestDoc = await SkillSwapRequestModel.findById(requestId).lean();
    if (!requestDoc || requestDoc.status !== "accepted") {
      socket.emit("skill.swap.chat.error", { message: "skill swap chat is not available yet" });
      return;
    }

    const allowed = requestDoc.ownerId.toString() === userId || requestDoc.requesterId.toString() === userId;
    if (!allowed) {
      socket.emit("skill.swap.chat.error", { message: "not allowed to join this chat" });
      return;
    }

    const roomId = requestDoc.chatRoomId || `skill-swap-room-${requestDoc._id.toString()}`;
    socket.join(roomId);
    skillSwapSocketRooms.set(socket.id, roomId);
    socket.emit("skill.swap.chat.history", {
      requestId,
      messages: skillSwapChatHistory.get(requestId) ?? []
    });
  });

  socket.on("skill.swap.message", async ({ requestId, userId, userName, text }) => {
    if (typeof requestId !== "string" || typeof userId !== "string" || typeof userName !== "string" || typeof text !== "string") return;
    const requestDoc = await SkillSwapRequestModel.findById(requestId).lean();
    if (!requestDoc || requestDoc.status !== "accepted") return;

    const allowed = requestDoc.ownerId.toString() === userId || requestDoc.requesterId.toString() === userId;
    if (!allowed) return;

    const roomId = requestDoc.chatRoomId || `skill-swap-room-${requestDoc._id.toString()}`;
    const message = {
      fromUserId: userId,
      fromUserName: userName.trim().slice(0, 50),
      text: text.trim().slice(0, 500),
      timestamp: Date.now()
    };

    const history = skillSwapChatHistory.get(requestId) ?? [];
    history.push(message);
    skillSwapChatHistory.set(requestId, history.slice(-100));
    io.to(roomId).emit("skill.swap.message", { requestId, ...message });
  });

  socket.on("skill.swap.chat.leave", ({ requestId }) => {
    if (typeof requestId !== "string") return;
    const roomId = skillSwapSocketRooms.get(socket.id);
    if (roomId) {
      socket.leave(roomId);
      skillSwapSocketRooms.delete(socket.id);
    }
  });

  socket.on("stranger.queue.join", ({ roomToken, alias, anonymous }) => {
    try {
      const decoded = jwt.verify(roomToken, jwtSecret) as { userId: string; mode: string };
      if (decoded.mode !== "stranger-devs") return;

      const existingIdx = strangerQueue.findIndex((entry) => entry.socketId === socket.id);
      if (existingIdx >= 0) {
        strangerQueue.splice(existingIdx, 1);
      }

      const safeAlias = typeof alias === "string" && alias.trim() ? alias.trim().slice(0, 30) : "Developer";
      const isAnonymous = Boolean(anonymous);
      const entry = { socketId: socket.id, userId: decoded.userId, alias: safeAlias, anonymous: isAnonymous };

      const partner = strangerQueue.shift();
      if (!partner) {
        strangerQueue.push(entry);
        socketMeta.set(socket.id, { userId: decoded.userId });
        io.emit("stranger.queue.size", { size: strangerQueue.length });
        socket.emit("stranger.queue.waiting", { waiting: true });
        return;
      }

      const roomId = `stranger-room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      socket.join(roomId);
      const partnerSocket = io.sockets.sockets.get(partner.socketId);
      partnerSocket?.join(roomId);

      socketMeta.set(socket.id, { userId: decoded.userId, roomId });
      socketMeta.set(partner.socketId, { userId: partner.userId, roomId });

      const userA = entry.anonymous ? "Anonymous" : entry.alias;
      const userB = partner.anonymous ? "Anonymous" : partner.alias;

      io.to(roomId).emit("stranger.matched", {
        roomId,
        users: [userA, userB],
        startedAt: Date.now()
      });

      io.emit("stranger.queue.size", { size: strangerQueue.length });
    } catch {
      socket.emit("stranger.queue.error", { message: "invalid room token" });
    }
  });

  socket.on("stranger.message", ({ text }) => {
    const meta = socketMeta.get(socket.id);
    if (!meta?.roomId || typeof text !== "string" || !text.trim()) return;
    io.to(meta.roomId).emit("stranger.message", {
      fromSocket: socket.id,
      text: text.trim().slice(0, 500),
      timestamp: Date.now()
    });
  });

  socket.on("stranger.queue.leave", () => {
    const idx = strangerQueue.findIndex((entry) => entry.socketId === socket.id);
    if (idx >= 0) {
      strangerQueue.splice(idx, 1);
      io.emit("stranger.queue.size", { size: strangerQueue.length });
    }
  });

  socket.on("disconnect", () => {
    const idx = strangerQueue.findIndex((entry) => entry.socketId === socket.id);
    if (idx >= 0) {
      strangerQueue.splice(idx, 1);
      io.emit("stranger.queue.size", { size: strangerQueue.length });
    }

    const meta = socketMeta.get(socket.id);
    if (meta?.roomId) {
      socket.to(meta.roomId).emit("stranger.partner.left", { roomId: meta.roomId });
    }
    socketMeta.delete(socket.id);
    skillSwapSocketRooms.delete(socket.id);
    teamSocketRooms.delete(socket.id);
  });
});

const start = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(mongoUri);
  await seedDemoData();

  void runGithubAutoSync();
  const syncTimer = setInterval(() => {
    void runGithubAutoSync();
  }, githubSyncIntervalMs);
  syncTimer.unref();

  const port = Number(process.env.PORT ?? 4000);
  server.listen(port, () => {
    console.log(`DevMatch backend running on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
