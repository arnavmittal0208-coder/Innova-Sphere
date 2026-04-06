import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

type User = {
  _id: string;
  name: string;
  email: string;
  rankScore: number;
  ratingSummary?: number;
  skillSwapScore?: number;
  githubMetrics?: {
    commits?: number;
    pullRequests?: number;
    repos?: number;
    consistency?: number;
  };
  profileCompleted?: boolean;
  preferredRoles?: string[];
  interests?: string[];
  hackathonHistory?: string[];
  skills?: {
    tech?: string[];
    soft?: string[];
    domains?: string[];
  };
  githubUrl?: string;
  linkedinUrl?: string;
  experienceLevel?: string;
};

type Team = {
  _id: string;
  name: string;
  description: string;
  hackathon: string;
  createdBy?: string;
  members: string[];
  maxMembers?: number;
  status: "open" | "closed";
};

type TeamMemberDetail = {
  _id: string;
  name: string;
  email: string;
  preferredRole?: string;
  experienceLevel?: string;
  coreLanguage?: string;
  rankScore: number;
  githubUrl?: string;
  linkedinUrl?: string;
};

type TeamDetail = {
  _id: string;
  name: string;
  description: string;
  hackathon: string;
  createdBy: string;
  status: "open" | "closed";
  maxMembers?: number;
  members: TeamMemberDetail[];
};

type Suggestion = {
  userId: string;
  name: string;
  rankScore: number;
  coreLanguage?: string;
  preferredRole?: string;
  experienceLevel?: string;
  topTechSkills?: string[];
  githubUrl?: string;
  linkedinUrl?: string;
  matchPercent: number;
};

type SideCardData = {
  side: "left" | "right";
  title: string;
  personName: string;
  subtitle: string;
  note: string;
  chips: string[];
};

const SAMPLE_SUGGESTIONS: Suggestion[] = [
  {
    userId: "sample-01",
    name: "Aanya Verma",
    rankScore: 84,
    coreLanguage: "TypeScript",
    preferredRole: "Frontend Developer",
    experienceLevel: "advanced",
    topTechSkills: ["React", "Tailwind", "Framer Motion"],
    githubUrl: "https://github.com/",
    linkedinUrl: "https://linkedin.com/",
    matchPercent: 94
  },
  {
    userId: "sample-02",
    name: "Rahul Mehta",
    rankScore: 79,
    coreLanguage: "Node.js",
    preferredRole: "Backend Developer",
    experienceLevel: "intermediate",
    topTechSkills: ["Express", "MongoDB", "Sockets"],
    githubUrl: "https://github.com/",
    linkedinUrl: "https://linkedin.com/",
    matchPercent: 89
  },
  {
    userId: "sample-03",
    name: "Sara Khan",
    rankScore: 76,
    coreLanguage: "Figma",
    preferredRole: "UI/UX Designer",
    experienceLevel: "advanced",
    topTechSkills: ["UI Systems", "Prototyping", "Design Ops"],
    githubUrl: "https://github.com/",
    linkedinUrl: "https://linkedin.com/",
    matchPercent: 86
  }
];

const SIDE_CARDS: SideCardData[] = [
  {
    side: "left",
    title: "Requests Received",
    personName: "Priyansh Raj",
    subtitle: "Backend Developer • Rank 82",
    note: "Hey, your profile looks solid for our fintech build sprint this weekend.",
    chips: ["Pending", "Node.js", "MongoDB"]
  },
  {
    side: "right",
    title: "Your Friends",
    personName: "Nisha Kapoor",
    subtitle: "Product Designer • Rank 88",
    note: "Last active 2h ago. Open to AI + UX hackathon collabs.",
    chips: ["Online", "Figma", "UI Systems"]
  }
];

type RankedOpenTeam = {
  teamId: string;
  teamName: string;
  hackathon: string;
  requiredRoles: string[];
  matchPercent: number;
};

type JoinRequest = {
  _id: string;
  teamId: string;
  userId: string;
  matchPercent: number;
  status: "pending" | "accepted" | "declined";
};

type IncomingJoinRequest = {
  requestId: string;
  teamId: string;
  teamName: string;
  fromUserId: string;
  fromUserName: string;
  matchPercent: number;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
};

type SentJoinRequest = {
  requestId: string;
  teamId: string;
  teamName: string;
  creatorName: string;
  matchPercent: number;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
};

type IncomingTeamInvite = {
  inviteId: string;
  teamId: string;
  teamName: string;
  fromUserId: string;
  fromUserName: string;
  status: "pending" | "accepted" | "declined";
  message?: string;
  responseMessage?: string;
  createdAt: string;
};

type SkillSwap = {
  _id: string;
  createdBy: string;
  canTeach: string[];
  wantsToLearn: string[];
  status: "open" | "matched" | "closed";
  matchedWith?: string;
  acceptedRequestId?: string;
};

type SkillSwapRequest = {
  _id: string;
  swapId: string;
  ownerId: string;
  requesterId: string;
  message?: string;
  status: "pending" | "accepted" | "declined";
  chatRoomId?: string;
  createdAt: string;
};

type Task = {
  _id: string;
  title: string;
  description: string;
  budget: number;
  status: "open" | "assigned" | "submitted" | "completed";
  assignedTo?: string;
  createdBy: string;
  paymentStatus?: "unpaid" | "escrowed" | "released";
  escrowAmount?: number;
  commissionRate?: number;
  commissionAmount?: number;
  payoutAmount?: number;
  escrowFundedAt?: string;
  paymentReleasedAt?: string;
  extensionRequestMessage?: string;
  extensionRequestedAt?: string;
};

type Proposal = {
  _id: string;
  taskId: string;
  developerId: string;
  price: number;
  reasoning: string;
  portfolioUrl?: string;
  resumeUrl?: string;
  status: "pending" | "accepted" | "declined";
};

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

type HackathonFeedSource = "devpost" | "fallback" | "mixed" | "unknown";

type StrangerMessage = {
  fromSocket: string;
  text: string;
  timestamp: number;
};

type PageKey = "dashboard" | "hackathons" | "skillswap" | "stranger" | "marketplace" | "ranking" | "profile";
type AuthTab = "login" | "signup";
type NotifType = "success" | "error";

type NotifState = {
  message: string;
  type: NotifType;
} | null;

const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const api = import.meta.env.VITE_API_URL?.trim() || (isLocalDev ? "http://localhost:4000" : "https://innova-sphere.onrender.com");
const SKILL_OPTIONS = [
  "JavaScript",
  "Python",
  "Java",
  "C++",
  "React",
  "Node.js",
  "MongoDB",
  "ML/AI",
  "Flutter",
  "UI Design",
  "Figma",
  "AWS"
];

const ROLE_OPTIONS = [
  "Backend Developer",
  "Frontend Developer",
  "Full Stack Developer",
  "UI/UX Designer",
  "ML/AI Engineer",
  "Mobile Developer",
  "DevOps Engineer",
  "Product Manager",
  "Pitcher/Presenter"
];

const TEAM_ROLE_OPTIONS = [
  "Backend Dev",
  "Frontend Dev",
  "UI/UX Designer",
  "ML Engineer",
  "Pitcher",
  "Mobile Dev",
  "Full Stack"
];

const ROLE_SKILL_HINTS: Record<string, string[]> = {
  "backend dev": ["node", "express", "mongodb", "api", "python", "java"],
  "frontend dev": ["react", "javascript", "typescript", "css", "ui"],
  "ui/ux designer": ["figma", "ui design", "ux", "prototyping"],
  "ml engineer": ["python", "ml/ai", "pytorch", "tensorflow"],
  pitcher: ["pitching", "presentation", "storytelling"],
  "mobile dev": ["flutter", "react native", "android", "ios"],
  "full stack": ["react", "node", "mongodb", "api"]
};

const STORAGE_KEYS = {
  token: "devmatch_token",
  user: "devmatch_user",
  page: "devmatch_page"
} as const;

const VALID_PAGES: PageKey[] = ["dashboard", "hackathons", "skillswap", "stranger", "marketplace", "ranking", "profile"];

const readStoredPage = (): PageKey => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.page);
    if (raw && VALID_PAGES.includes(raw as PageKey)) {
      return raw as PageKey;
    }
  } catch {
    // ignore storage failures
  }
  return "dashboard";
};

const COLORS = ["#7c6af7", "#14b8a6", "#f59e0b", "#f43f5e", "#06b6d4", "#8b5cf6", "#10b981", "#ec4899"];

const hashColor = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};

const initials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "");
};

const shortId = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;

const readStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

const readStoredToken = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEYS.token) ?? "";
  } catch {
    return "";
  }
};

export function App() {
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [page, setPage] = useState<PageKey>(() => readStoredPage());
  const [hackathonsView, setHackathonsView] = useState<"feed" | "teams">("feed");
  const [isBusy, setIsBusy] = useState(false);

  const [jwtToken, setJwtToken] = useState(() => readStoredToken());
  const [currentUser, setCurrentUser] = useState<User | null>(() => readStoredUser());
  const [error, setError] = useState("");
  const [notif, setNotif] = useState<NotifState>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("Dev User");
  const [signupEmail, setSignupEmail] = useState("new@devmatch.io");
  const [signupPassword, setSignupPassword] = useState("123456");
  const [signupCollege, setSignupCollege] = useState("IIT Delhi");
  const [signupYear, setSignupYear] = useState("3rd Year");
  const [signupRole, setSignupRole] = useState("Full Stack Developer");
  const [signupSkills, setSignupSkills] = useState<string[]>(["JavaScript", "React"]);
  const [signupGithub, setSignupGithub] = useState("");
  const [signupLinkedin, setSignupLinkedin] = useState("");
  const [signupExperience, setSignupExperience] = useState("1-2 hackathons");
  const [signupBio, setSignupBio] = useState("");

  const [teamName, setTeamName] = useState("BuildMasters");
  const [teamDescription, setTeamDescription] = useState("A real-time hackathon team");
  const [teamHackathon, setTeamHackathon] = useState("HackIndia 2025");
  const [teamRoles, setTeamRoles] = useState<string[]>(["Backend Dev", "Frontend Dev"]);
  const [teamRoleInput, setTeamRoleInput] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<TeamDetail | null>(null);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [teamChatMessages, setTeamChatMessages] = useState<Array<{ fromUserId: string; fromUserName: string; text: string; timestamp: number }>>([]);
  const [teamChatInput, setTeamChatInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [deckStart, setDeckStart] = useState(0);
  const [deckAnimating, setDeckAnimating] = useState<"left" | "right" | null>(null);
  const [deckDragX, setDeckDragX] = useState(0);
  const deckDragStartX = useRef<number | null>(null);
  const [activeSideCard, setActiveSideCard] = useState<"left" | "right" | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [incomingJoinRequests, setIncomingJoinRequests] = useState<IncomingJoinRequest[]>([]);
  const [sentJoinRequests, setSentJoinRequests] = useState<SentJoinRequest[]>([]);
  const [incomingTeamInvites, setIncomingTeamInvites] = useState<IncomingTeamInvite[]>([]);
  const [rankedOpenTeams, setRankedOpenTeams] = useState<RankedOpenTeam[]>([]);
  const [liveHackathons, setLiveHackathons] = useState<HackathonFeedItem[]>([]);
  const [hackathonSource, setHackathonSource] = useState<HackathonFeedSource>("unknown");

  const [swaps, setSwaps] = useState<SkillSwap[]>([]);
  const [selectedSkillSwap, setSelectedSkillSwap] = useState<SkillSwap | null>(null);
  const [skillSwapCreator, setSkillSwapCreator] = useState<User | null>(null);
  const [skillSwapCreators, setSkillSwapCreators] = useState<Record<string, User>>({}); // Cache all swap creator profiles
  const [selectedSkillSwapRequests, setSelectedSkillSwapRequests] = useState<SkillSwapRequest[]>([]);
  const [skillSwapRequesters, setSkillSwapRequesters] = useState<Record<string, User>>({});
  const [skillSwapRequestMessage, setSkillSwapRequestMessage] = useState("");
  const [selectedSkillSwapRequestId, setSelectedSkillSwapRequestId] = useState("");
  const [skillSwapChatMessages, setSkillSwapChatMessages] = useState<Array<{ fromUserId: string; fromUserName: string; text: string; timestamp: number }>>([]);
  const [skillSwapChatInput, setSkillSwapChatInput] = useState("");
  const [teachInput, setTeachInput] = useState("coding");
  const [learnInput, setLearnInput] = useState("ui design");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [taskTitle, setTaskTitle] = useState("Build portfolio website");
  const [taskDescription, setTaskDescription] = useState("Need landing page + contact form");
  const [taskBudget, setTaskBudget] = useState("500");
  const [proposalPrice, setProposalPrice] = useState("450");
  const [proposalReasoning, setProposalReasoning] = useState("I can deliver in 24 hours");
  const [proposalPortfolioUrl, setProposalPortfolioUrl] = useState("");
  const [proposalResumeUrl, setProposalResumeUrl] = useState("");
  const [extensionMessage, setExtensionMessage] = useState("");
  const [completionRating, setCompletionRating] = useState("5");

  const [events, setEvents] = useState<string[]>([]);
  const [taskCreatorDetails, setTaskCreatorDetails] = useState<User | null>(null);
  const [showTaskCreatorDetails, setShowTaskCreatorDetails] = useState(false);
  const [assignedDeveloperDetails, setAssignedDeveloperDetails] = useState<User | null>(null);
  const [showAssignedDeveloperDetails, setShowAssignedDeveloperDetails] = useState(false);
  const [proposalDeveloperDetails, setProposalDeveloperDetails] = useState<Record<string, User>>({});
  const [taskMessages, setTaskMessages] = useState<Array<{ sender: string; senderName: string; message: string; timestamp: string }>>([]);
  const [taskMessageInput, setTaskMessageInput] = useState("");

  const [strangerAlias, setStrangerAlias] = useState("DevBuddy");
  const [strangerAnonymous, setStrangerAnonymous] = useState(false);
  const [strangerToken, setStrangerToken] = useState("");
  const [strangerQueueSize, setStrangerQueueSize] = useState(0);
  const [strangerRoom, setStrangerRoom] = useState("");
  const [strangerUsers, setStrangerUsers] = useState<string[]>([]);
  const [strangerMessages, setStrangerMessages] = useState<StrangerMessage[]>([]);
  const [strangerInput, setStrangerInput] = useState("");
  const [strangerWaiting, setStrangerWaiting] = useState(false);

  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const openedTeamSectionRef = useRef<HTMLDivElement | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");
  const [editTeamMaxMembers, setEditTeamMaxMembers] = useState("5");
  const [showTeamDetailsEditor, setShowTeamDetailsEditor] = useState(true);

  const openHackathonsTab = () => {
    if (page === "hackathons" && hackathonsView === "teams") {
      setHackathonsView("feed");
      return;
    }
    setPage("hackathons");
    // Refresh teams to ensure myTeams is up to date
    void loadOpenTeams();
  };

  const openTeamsView = () => {
    setPage("hackathons");
    setHackathonsView("teams");
  };

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editExperience, setEditExperience] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [editGithub, setEditGithub] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");
  const [editSkillCsv, setEditSkillCsv] = useState("");
  const [editInterestsCsv, setEditInterestsCsv] = useState("");
  const [editHackathonCsv, setEditHackathonCsv] = useState("");

  const socket = useMemo(() => io(api), []);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: jwtToken ? `Bearer ${jwtToken}` : ""
    }),
    [jwtToken]
  );

  const myRank = useMemo(() => {
    if (!currentUser) return 0;
    const ids = new Map<string, number>();
    ids.set(currentUser._id, currentUser.rankScore);
    suggestions.forEach((s) => {
      const prev = ids.get(s.userId) ?? 0;
      ids.set(s.userId, Math.max(prev, s.rankScore));
    });
    const sorted = Array.from(ids.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.findIndex(([id]) => id === currentUser._id) + 1;
  }, [currentUser, suggestions]);

  const rankingBreakdown = useMemo(() => {
    const githubMetrics = currentUser?.githubMetrics ?? { commits: 0, pullRequests: 0, repos: 0, consistency: 0 };
    const githubRaw = (githubMetrics.commits ?? 0) + (githubMetrics.pullRequests ?? 0) + (githubMetrics.repos ?? 0);
    const githubScore = Math.min(githubRaw / 300, 1) * 0.8 + (currentUser?.githubUrl ? 0.2 : 0);
    const hackathonScore = Math.min((currentUser?.hackathonHistory?.length ?? 0) / 8, 1);
    const taskRatingScore = currentUser?.ratingSummary ? Math.min(currentUser.ratingSummary / 5, 1) : 0.5;
    const skillSwapScore = currentUser?.skillSwapScore ? Math.min(currentUser.skillSwapScore, 1) : 0.5;
    return {
      githubScore: Math.round(githubScore * 100),
      hackathonScore: Math.round(hackathonScore * 100),
      taskRatingScore: Math.round(taskRatingScore * 100),
      skillSwapScore: Math.round(skillSwapScore * 100),
      githubCommits: githubMetrics.commits ?? 0,
      githubPullRequests: githubMetrics.pullRequests ?? 0,
      githubRepos: githubMetrics.repos ?? 0,
      ratingSummary: currentUser?.ratingSummary ?? 0,
      skillSwapRaw: currentUser?.skillSwapScore ?? 0.5
    };
  }, [currentUser]);

  const leaderboard = useMemo(() => {
    const rows: Array<{ id: string; name: string; role: string; points: number; isYou: boolean }> = [];
    if (currentUser) {
      rows.push({
        id: currentUser._id,
        name: currentUser.name,
        role: currentUser.experienceLevel ?? "Developer",
        points: currentUser.rankScore,
        isYou: true
      });
    }

    suggestions.forEach((s) => {
      if (!rows.some((r) => r.id === s.userId)) {
        rows.push({ id: s.userId, name: s.name, role: "Developer", points: s.rankScore, isYou: false });
      }
    });

    if (!rows.length) return [];
    return rows.sort((a, b) => b.points - a.points);
  }, [currentUser, suggestions]);

  const activeDeckSuggestions = suggestions.length ? suggestions : SAMPLE_SUGGESTIONS;

  useEffect(() => {
    if (!activeDeckSuggestions.length) {
      setDeckStart(0);
      setDeckDragX(0);
      setDeckAnimating(null);
      return;
    }

    setDeckStart((prev) => prev % activeDeckSuggestions.length);
  }, [activeDeckSuggestions.length]);

  const deckSuggestions = useMemo(() => {
    if (!activeDeckSuggestions.length) return [];
    return [...activeDeckSuggestions.slice(deckStart), ...activeDeckSuggestions.slice(0, deckStart)];
  }, [activeDeckSuggestions, deckStart]);

  const cycleDeck = (direction: "left" | "right") => {
    if (!activeDeckSuggestions.length || deckAnimating) return;

    setDeckAnimating(direction);
    setTimeout(() => {
      setDeckStart((prev) => (prev + 1) % activeDeckSuggestions.length);
      setDeckAnimating(null);
      setDeckDragX(0);
    }, 260);
  };

  const onDeckPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (deckAnimating) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    deckDragStartX.current = event.clientX;
  };

  const onDeckPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (deckDragStartX.current === null || deckAnimating) return;
    setDeckDragX(event.clientX - deckDragStartX.current);
  };

  const onDeckPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (deckDragStartX.current === null || deckAnimating) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    deckDragStartX.current = null;

    if (Math.abs(deckDragX) > 70) {
      cycleDeck(deckDragX > 0 ? "right" : "left");
      return;
    }

    setDeckDragX(0);
  };

  const pushEvent = (label: string) => setEvents((prev) => [label, ...prev].slice(0, 30));

  const showNotif = (message: string, type: NotifType = "success") => {
    setNotif({ message, type });
  };

  useEffect(() => {
    if (!notif) return;
    const timer = setTimeout(() => setNotif(null), 3000);
    return () => clearTimeout(timer);
  }, [notif]);

  useEffect(() => {
    if (jwtToken) {
      try {
        localStorage.setItem(STORAGE_KEYS.token, jwtToken);
      } catch {
        // ignore storage failures
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.token);
      } catch {
        // ignore storage failures
      }
    }
  }, [jwtToken]);

  useEffect(() => {
    if (currentUser) {
      try {
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(currentUser));
      } catch {
        // ignore storage failures
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.user);
      } catch {
        // ignore storage failures
      }
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.page, page);
    } catch {
      // ignore storage failures
    }
  }, [page]);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    socket.on("team.created", (payload) => pushEvent(`team.created: ${payload.name}`));
    socket.on("team.join.requested", (payload) => pushEvent(`team.join.requested: ${payload._id ?? payload.id}`));
    socket.on("team.join.requested", () => {
      if (currentUser?._id) {
        void Promise.all([loadIncomingJoinRequests(currentUser._id), loadSentJoinRequests(currentUser._id)]);
      }
    });
    socket.on("team.join.request.updated", () => {
      if (currentUser?._id) {
        void Promise.all([loadIncomingJoinRequests(currentUser._id), loadSentJoinRequests(currentUser._id)]);
      }
    });
    socket.on("team.invite.created", () => {
      if (currentUser?._id) void loadIncomingTeamInvites(currentUser._id);
    });
    socket.on("team.invite.updated", () => {
      if (currentUser?._id) void loadIncomingTeamInvites(currentUser._id);
    });
    socket.on("team.member.added", (payload) => pushEvent(`team.member.added: ${payload.userId}`));
    socket.on("team.member.left", (payload) => pushEvent(`team.member.left: ${payload.userId}`));
    socket.on("team.status.updated", () => {
      void loadOpenTeams();
      if (currentUser?._id) void loadRankedOpenTeams(currentUser._id);
    });
    socket.on("user.profile.updated", () => {
      if (currentUser?._id) void loadRankedOpenTeams(currentUser._id);
      if (selectedTeam) void loadSuggestions(selectedTeam);
    });

    socket.on("team.created", () => {
      void loadOpenTeams();
      if (currentUser?._id) void loadRankedOpenTeams(currentUser._id);
    });

    socket.on("team.member.added", () => {
      if (selectedTeam) {
        void loadSuggestions(selectedTeam);
        void loadJoinRequests(selectedTeam);
      }
      if (currentUser?._id) void loadRankedOpenTeams(currentUser._id);
    });

    socket.on("team.member.left", () => {
      void loadOpenTeams();
      if (selectedTeam) {
        void loadSuggestions(selectedTeam);
        void loadJoinRequests(selectedTeam);
      }
      if (currentUser?._id) void loadRankedOpenTeams(currentUser._id);
    });

    socket.on("team.chat.history", ({ teamId, messages }) => {
      if (teamId === selectedTeam) {
        setTeamChatMessages(messages);
      }
    });

    socket.on("team.message", (message) => {
      if (message.teamId === selectedTeam) {
        setTeamChatMessages((prev) => [...prev, message].slice(-150));
      }
    });

    socket.on("team.chat.error", (payload) => {
      if (payload?.message) showNotif(payload.message, "error");
    });

    socket.on("skill.swap.created", () => {
      pushEvent("skill.swap.created");
      void loadSkillSwaps();
    });
    socket.on("skill.swap.matched", () => {
      pushEvent("skill.swap.matched");
      void loadSkillSwaps();
    });
    socket.on("skill.swap.request.created", (payload) => {
      pushEvent(`skill.swap.request.created: ${payload._id}`);
      void loadSkillSwaps();
      if (selectedSkillSwap?._id === payload.swapId) {
        void loadSkillSwapRequests(payload.swapId);
      }
    });
    socket.on("skill.swap.request.updated", (payload) => {
      pushEvent(`skill.swap.request.updated: ${payload._id}`);
      void loadSkillSwaps();
      if (selectedSkillSwap?._id === payload.swapId) {
        void loadSkillSwapRequests(payload.swapId);
      }
    });
    socket.on("skill.swap.chat.history", ({ requestId, messages }) => {
      if (requestId === selectedSkillSwapRequestId) {
        setSkillSwapChatMessages(messages);
      }
    });
    socket.on("skill.swap.message", (message) => {
      if (message.requestId === selectedSkillSwapRequestId) {
        setSkillSwapChatMessages((prev) => [...prev, message].slice(-100));
      }
    });
    socket.on("skill.swap.chat.error", (payload) => {
      if (payload?.message) showNotif(payload.message, "error");
    });

    socket.on("task.created", () => {
      pushEvent("task.created");
      void loadTasks();
    });
    socket.on("task.proposal.created", () => {
      pushEvent("task.proposal.created");
      if (selectedTask) void loadProposals(selectedTask);
    });
    socket.on("task.proposal.updated", () => {
      pushEvent("task.proposal.updated");
      if (selectedTask) void loadProposals(selectedTask);
      void loadTasks();
    });
    socket.on("task.submitted", () => {
      pushEvent("task.submitted");
      void loadTasks();
    });
    socket.on("task.completed", () => {
      pushEvent("task.completed");
      void loadTasks();
    });
    socket.on("task.payment.released", (payload) => {
      pushEvent(`task.payment.released: ${payload.taskId}`);
      void loadTasks();
      if (payload.assignedTo === currentUser?._id) {
        const amount = typeof payload.payoutAmount === "number" ? `$${payload.payoutAmount.toFixed(2)}` : "your payout";
        showNotif(`Payment received: ${amount}`, "success");
      }
    });

    socket.on("stranger.queue.size", ({ size }) => setStrangerQueueSize(size));
    socket.on("stranger.queue.waiting", () => {
      pushEvent("stranger.queue.waiting");
      setStrangerWaiting(true);
    });
    socket.on("stranger.matched", ({ roomId, users }) => {
      setStrangerRoom(roomId);
      setStrangerUsers(users);
      setStrangerMessages([]);
      setStrangerWaiting(false);
      pushEvent(`stranger.matched: ${roomId}`);
      showNotif("Matched with a random developer", "success");
    });
    socket.on("stranger.message", (message) => setStrangerMessages((prev) => [...prev, message].slice(-50)));
    socket.on("stranger.partner.left", () => {
      pushEvent("stranger.partner.left");
      setStrangerRoom("");
      setStrangerUsers([]);
      setStrangerWaiting(false);
      showNotif("Your partner left the room", "error");
    });

    return () => {
      if (selectedTeam) {
        socket.emit("team.chat.leave", { teamId: selectedTeam });
      }
      socket.removeAllListeners();
    };
  }, [socket, selectedTask, selectedTeam, currentUser?._id, selectedSkillSwap?._id, selectedSkillSwapRequestId]);

  useEffect(() => {
    if (!jwtToken) return;
    void withError(async () => {
      await Promise.all([loadMe(), loadOpenTeams(), loadSkillSwaps(), loadTasks(), loadLiveHackathons()]);
      if (currentUser?._id) {
        await Promise.all([
          loadRankedOpenTeams(currentUser._id),
          loadIncomingJoinRequests(currentUser._id),
          loadSentJoinRequests(currentUser._id),
          loadIncomingTeamInvites(currentUser._id)
        ]);
      }
    });
  }, [jwtToken, currentUser?._id]);

  useEffect(() => {
    if (page !== "hackathons" || !selectedTeam) return;
    if (!openedTeamSectionRef.current) return;
    openedTeamSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page, selectedTeam]);

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${api}${path}`, init);
    const data = await response
      .json()
      .catch(() => ({ message: response.ok ? "Request succeeded" : "Request failed" }));
    if (!response.ok) {
      throw new Error(data.message ?? "Request failed");
    }
    return data;
  };

  const withError = async (fn: () => Promise<void>) => {
    setError("");
    setIsBusy(true);
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      showNotif(message, "error");
    } finally {
      setIsBusy(false);
    }
  };

  const loadMe = async (tokenOverride?: string) => {
    const token = tokenOverride ?? jwtToken;
    if (!token) return;
    const me = await request("/auth/me", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    });
    setCurrentUser(me);
    setEditGithub(me.githubUrl ?? "");
    setEditLinkedin(me.linkedinUrl ?? "");
    setEditSkillCsv((me.skills?.tech ?? []).join(", "));
  };

  const doLogin = async () => {
    await withError(async () => {
      const data = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      setJwtToken(data.token);
      setCurrentUser(data.user);
      try {
        localStorage.setItem(STORAGE_KEYS.token, data.token);
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
      } catch {
        // ignore storage failures
      }
      await loadMe(data.token);
      await Promise.all([
        loadRankedOpenTeams(data.user._id),
        loadIncomingJoinRequests(data.user._id),
        loadSentJoinRequests(data.user._id),
        loadIncomingTeamInvites(data.user._id)
      ]);
      setPage("dashboard");
      pushEvent("auth.login.success");
      showNotif("Logged in successfully", "success");
    });
  };

  const doSignup = async () => {
    await withError(async () => {
      const data = await request("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword })
      });

      setJwtToken(data.token);
      setCurrentUser(data.user);
      try {
        localStorage.setItem(STORAGE_KEYS.token, data.token);
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
      } catch {
        // ignore storage failures
      }

      try {
        await request(`/users/${data.user._id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.token}`
          },
          body: JSON.stringify({
            skills: {
              tech: signupSkills.map((s) => s.toLowerCase()),
              soft: ["communication", "teamwork"],
              domains: [signupRole.toLowerCase()]
            },
            preferredRoles: [signupRole.toLowerCase()],
            experienceLevel: "beginner",
            interests: [signupCollege, signupYear],
            hackathonHistory: [signupBio || "new-user"],
            githubUrl: signupGithub,
            linkedinUrl: signupLinkedin,
            githubMetrics: { commits: 0, pullRequests: 0, repos: 0, consistency: 0 }
          })
        });
      } catch (patchError) {
        const message = patchError instanceof Error ? patchError.message : "Profile enrichment failed";
        pushEvent(`profile.patch.failed: ${message}`);
      }

      await loadMe(data.token);
      await Promise.all([
        loadRankedOpenTeams(data.user._id),
        loadIncomingJoinRequests(data.user._id),
        loadSentJoinRequests(data.user._id),
        loadIncomingTeamInvites(data.user._id)
      ]);
      setPage("dashboard");
      pushEvent("auth.signup.success");
      showNotif("Profile created successfully", "success");
    });
  };

  const completeProfile = async () => {
    if (!jwtToken || !currentUser?._id) return;
    await withError(async () => {
      await request(`/users/${currentUser._id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          skills: {
            tech: ["javascript", "react", "node", "mongodb"],
            soft: ["communication", "leadership", "pitching"],
            domains: ["frontend", "backend"]
          },
          preferredRoles: ["backend developer", "frontend developer"],
          experienceLevel: "intermediate",
          interests: ["fintech", "healthcare"],
          hackathonHistory: ["Smart India Hackathon 2025"],
          githubUrl: editGithub || "https://github.com/example",
          linkedinUrl: editLinkedin || "https://linkedin.com/in/example",
          githubMetrics: { commits: 210, pullRequests: 35, repos: 9, consistency: 0.82 }
        })
      });
      await loadMe();
      pushEvent("profile.completed");
      showNotif("Profile completed and synced", "success");
    });
  };

  const saveProfile = async () => {
    if (!jwtToken || !currentUser?._id) return;
    await withError(async () => {
      const toCsvArray = (value: string): string[] =>
        value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);

      const equalStringArrays = (a: string[] = [], b: string[] = []): boolean => {
        if (a.length !== b.length) return false;
        return a.every((item, index) => item === b[index]);
      };

      const trimmedName = editName.trim();
      const trimmedGithub = editGithub.trim();
      const trimmedLinkedin = editLinkedin.trim();
      const trimmedRole = editRole.trim();

      const nextTechSkills = toCsvArray(editSkillCsv).map((v) => v.toLowerCase());
      const nextInterests = toCsvArray(editInterestsCsv);
      const nextHackathonHistory = toCsvArray(editHackathonCsv);

      const currentTechSkills = (currentUser.skills?.tech ?? []).map((v) => v.trim().toLowerCase());
      const currentInterests = (currentUser.interests ?? []).map((v) => v.trim());
      const currentHackathonHistory = (currentUser.hackathonHistory ?? []).map((v) => v.trim());
      const currentPrimaryRole = (currentUser.preferredRoles?.[0] ?? "").trim();

      const payload: Record<string, unknown> = {};

      if (trimmedName && trimmedName !== currentUser.name) {
        payload.name = trimmedName;
      }

      if (trimmedLinkedin !== (currentUser.linkedinUrl ?? "")) {
        payload.linkedinUrl = trimmedLinkedin;
      }

      if (trimmedGithub !== (currentUser.githubUrl ?? "")) {
        payload.githubUrl = trimmedGithub;
      }

      if (editExperience !== (currentUser.experienceLevel ?? "beginner")) {
        payload.experienceLevel = editExperience;
      }

      if (trimmedRole !== currentPrimaryRole) {
        payload.preferredRoles = trimmedRole ? [trimmedRole] : [];
      }

      if (!equalStringArrays(nextInterests, currentInterests)) {
        payload.interests = nextInterests;
      }

      if (!equalStringArrays(nextHackathonHistory, currentHackathonHistory)) {
        payload.hackathonHistory = nextHackathonHistory;
      }

      if (!equalStringArrays(nextTechSkills, currentTechSkills)) {
        payload.skills = {
          tech: nextTechSkills,
          soft: currentUser.skills?.soft ?? [],
          domains: currentUser.skills?.domains ?? []
        };
      }

      if (!Object.keys(payload).length) {
        showNotif("No changes to save", "success");
        setShowProfileModal(false);
        return;
      }

      await request(`/users/${currentUser._id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      await loadMe();
      setShowProfileModal(false);
      showNotif("Profile updated", "success");
    });
  };

  const createTeam = async () => {
    if (!jwtToken) return;
    await withError(async () => {
      if (selectedTeam) {
        leaveTeamChat(selectedTeam);
      }

      const team = await request("/teams", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: teamName,
          description: teamDescription,
          hackathon: teamHackathon.toLowerCase(),
          requiredRoles: teamRoles.map((role) => {
            const key = role.toLowerCase();
            return {
              role: key,
              mustHaveSkills: ROLE_SKILL_HINTS[key] ?? []
            };
          })
        })
      });

      setSelectedTeam(team._id);
      setHackathonsView("teams");
      setShowCreateTeamModal(false);
      await loadOpenTeams();
      if (currentUser?._id) await loadRankedOpenTeams(currentUser._id);
      await loadSuggestions(team._id);
      await loadJoinRequests(team._id);

      const detail = await loadTeamDetail(team._id);
      if (detail?.members.some((member) => member._id === currentUser?._id)) {
        joinTeamChat(team._id);
      }

      showNotif("Team created", "success");
    });
  };

  const loadOpenTeams = async () => {
    if (!jwtToken) return;
    const data = await request("/teams/open", { headers: authHeaders });
    setTeams(data);
  };

  const loadRankedOpenTeams = async (userId: string) => {
    if (!jwtToken) return;
    const data = await request(`/users/${userId}/open-teams`, { headers: authHeaders });
    setRankedOpenTeams(data);
  };

  const loadIncomingJoinRequests = async (userId: string) => {
    if (!jwtToken) return;
    const data = await request(`/users/${userId}/incoming-join-requests`, { headers: authHeaders });
    setIncomingJoinRequests(data);
  };

  const loadSentJoinRequests = async (userId: string) => {
    if (!jwtToken) return;
    const data = await request(`/users/${userId}/sent-join-requests`, { headers: authHeaders });
    setSentJoinRequests(data);
  };

  const loadIncomingTeamInvites = async (userId: string) => {
    if (!jwtToken) return;
    const data = await request(`/users/${userId}/incoming-team-invites`, { headers: authHeaders });
    setIncomingTeamInvites(data);
  };

  const loadLiveHackathons = async () => {
    const data = await request("/hackathons/live?limit=8");
    setLiveHackathons(data.hackathons ?? []);
    setHackathonSource((data.source ?? "unknown") as HackathonFeedSource);
  };

  const loadSuggestions = async (teamId: string) => {
    if (!jwtToken) return;
    const data = await request(`/teams/${teamId}/suggestions`, { headers: authHeaders });
    setSelectedTeam(teamId);
    setSuggestions(data);
  };

  const loadJoinRequests = async (teamId: string) => {
    if (!jwtToken) return;
    const data = await request(`/teams/${teamId}/join-requests`, { headers: authHeaders });
    setJoinRequests(data);
  };

  const loadTeamDetail = async (teamId: string) => {
    if (!jwtToken) return;
    const data = await request(`/teams/${teamId}/details`, { headers: authHeaders });
    setSelectedTeamDetail(data);
    return data as TeamDetail;
  };

  const joinTeamChat = (teamId: string) => {
    if (!currentUser?._id) return;
    setTeamChatMessages([]);
    socket.emit("team.chat.join", { teamId, userId: currentUser._id });
  };

  const leaveTeamChat = (teamId: string) => {
    if (!teamId) return;
    socket.emit("team.chat.leave", { teamId });
  };

  const sendTeamMessage = () => {
    if (!currentUser?._id || !selectedTeam || !teamChatInput.trim()) return;
    const isMember = selectedTeamDetail?.members.some((member) => member._id === currentUser._id);
    if (!isMember) {
      showNotif("Only team members can send messages", "error");
      return;
    }

    socket.emit("team.message", {
      teamId: selectedTeam,
      userId: currentUser._id,
      userName: currentUser.name,
      text: teamChatInput
    });
    setTeamChatInput("");
  };

  const openTeamWorkspace = async (teamId: string) => {
    if (!jwtToken) return;
    await withError(async () => {
      if (selectedTeam && selectedTeam !== teamId) {
        leaveTeamChat(selectedTeam);
      }
      setPage("hackathons");
      setHackathonsView("teams");
      setSelectedTeam(teamId);
      const team = teams.find((item) => item._id === teamId);
      const isTeamOwner = team?.createdBy === currentUser?._id;
      if (isTeamOwner) {
        await loadSuggestions(teamId);
        await loadJoinRequests(teamId);
      } else {
        setSuggestions([]);
        setJoinRequests([]);
      }
      const detail = await loadTeamDetail(teamId);
      setEditTeamName(team?.name ?? "");
      setEditTeamDescription(team?.description ?? "");
      setEditTeamMaxMembers(String(team?.maxMembers ?? 5));
      setShowTeamDetailsEditor(true);
      if (detail?.members.some((member) => member._id === currentUser?._id)) {
        joinTeamChat(teamId);
      }
      showNotif("Team opened", "success");
    });
  };

  const openMyTeam = async (teamId: string) => {
    await openTeamWorkspace(teamId);
  };

  const saveTeamDetails = async () => {
    if (!jwtToken || !selectedTeam || !selectedTeamDetails) return;
    if (selectedTeamDetails.createdBy !== currentUser?._id) {
      showNotif("Only team creator can update details", "error");
      return;
    }

    const nextMaxMembers = Number.parseInt(editTeamMaxMembers, 10);
    if (!Number.isFinite(nextMaxMembers) || nextMaxMembers < 2) {
      showNotif("Team size must be at least 2", "error");
      return;
    }

    await withError(async () => {
      const updatedTeam = await request(`/teams/${selectedTeam}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          name: editTeamName,
          description: editTeamDescription,
          maxMembers: nextMaxMembers
        })
      });
      await loadOpenTeams();
      await loadRankedOpenTeams(currentUser._id);
      await loadSuggestions(selectedTeam);
      await loadTeamDetail(selectedTeam);
      setEditTeamName(updatedTeam.name ?? editTeamName);
      setEditTeamDescription(updatedTeam.description ?? editTeamDescription);
      setEditTeamMaxMembers(String(updatedTeam.maxMembers ?? nextMaxMembers));
      setShowTeamDetailsEditor(false);
      showNotif("Team details saved", "success");
    });
  };

  const joinTeamById = async (teamId: string) => {
    if (!jwtToken) return;
    await withError(async () => {
      await request(`/teams/${teamId}/join-requests`, {
        method: "POST",
        headers: authHeaders
      });
      if (currentUser?._id) {
        await Promise.all([loadRankedOpenTeams(currentUser._id), loadSentJoinRequests(currentUser._id)]);
      }
      if (selectedTeam === teamId) {
        await loadJoinRequests(teamId);
      }
      await loadOpenTeams();
      showNotif("Join request sent", "success");
    });
  };

  const joinSelectedTeam = async () => {
    if (!selectedTeam || !jwtToken) return;
    await withError(async () => {
      await request(`/teams/${selectedTeam}/join-requests`, {
        method: "POST",
        headers: authHeaders
      });
      await loadJoinRequests(selectedTeam);
      if (currentUser?._id) {
        await Promise.all([loadRankedOpenTeams(currentUser._id), loadSentJoinRequests(currentUser._id)]);
      }
      showNotif("Join request sent", "success");
    });
  };

  const updateRequest = async (requestId: string, status: "accepted" | "declined") => {
    if (!jwtToken || !selectedTeam) return;
    await withError(async () => {
      await request(`/join-requests/${requestId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status })
      });
      await loadJoinRequests(selectedTeam);
      if (currentUser?._id) {
        await Promise.all([loadIncomingJoinRequests(currentUser._id), loadSentJoinRequests(currentUser._id)]);
      }
      await loadOpenTeams();
      showNotif(`Request ${status}`, "success");
    });
  };

  const updateIncomingRequest = async (requestId: string, teamId: string, status: "accepted" | "declined") => {
    if (!jwtToken) return;
    await withError(async () => {
      await request(`/join-requests/${requestId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status })
      });
      if (currentUser?._id) {
        await Promise.all([loadIncomingJoinRequests(currentUser._id), loadSentJoinRequests(currentUser._id)]);
      }
      if (selectedTeam === teamId) {
        await loadJoinRequests(teamId);
      }
      await loadOpenTeams();
      showNotif(`Request ${status}`, "success");
    });
  };

  const sendTeamInvite = async (toUserId: string, inviteeName: string) => {
    if (!jwtToken || !selectedTeam || !selectedTeamDetails) {
      showNotif("Select and open your team first", "error");
      return;
    }
    if (selectedTeamDetails.createdBy !== currentUser?._id) {
      showNotif("Only team creator can send invites", "error");
      return;
    }

    const optionalMessage = window.prompt(`Optional message for ${inviteeName}:`, "Join my team?") ?? "";

    await withError(async () => {
      await request(`/teams/${selectedTeam}/invites`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ toUserId, message: optionalMessage })
      });
      showNotif(`Invite sent to ${inviteeName}`, "success");
    });
  };

  const respondToTeamInvite = async (inviteId: string, status: "accepted" | "declined") => {
    if (!jwtToken) return;
    const rejectionMessage =
      status === "declined"
        ? (window.prompt("Optional rejection message:", "") ?? "")
        : "";

    await withError(async () => {
      await request(`/team-invites/${inviteId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status, responseMessage: rejectionMessage })
      });
      if (currentUser?._id) await loadIncomingTeamInvites(currentUser._id);
      await loadOpenTeams();
      showNotif(`Invite ${status}`, "success");
    });
  };

  const updateTeamStatus = async (teamId: string, status: "open" | "closed") => {
    if (!jwtToken) return;
    await withError(async () => {
      await request(`/teams/${teamId}/status`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status })
      });
      await loadOpenTeams();
      if (currentUser?._id) await loadRankedOpenTeams(currentUser._id);
      if (selectedTeam === teamId && status === "closed") {
        leaveTeamChat(teamId);
        setSelectedTeam("");
        setSelectedTeamDetail(null);
        setSuggestions([]);
        setJoinRequests([]);
        setTeamChatMessages([]);
        setTeamChatInput("");
      }
      showNotif(`Team ${status === "closed" ? "closed" : "reopened"}`, "success");
    });
  };

  const leaveTeam = async (teamId: string) => {
    if (!jwtToken) return;
    await withError(async () => {
      await request(`/teams/${teamId}/leave`, {
        method: "PATCH",
        headers: authHeaders
      });
      await loadOpenTeams();
      if (currentUser?._id) await loadRankedOpenTeams(currentUser._id);
      if (selectedTeam === teamId) {
        leaveTeamChat(teamId);
        setSelectedTeam("");
        setSelectedTeamDetail(null);
        setSuggestions([]);
        setJoinRequests([]);
        setTeamChatMessages([]);
        setTeamChatInput("");
      }
      showNotif("You left the team", "success");
    });
  };

  const loadSkillSwaps = async () => {
    if (!jwtToken) return;
    const data = await request("/skill-swaps/open", { headers: authHeaders });
    setSwaps(data);
    
    // Load all swap creator profiles
    const creatorIds = Array.from(new Set(data.map((swap: SkillSwap) => swap.createdBy))) as string[];
    const creatorPairs = await Promise.all(creatorIds.map(async (creatorId: string) => [creatorId, await loadSkillSwapCreator(creatorId)] as const));
    const creatorMap = creatorPairs.reduce<Record<string, User>>((acc, [creatorId, details]) => {
      if (details) acc[creatorId] = details;
      return acc;
    }, {});
    setSkillSwapCreators(creatorMap);
  };

  const loadSkillSwapRequester = async (userId: string) => {
    if (!jwtToken) return null;
    try {
      return await request(`/users/${userId}`, { headers: authHeaders });
    } catch (err) {
      console.error("Failed to load skill swap requester", err);
      return null;
    }
  };

  const loadSkillSwapCreator = async (userId: string) => {
    if (!jwtToken) return null;
    try {
      return await request(`/users/${userId}`, { headers: authHeaders });
    } catch (err) {
      console.error("Failed to load skill swap creator", err);
      return null;
    }
  };

  const loadSkillSwapRequests = async (swapId: string) => {
    if (!jwtToken) return;
    const data = await request(`/skill-swaps/${swapId}/requests`, { headers: authHeaders });
    const requests = data as SkillSwapRequest[];
    setSelectedSkillSwapRequests(requests);
    setSkillSwapRequesters({});

    const requesterIds = Array.from(new Set(requests.map((item) => item.requesterId)));
    const requesterPairs = await Promise.all(requesterIds.map(async (requesterId) => [requesterId, await loadSkillSwapRequester(requesterId)] as const));
    const requesterMap = requesterPairs.reduce<Record<string, User>>((acc, [requesterId, details]) => {
      if (details) acc[requesterId] = details;
      return acc;
    }, {});
    setSkillSwapRequesters(requesterMap);
  };

  const openSkillSwap = async (swap: SkillSwap) => {
    setSelectedSkillSwap(swap);
    setSelectedSkillSwapRequestId("");
    setSkillSwapChatMessages([]);
    setSkillSwapChatInput("");
    const creator = await loadSkillSwapCreator(swap.createdBy);
    setSkillSwapCreator(creator);
    await loadSkillSwapRequests(swap._id);
  };

  const createSkillSwapRequest = async (swapId: string) => {
    if (!jwtToken) return;
    await withError(async () => {
      await request(`/skill-swaps/${swapId}/requests`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ message: skillSwapRequestMessage })
      });
      setSkillSwapRequestMessage("");
      await loadSkillSwaps();
      if (selectedSkillSwap?._id === swapId) {
        await loadSkillSwapRequests(swapId);
      }
      pushEvent("skill.swap.request.sent");
      showNotif("Swap request sent", "success");
    });
  };

  const updateSkillSwapRequest = async (requestId: string, status: "accepted" | "declined") => {
    if (!jwtToken || !selectedSkillSwap) return;
    await withError(async () => {
      await request(`/skill-swap-requests/${requestId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status })
      });
      await loadSkillSwaps();
      await loadSkillSwapRequests(selectedSkillSwap._id);
      pushEvent(`skill.swap.request.${status}`);
      showNotif(`Swap request ${status}`, "success");
    });
  };

  const joinSkillSwapChat = async (requestId: string) => {
    if (!currentUser?._id) return;
    setSelectedSkillSwapRequestId(requestId);
    setSkillSwapChatMessages([]);
    socket.emit("skill.swap.chat.join", { requestId, userId: currentUser._id });
  };

  const sendSkillSwapMessage = async () => {
    if (!currentUser?._id || !selectedSkillSwapRequestId || !skillSwapChatInput.trim()) return;
    const swapRequest = selectedSkillSwapRequests.find((item) => item._id === selectedSkillSwapRequestId);
    if (!swapRequest || swapRequest.status !== "accepted") return;
    socket.emit("skill.swap.message", {
      requestId: selectedSkillSwapRequestId,
      userId: currentUser._id,
      userName: currentUser.name,
      text: skillSwapChatInput
    });
    setSkillSwapChatInput("");
  };

  const createSkillSwap = async () => {
    if (!jwtToken) return;
    await withError(async () => {
      await request("/skill-swaps", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          canTeach: teachInput.split(",").map((s) => s.trim()).filter(Boolean),
          wantsToLearn: learnInput.split(",").map((s) => s.trim()).filter(Boolean)
        })
      });
      await loadSkillSwaps();
      setShowSwapModal(false);
      pushEvent("skill.swap.posted");
      showNotif("Swap posted", "success");
    });
  };

  const loadTasks = async () => {
    if (!jwtToken) return;
    const data = await request("/tasks/open", { headers: authHeaders });
    setTasks(data);
  };

  const createTask = async () => {
    if (!jwtToken) return;
    await withError(async () => {
      await request("/tasks", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          budget: Number(taskBudget)
        })
      });
      await loadTasks();
      setShowTaskModal(false);
      pushEvent("task.posted");
      showNotif("Task posted", "success");
    });
  };

  const loadTaskCreator = async (createdById: string) => {
    if (!jwtToken) return;
    try {
      const data = await request(`/users/${createdById}`, { headers: authHeaders });
      setTaskCreatorDetails(data);
    } catch (err) {
      console.error("Failed to load task creator", err);
    }
  };

  const loadAssignedDeveloper = async (developerId: string) => {
    if (!jwtToken) return;
    try {
      const data = await request(`/users/${developerId}`, { headers: authHeaders });
      setAssignedDeveloperDetails(data);
    } catch (err) {
      console.error("Failed to load assigned developer", err);
    }
  };

  const loadProposalDeveloper = async (developerId: string) => {
    if (!jwtToken) return null;
    try {
      return await request(`/users/${developerId}`, { headers: authHeaders });
    } catch (err) {
      console.error("Failed to load proposal developer", err);
      return null;
    }
  };

  const loadProposals = async (taskId: string) => {
    if (!jwtToken) return;
    const data = await request(`/tasks/${taskId}/proposals`, { headers: authHeaders });
    const proposalList = data as Proposal[];
    setSelectedTask(taskId);
    setProposals(proposalList);
    setShowTaskCreatorDetails(false);
    setProposalDeveloperDetails({});
    
    const task = tasks.find(t => t._id === taskId);
    if (task && task.createdBy) {
      await loadTaskCreator(task.createdBy);
    }
    if (task && task.assignedTo) {
      setShowAssignedDeveloperDetails(false);
      await loadAssignedDeveloper(task.assignedTo);
    } else {
      setAssignedDeveloperDetails(null);
      setShowAssignedDeveloperDetails(false);
    }

    const uniqueDeveloperIds: string[] = Array.from(new Set(proposalList.map((proposal) => proposal.developerId)));
    const developerPairs = await Promise.all(uniqueDeveloperIds.map(async (developerId) => [developerId, await loadProposalDeveloper(developerId)] as const));
    const developerDetails = developerPairs.reduce<Record<string, User>>((acc, [developerId, details]) => {
      if (details) acc[developerId] = details;
      return acc;
    }, {});
    setProposalDeveloperDetails(developerDetails);
  };

  const submitProposal = async () => {
    if (!jwtToken || !selectedTask) return;
    await withError(async () => {
      await request(`/tasks/${selectedTask}/proposals`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          price: Number(proposalPrice),
          reasoning: proposalReasoning,
          portfolioUrl: proposalPortfolioUrl,
          resumeUrl: proposalResumeUrl
        })
      });
      await loadProposals(selectedTask);
      setProposalPortfolioUrl("");
      setProposalResumeUrl("");
      showNotif("Proposal submitted", "success");
    });
  };

  const updateProposal = async (proposalId: string, status: "accepted" | "declined") => {
    if (!jwtToken || !selectedTask) return;
    await withError(async () => {
      await request(`/tasks/proposals/${proposalId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status })
      });
      await loadTasks();
      await loadProposals(selectedTask);
      showNotif(`Proposal ${status}`, "success");
    });
  };

  const submitTaskWork = async () => {
    if (!jwtToken || !selectedTask) return;
    await withError(async () => {
      await request(`/tasks/${selectedTask}/submit`, {
        method: "PATCH",
        headers: authHeaders
      });
      await loadTasks();
      showNotif("Task work submitted", "success");
    });
  };

  const fundTaskEscrow = async () => {
    if (!jwtToken || !selectedTask) return;
    await withError(async () => {
      await request(`/tasks/${selectedTask}/fund-escrow`, {
        method: "PATCH",
        headers: authHeaders
      });
      await loadTasks();
      await loadProposals(selectedTask);
      showNotif("Escrow funded", "success");
    });
  };

  const requestTaskExtension = async () => {
    if (!jwtToken || !selectedTask) return;
    if (!extensionMessage.trim()) {
      showNotif("Please add extension request message", "error");
      return;
    }
    await withError(async () => {
      await request(`/tasks/${selectedTask}/extension-request`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ message: extensionMessage })
      });
      await loadTasks();
      setExtensionMessage("");
      showNotif("Extension request sent", "success");
    });
  };

  const completeTask = async () => {
    if (!jwtToken || !selectedTask) return;
    await withError(async () => {
      await request(`/tasks/${selectedTask}/complete`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ rating: Number(completionRating) })
      });
      await loadTasks();
      await loadProposals(selectedTask);
      showNotif("Task completed", "success");
    });
  };

  const sendTaskMessage = async () => {
    if (!jwtToken || !selectedTask || !taskMessageInput.trim()) return;
    await withError(async () => {
      const newMessage = {
        sender: currentUser._id,
        senderName: currentUser.name,
        message: taskMessageInput,
        timestamp: new Date().toISOString()
      };
      setTaskMessages([...taskMessages, newMessage]);
      setTaskMessageInput("");
      showNotif("Message sent", "success");
    });
  };

  const getStrangerToken = async () => {
    if (!jwtToken) return;
    await withError(async () => {
      const data = await request("/stranger-devs/token", { headers: authHeaders });
      setStrangerToken(data.roomToken);
      pushEvent("stranger.token.received");
      showNotif("Queue token received", "success");
    });
  };

  const joinStrangerQueue = () => {
    if (!strangerToken) return;
    setStrangerWaiting(true);
    socket.emit("stranger.queue.join", {
      roomToken: strangerToken,
      alias: strangerAlias,
      anonymous: strangerAnonymous
    });
  };

  const leaveStrangerQueue = () => {
    socket.emit("stranger.queue.leave");
    setStrangerRoom("");
    setStrangerUsers([]);
    setStrangerWaiting(false);
  };

  const sendStrangerMessage = () => {
    if (!strangerInput.trim() || !strangerRoom) return;
    socket.emit("stranger.message", { text: strangerInput });
    setStrangerInput("");
  };

  const logout = () => {
    setJwtToken("");
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.user);
      localStorage.removeItem(STORAGE_KEYS.page);
    } catch {
      // ignore storage failures
    }
    setPage("dashboard");
    setSuggestions([]);
    setJoinRequests([]);
    setSelectedTeam("");
    setSelectedTask("");
    setProposals([]);
    showNotif("Logged out", "success");
  };

  const toggleSignupSkill = (skill: string) => {
    setSignupSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const toggleTeamRole = (role: string) => {
    setTeamRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const addCustomTeamRole = () => {
    const normalized = teamRoleInput.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    setTeamRoles((prev) => {
      const exists = prev.some((role) => role.toLowerCase() === normalized.toLowerCase());
      if (exists) return prev;
      return [...prev, normalized];
    });
    setTeamRoleInput("");
  };

  const myTeams = useMemo(() => {
    if (!currentUser) return [];
    return teams.filter((team) => team.members.includes(currentUser._id));
  }, [teams, currentUser]);

  const profileSkills = currentUser?.skills?.tech ?? [];
  const selectedTeamDetails = teams.find((team) => team._id === selectedTeam);
  const selectedTaskDetails = tasks.find((task) => task._id === selectedTask);
  const isSelectedTaskOwner = Boolean(selectedTaskDetails && selectedTaskDetails.createdBy === currentUser._id);
  const isSelectedTaskAssignee = Boolean(selectedTaskDetails && selectedTaskDetails.assignedTo === currentUser._id);
  const myProposalForSelectedTask = selectedTask
    ? proposals.find((proposal) => proposal.developerId === currentUser._id)
    : undefined;
  const canSubmitProposal = Boolean(selectedTaskDetails && !isSelectedTaskOwner && selectedTaskDetails.status === "open" && !myProposalForSelectedTask);

  const openEditProfile = () => {
    if (!currentUser) return;
    setEditName(currentUser.name ?? "");
    setEditRole(currentUser.preferredRoles?.[0] ?? currentUser.experienceLevel ?? "");
    setEditExperience((currentUser.experienceLevel as "beginner" | "intermediate" | "advanced") ?? "beginner");
    setEditGithub(currentUser.githubUrl ?? "");
    setEditLinkedin(currentUser.linkedinUrl ?? "");
    setEditSkillCsv((currentUser.skills?.tech ?? []).join(", "));
    setEditInterestsCsv((currentUser.interests ?? []).join(", "));
    setEditHackathonCsv((currentUser.hackathonHistory ?? []).join(", "));
    setShowProfileModal(true);
  };

  if (!jwtToken || !currentUser) {
    return (
      <div id="auth-screen">
        <div className="auth-glow" />
        <div className="auth-box">
          <div className="auth-logo">
            Dev<span>Match</span>
          </div>
          <div className="auth-tagline">Find your perfect hackathon team, instantly.</div>
          <div className="tab-row">
            <button className={`tab-btn ${authTab === "login" ? "active" : ""}`} onClick={() => setAuthTab("login")}>Login</button>
            <button className={`tab-btn ${authTab === "signup" ? "active" : ""}`} onClick={() => setAuthTab("signup")}>Sign Up</button>
          </div>

          {authTab === "login" && (
            <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); void doLogin(); }}>
              <div className="form-group">
                <label>Email</label>
                <input
                  name="devmatch-login-email"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@college.edu"
                  type="text"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  name="devmatch-login-password"
                  autoComplete="off"
                  data-form-type="other"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="********"
                  type="password"
                />
              </div>
              <button className="btn-primary" type="submit" disabled={isBusy}>Login to DevMatch</button>
            </form>
          )}

          {authTab === "signup" && (
            <div>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Aryan Sharma" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder="you@college.edu" type="email" />
                </div>
              </div>
              <div className="form-group">
                <label>Password</label>
                <input value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} placeholder="Create a password" type="password" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>College</label>
                  <input value={signupCollege} onChange={(e) => setSignupCollege(e.target.value)} placeholder="IIT Bombay" />
                </div>
                <div className="form-group">
                  <label>Year</label>
                  <select value={signupYear} onChange={(e) => setSignupYear(e.target.value)}>
                    <option>1st Year</option>
                    <option>2nd Year</option>
                    <option>3rd Year</option>
                    <option>4th Year</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Primary Role</label>
                <select value={signupRole} onChange={(e) => setSignupRole(e.target.value)}>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Skills</label>
                <div className="skills-grid">
                  {SKILL_OPTIONS.map((skill) => (
                    <span
                      key={skill}
                      className={`skill-chip ${signupSkills.includes(skill) ? "selected" : ""}`}
                      onClick={() => toggleSignupSkill(skill)}
                      role="button"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>GitHub URL</label>
                  <input value={signupGithub} onChange={(e) => setSignupGithub(e.target.value)} placeholder="github.com/username" />
                </div>
                <div className="form-group">
                  <label>LinkedIn URL</label>
                  <input value={signupLinkedin} onChange={(e) => setSignupLinkedin(e.target.value)} placeholder="linkedin.com/in/name" />
                </div>
              </div>
              <div className="form-group">
                <label>Hackathon Experience</label>
                <select value={signupExperience} onChange={(e) => setSignupExperience(e.target.value)}>
                  <option>No experience yet</option>
                  <option>1-2 hackathons</option>
                  <option>3-5 hackathons</option>
                  <option>5+ hackathons</option>
                  <option>Won a hackathon</option>
                </select>
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea value={signupBio} onChange={(e) => setSignupBio(e.target.value)} placeholder="Tell teams what makes you awesome..." />
              </div>
              <button className="btn-primary" onClick={doSignup} disabled={isBusy}>Create My Profile</button>
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}
        </div>

        {notif && <div className={`notif show ${notif.type}`}>{notif.message}</div>}
      </div>
    );
  }

  return (
    <>
      {notif && <div className={`notif show ${notif.type}`}>{notif.message}</div>}

      <div id="app" className="visible">
        <nav>
          <div className="nav-logo">
            Dev<span>Match</span>
          </div>
          <div className="nav-links">
            <button className={`nav-link ${page === "dashboard" ? "active" : ""}`} aria-current={page === "dashboard" ? "page" : undefined} onClick={() => setPage("dashboard")}>Home</button>
            <button className={`nav-link ${page === "hackathons" ? "active" : ""}`} aria-current={page === "hackathons" ? "page" : undefined} onClick={openHackathonsTab}>Hackathons</button>
            <button className={`nav-link ${page === "skillswap" ? "active" : ""}`} aria-current={page === "skillswap" ? "page" : undefined} onClick={() => setPage("skillswap")}>Skill Swap</button>
            <button className={`nav-link ${page === "stranger" ? "active" : ""}`} aria-current={page === "stranger" ? "page" : undefined} onClick={() => setPage("stranger")}>Stranger Devs</button>
            <button className={`nav-link ${page === "marketplace" ? "active" : ""}`} aria-current={page === "marketplace" ? "page" : undefined} onClick={() => setPage("marketplace")}>Marketplace</button>
            <button className={`nav-link ${page === "ranking" ? "active" : ""}`} aria-current={page === "ranking" ? "page" : undefined} onClick={() => setPage("ranking")}>Rankings</button>
          </div>
          <div className="nav-user">
            <span className="nav-points">* {currentUser.rankScore} pts</span>
            <div className="nav-avatar" style={{ background: hashColor(currentUser.name) }} onClick={() => setPage("profile")}>{initials(currentUser.name)}</div>
          </div>
        </nav>

        <div className={`page ${page === "dashboard" ? "active" : ""}`}>
          <div className="welcome-banner">
            <div>
              <div className="welcome-title">Welcome back, {currentUser.name.split(" ")[0]}</div>
              <div className="welcome-sub">Ready to find your next hackathon team?</div>
            </div>
            <button className="btn-sm btn-accent" onClick={openHackathonsTab}>Browse Hackathons</button>
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-num">#{myRank || 1}</div>
              <div className="stat-label">Your Rank</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{currentUser.rankScore}</div>
              <div className="stat-label">Points</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{myTeams.length}</div>
              <div className="stat-label">Teams Joined</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{teams.length}</div>
              <div className="stat-label">Live Teams</div>
            </div>
          </div>

          <div className="section-title">
            <span className="dot" /> Add Dev Friend
          </div>
          <div className="friend-stage">
            {SIDE_CARDS.map((card) => (
              <button
                key={`side-card-${card.side}`}
                className={`side-preview-card side-preview-card-${card.side}`}
                onClick={() => setActiveSideCard(card.side)}
              >
                <div className="side-preview-title">{card.title}</div>
                <div className="side-preview-name">{card.personName}</div>
                <div className="side-preview-sub">{card.subtitle}</div>
                <div className="side-preview-note">{card.note}</div>
                <div className="side-preview-chips">
                  {card.chips.map((chip) => (
                    <span className="deck-skill" key={`${card.side}-${chip}`}>{chip}</span>
                  ))}
                </div>
              </button>
            ))}

            <div className="teammate-deck-wrap friend-center-shell">
              <div className="teammate-deck" aria-label="Suggested teammates card deck">
                {deckSuggestions.slice(0, 3).map((s, index) => {
                  const isTop = index === 0;
                  const baseScale = 1 - index * 0.05;
                  const baseY = index * 14;
                  const dragX = isTop ? deckDragX : 0;
                  const exitX = deckAnimating && isTop ? (deckAnimating === "right" ? 420 : -420) : 0;
                  const tx = dragX + exitX;
                  const rotate = isTop ? tx / 18 : 0;
                  const opacity = isTop ? (deckAnimating ? 0 : 1) : Math.max(0.4, 0.82 - index * 0.18);

                  return (
                    <div
                      key={`${s.userId}-${index}`}
                      className={`teammate-deck-card ${isTop ? "is-top" : ""}`}
                      style={{
                        zIndex: 30 - index,
                        transform: `translate(-50%, ${baseY}px) scale(${baseScale}) translateX(${tx}px) rotate(${rotate}deg)`,
                        opacity,
                        transition: isTop && deckDragStartX.current !== null
                          ? "none"
                          : "transform 0.28s ease, opacity 0.28s ease, box-shadow 0.2s ease"
                      }}
                      onPointerDown={isTop ? onDeckPointerDown : undefined}
                      onPointerMove={isTop ? onDeckPointerMove : undefined}
                      onPointerUp={isTop ? onDeckPointerUp : undefined}
                      onPointerCancel={isTop ? onDeckPointerUp : undefined}
                      onClick={
                        isTop
                          ? () => {
                              if (deckDragStartX.current !== null) return;
                              cycleDeck(Math.random() > 0.5 ? "right" : "left");
                            }
                          : undefined
                      }
                    >
                      <div className="deck-avatar" style={{ background: hashColor(s.name) }}>{initials(s.name)}</div>
                      <div className="deck-name">{s.name}</div>
                      <div className="deck-role">{s.preferredRole ?? "Recommended Developer"}</div>
                      <div className="deck-meta">Core: {s.coreLanguage ?? "Not specified"} • Level: {s.experienceLevel ?? "beginner"}</div>
                      <div className="deck-id">ID: {s.userId}</div>
                      <div className="deck-skill-row">
                        <span className="deck-skill">Match {s.matchPercent}%</span>
                        <span className="deck-skill">Rank {s.rankScore}</span>
                        {(s.topTechSkills ?? []).slice(0, 3).map((skill) => (
                          <span className="deck-skill" key={`${s.userId}-${skill}`}>{skill}</span>
                        ))}
                      </div>
                      <div className="deck-links">
                        <a
                          className={`deck-icon-btn ${s.githubUrl ? "" : "disabled"}`}
                          href={s.githubUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${s.name} GitHub`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!s.githubUrl) event.preventDefault();
                          }}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.54 2.87 8.39 6.84 9.76.5.09.66-.22.66-.48 0-.24-.01-.88-.01-1.72-2.78.62-3.37-1.38-3.37-1.38-.45-1.18-1.1-1.49-1.1-1.49-.9-.63.07-.62.07-.62.99.07 1.5 1.04 1.5 1.04.88 1.54 2.32 1.1 2.88.84.09-.65.35-1.1.63-1.35-2.22-.26-4.56-1.13-4.56-5.02 0-1.11.38-2.02 1.02-2.73-.1-.25-.44-1.29.1-2.69 0 0 .84-.28 2.75 1.04a9.2 9.2 0 0 1 5 0c1.9-1.32 2.74-1.04 2.74-1.04.54 1.4.2 2.44.1 2.69.63.71 1.02 1.62 1.02 2.73 0 3.9-2.35 4.76-4.58 5.01.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .26.17.57.67.47A10.27 10.27 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
                          </svg>
                        </a>
                        <a
                          className={`deck-icon-btn ${s.linkedinUrl ? "" : "disabled"}`}
                          href={s.linkedinUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${s.name} LinkedIn`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!s.linkedinUrl) event.preventDefault();
                          }}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4.98 3.5A2.48 2.48 0 1 1 4.97 8a2.48 2.48 0 0 1 .01-4.5zM3 8.75h3.95V21H3V8.75zm7.12 0h3.78v1.67h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.09V21h-3.95v-5.45c0-1.3-.03-2.98-1.82-2.98-1.83 0-2.11 1.43-2.11 2.89V21H10.12V8.75z" />
                          </svg>
                        </a>
                      </div>
                      <button
                        className="deck-add-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          alert(`Friend request sent to ${s.name}`);
                        }}
                      >
                        Add Dev Friend
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {activeSideCard && (
              <div className="side-pop-layer" onClick={() => setActiveSideCard(null)}>
                <div className="side-pop-card" onClick={(event) => event.stopPropagation()}>
                  {(() => {
                    const card = SIDE_CARDS.find((item) => item.side === activeSideCard);
                    if (!card) return null;
                    return (
                      <>
                        <div className="side-pop-top">
                          <div className="side-preview-title">{card.title}</div>
                          <button className="modal-close" onClick={() => setActiveSideCard(null)}>×</button>
                        </div>
                        <div className="deck-name" style={{ fontSize: 24, textAlign: "left" }}>{card.personName}</div>
                        <div className="deck-role" style={{ textAlign: "left" }}>{card.subtitle}</div>
                        <div className="deck-meta" style={{ textAlign: "left" }}>{card.note}</div>
                        <div className="side-preview-chips" style={{ justifyContent: "flex-start" }}>
                          {card.chips.map((chip) => (
                            <span className="deck-skill" key={`pop-${card.side}-${chip}`}>{chip}</span>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`page ${page === "hackathons" ? "active" : ""}`}>
          <div className="flex-between" style={{ marginBottom: 24 }}>
            <div className="section-title" style={{ margin: 0 }}>
              <span className="dot" /> Hackathons
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-secondary" onClick={() => setShowCreateTeamModal(true)}>+ Create Team</button>
              {myTeams.length === 0 && (
                <button className="btn-sm btn-accent" onClick={() => setShowJoinModal(true)}>Join a Team</button>
              )}
              <button
                className={`btn-secondary ${page === "hackathons" && hackathonsView === "teams" ? "active" : ""}`}
                aria-pressed={page === "hackathons" && hackathonsView === "teams"}
                onClick={openTeamsView}
              >
                Open Teams
              </button>
              <button
                className="btn-secondary"
                onClick={() =>
                  void withError(async () => {
                    await Promise.all([loadOpenTeams(), loadLiveHackathons()]);
                  })
                }
              >
                Refresh
              </button>
            </div>
          </div>

          {hackathonsView === "feed" && (
            <>
              <p className="text-muted" style={{ marginBottom: 14 }}>
                Live feed source: {hackathonSource === "devpost"
                  ? "Devpost (real data)"
                  : hackathonSource === "mixed"
                    ? "Mostly Devpost + small curated set"
                    : "Fallback seed"}
              </p>

              <div className="section-title" style={{ marginBottom: 12 }}>
                <span className="dot" /> Live Hackathons
              </div>

              <div className="hackathons-grid">
                {liveHackathons.map((hackathon) => (
                  <div className="hack-card" key={`live-${hackathon.id}`}>
                    <span className={`hack-badge badge-${hackathon.status}`}>{hackathon.status === "hot" ? "Hot" : hackathon.status === "open" ? "Open" : "Soon"}</span>
                    <div className="hack-name">{hackathon.name}</div>
                    <div className="hack-meta">
                      {hackathon.location} | {hackathon.dateLabel}
                    </div>
                    <div className="hack-meta">
                      Prize: {hackathon.prize} | Registrations: {hackathon.registrations}
                    </div>
                    <div className="hack-actions">
                      <button
                        className="btn-sm btn-accent"
                        onClick={() => {
                          setTeamHackathon(hackathon.name);
                          setShowCreateTeamModal(true);
                        }}
                      >
                        Create Team
                      </button>
                      <a className="btn-sm btn-outline" href={hackathon.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </div>
                  </div>
                ))}
                {!liveHackathons.length && <div className="ghost-row">No live hackathon feed yet.</div>}
              </div>

              <div className="ghost-row" style={{ paddingTop: 14 }}>
                Want team workflows? Click Open Teams above.
              </div>
            </>
          )}

          {hackathonsView === "teams" && (
            <>
              <hr className="divider" />

              <div className="flex-between" style={{ marginBottom: 12, marginTop: 10 }}>
                <div className="section-title" style={{ margin: 0 }}>
                  <span className="dot" /> Open Teams
                </div>
                <span
                  className="text-muted"
                  role="button"
                  onClick={() => setHackathonsView("feed")}
                  style={{ cursor: "pointer" }}
                >
                  ← Go back
                </span>
              </div>
              <p className="text-muted" style={{ marginBottom: 16 }}>
                Teams created by users. Pick one and view details or request to join.
              </p>

          <div className="hackathons-grid">
            {teams.map((team) => (
              <div className={`hack-card ${team.createdBy === currentUser._id ? "hack-card-owner" : ""}`} key={team._id}>
                <span className={`hack-badge ${team.status === "open" ? "badge-open" : "badge-soon"}`}>{team.status}</span>
                <div className="hack-name">{team.name}</div>
                <div className="hack-meta"><span className="open-team-hackathon">{team.hackathon}</span> | Members: {team.members.length} / {team.maxMembers ?? 5}</div>
                <div className="hack-actions">
                  {team.createdBy === currentUser._id ? (
                    <>
                      <button
                        className="btn-sm btn-accent"
                        onClick={() => void openTeamWorkspace(team._id)}
                      >
                        Open Team
                      </button>
                      <button
                        className="btn-sm btn-outline"
                        onClick={() => void updateTeamStatus(team._id, "closed")}
                        style={{ color: "var(--rose)", borderColor: "rgba(244,63,94,0.3)" }}
                      >
                        Close Team
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn-sm btn-accent" onClick={() => void joinTeamById(team._id)}>
                        Join Team
                      </button>
                      <button className="btn-sm btn-outline" onClick={() => void openTeamWorkspace(team._id)}>
                        Team Detail
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!teams.length && <div className="ghost-row">No teams yet. Create your first team.</div>}
          </div>

              <hr className="divider" />
              <div ref={openedTeamSectionRef}>
            <div className="section-title">
              <span className="dot" /> {selectedTeamDetails?.createdBy === currentUser._id ? "Your Team Workspace" : "Team Detail"}
            </div>
            {selectedTeamDetails ? (
              <>
                <div className="hack-card" style={{ marginBottom: 16 }}>
                  <div className="hack-name">{selectedTeamDetail?.name ?? selectedTeamDetails.name}</div>
                  <div className="hack-meta">
                    {selectedTeamDetail?.hackathon ?? selectedTeamDetails.hackathon} | Members: {selectedTeamDetail?.members.length ?? selectedTeamDetails.members.length} / {selectedTeamDetail?.maxMembers ?? selectedTeamDetails.maxMembers ?? 5}
                  </div>
                  <div className="hack-meta" style={{ marginTop: 8 }}>{selectedTeamDetail?.description ?? selectedTeamDetails.description}</div>
                  {selectedTeamDetail && (
                    <div style={{ marginTop: 12 }}>
                      <div className="section-title" style={{ fontSize: 16, marginBottom: 10 }}>
                        <span className="dot" /> Team Members
                      </div>
                      <div className="profiles-grid">
                        {selectedTeamDetail.members.map((member) => (
                          <div className="profile-card" key={`member-${member._id}`}>
                            <div className="profile-header">
                              <div className="p-avatar" style={{ background: hashColor(member.name) }}>{initials(member.name)}</div>
                              <div>
                                <div className="p-name">{member.name}</div>
                                <div className="p-role">{member.preferredRole ?? "Developer"}</div>
                              </div>
                            </div>
                            <div className="hack-meta" style={{ marginBottom: 8 }}>{member.email}</div>
                            <div className="hack-meta" style={{ marginBottom: 8 }}>
                              Core: {member.coreLanguage ?? "Not specified"} | Level: {member.experienceLevel ?? "beginner"}
                            </div>
                            <div className="p-skills">
                              <span className="p-skill">Rank {member.rankScore}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedTeamDetail && (
                    <div style={{ marginTop: 14 }}>
                      <div className="section-title" style={{ fontSize: 16, marginBottom: 10 }}>
                        <span className="dot" /> Team Chat
                      </div>
                      {selectedTeamDetail.members.some((member) => member._id === currentUser._id) ? (
                        <div style={{ backgroundColor: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
                          <div style={{ minHeight: 140, maxHeight: 240, overflowY: "auto", marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                            {!teamChatMessages.length ? (
                              <div className="ghost-row">No team messages yet.</div>
                            ) : (
                              teamChatMessages.map((message, idx) => (
                                <div
                                  key={`${message.timestamp}-${idx}`}
                                  style={{
                                    alignSelf: message.fromUserId === currentUser._id ? "flex-end" : "flex-start",
                                    maxWidth: "82%",
                                    borderRadius: 10,
                                    padding: "8px 10px",
                                    backgroundColor: message.fromUserId === currentUser._id ? "rgba(124,106,247,0.25)" : "var(--bg3)",
                                    color: "var(--text)",
                                    fontSize: 13
                                  }}
                                >
                                  <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 3 }}>
                                    {message.fromUserName} • {new Date(message.timestamp).toLocaleTimeString()}
                                  </div>
                                  <div>{message.text}</div>
                                </div>
                              ))
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              value={teamChatInput}
                              onChange={(e) => setTeamChatInput(e.target.value)}
                              placeholder="Message your team"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  sendTeamMessage();
                                }
                              }}
                            />
                            <button className="btn-sm btn-accent" onClick={sendTeamMessage}>Send</button>
                          </div>
                        </div>
                      ) : (
                        <div className="ghost-row">Join this team to use team chat.</div>
                      )}
                    </div>
                  )}
                  {selectedTeamDetails.createdBy === currentUser._id && (
                    <div style={{ marginTop: 14 }}>
                      {showTeamDetailsEditor ? (
                        <>
                          <div className="form-group" style={{ marginBottom: 10 }}>
                            <label>Team Name</label>
                            <input value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 10 }}>
                            <label>Team Description</label>
                            <textarea value={editTeamDescription} onChange={(e) => setEditTeamDescription(e.target.value)} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 10 }}>
                            <label>Team Size</label>
                            <input
                              type="number"
                              min={2}
                              value={editTeamMaxMembers}
                              onChange={(e) => setEditTeamMaxMembers(e.target.value)}
                            />
                          </div>
                          <div className="hack-actions">
                            <button className="btn-sm btn-accent" onClick={() => void saveTeamDetails()}>Save Details</button>
                            <button className="btn-sm btn-outline" onClick={() => setShowTeamDetailsEditor(false)}>Close</button>
                            <button className="btn-sm btn-outline" onClick={() => void openTeamWorkspace(selectedTeamDetails._id)}>Reload Team</button>
                          </div>
                        </>
                      ) : (
                        <div className="hack-actions">
                          <button className="btn-sm btn-accent" onClick={() => setShowTeamDetailsEditor(true)}>Edit Details</button>
                          <button className="btn-sm btn-outline" onClick={() => void openTeamWorkspace(selectedTeamDetails._id)}>Reload Team</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedTeamDetails.createdBy === currentUser._id && (
                  <>
                    <div className="section-title" style={{ fontSize: 18 }}>
                      <span className="dot" /> Recommended Teammates
                    </div>
                    <p className="text-muted" style={{ marginBottom: 16 }}>
                      Suggestions for the opened team only.
                    </p>
                    <div className="profiles-grid">
                      {suggestions.map((s) => (
                        <div className="profile-card" key={`team-suggestion-${s.userId}`}>
                          <div className="profile-header">
                            <div className="p-avatar" style={{ background: hashColor(s.name) }}>{initials(s.name)}</div>
                            <div>
                              <div className="p-name">{s.name}</div>
                              <div className="p-role">{s.preferredRole ?? "Suggested for team fit"}</div>
                            </div>
                          </div>
                          <div className="hack-meta" style={{ marginBottom: 10 }}>
                            Core language: {s.coreLanguage ?? "Not specified"} | Level: {s.experienceLevel ?? "beginner"}
                          </div>
                          <div className="p-skills">
                            <span className="p-skill">Match {s.matchPercent}%</span>
                            <span className="p-skill">Rank {s.rankScore}</span>
                            {(s.topTechSkills ?? []).map((skill) => (
                              <span className="p-skill" key={`team-${s.userId}-${skill}`}>{skill}</span>
                            ))}
                          </div>
                          <button className="btn-sm btn-accent" onClick={() => void sendTeamInvite(s.userId, s.name)}>
                            Invite
                          </button>
                        </div>
                      ))}
                      {!suggestions.length && <div className="ghost-row">No suggestions for this team yet.</div>}
                    </div>

                    <hr className="divider" />
                    <div className="section-title" style={{ fontSize: 18 }}>
                      <span className="dot" /> Join Requests
                    </div>
                    <div>
                      {joinRequests.map((jr) => (
                        <div className="hack-card" key={jr._id} style={{ marginBottom: 12 }}>
                          <div className="flex-between">
                            <div className="hack-meta">User {shortId(jr.userId)} | Match {jr.matchPercent}% | {jr.status}</div>
                            {jr.status === "pending" && (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className="btn-sm btn-accent" onClick={() => updateRequest(jr._id, "accepted")}>Accept</button>
                                <button className="btn-sm btn-outline" onClick={() => updateRequest(jr._id, "declined")}>Decline</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {!joinRequests.length && <div className="ghost-row">No join requests for this team yet.</div>}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="ghost-row">Click Team Detail or Open Team on any team card to see member details here.</div>
            )}
              </div>
            </>
          )}

          <hr className="divider" />
          <div className="section-title">
            <span className="dot" /> Your Teams
          </div>
          <div>
            {myTeams.map((team) => (
              <div className="hack-card" style={{ marginBottom: 12 }} key={team._id}>
                <div className="hack-name">{team.name}</div>
                <div className="hack-meta">{team.hackathon} | {team.members.length} / {team.maxMembers ?? 5} members</div>
                <div className="hack-meta" style={{ marginTop: 8 }}>{team.description}</div>
                <div className="hack-actions" style={{ marginTop: 10 }}>
                  <button className="btn-sm btn-accent" onClick={() => void openMyTeam(team._id)}>Open Team</button>
                  <button className="btn-sm btn-outline" onClick={() => void leaveTeam(team._id)}>Leave Team</button>
                </div>
              </div>
            ))}
            {!myTeams.length && <div className="ghost-row">You have not joined any team yet.</div>}
          </div>

          <hr className="divider" />
          <div className="section-title">
            <span className="dot" /> All My Requests
          </div>
          <div>
            {incomingTeamInvites.map((inviteItem) => (
              <div className="hack-card" key={`invite-inline-${inviteItem.inviteId}`} style={{ marginBottom: 12 }}>
                <div className="hack-meta" style={{ marginBottom: 8 }}>
                  Invite: {inviteItem.fromUserName} invited you to join {inviteItem.teamName} | {inviteItem.status}
                </div>
                {inviteItem.message ? <div className="hack-meta" style={{ marginBottom: 8 }}>Message: {inviteItem.message}</div> : null}
                {inviteItem.status === "declined" && inviteItem.responseMessage ? (
                  <div className="hack-meta" style={{ marginBottom: 8 }}>Your message: {inviteItem.responseMessage}</div>
                ) : null}
                {inviteItem.status === "pending" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-sm btn-accent" onClick={() => void respondToTeamInvite(inviteItem.inviteId, "accepted")}>Accept</button>
                    <button className="btn-sm btn-outline" onClick={() => void respondToTeamInvite(inviteItem.inviteId, "declined")}>Reject</button>
                  </div>
                ) : null}
              </div>
            ))}
            {incomingJoinRequests.map((requestItem) => (
              <div className="hack-card" key={requestItem.requestId} style={{ marginBottom: 12 }}>
                <div className="flex-between">
                  <div className="hack-meta">
                    Incoming: {requestItem.fromUserName} wants to join {requestItem.teamName} | Match {requestItem.matchPercent}% | {requestItem.status}
                  </div>
                  {requestItem.status === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn-sm btn-accent"
                        onClick={() => updateIncomingRequest(requestItem.requestId, requestItem.teamId, "accepted")}
                      >
                        Accept
                      </button>
                      <button
                        className="btn-sm btn-outline"
                        onClick={() => updateIncomingRequest(requestItem.requestId, requestItem.teamId, "declined")}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sentJoinRequests.map((requestItem) => (
              <div className="hack-card" key={`sent-${requestItem.requestId}`} style={{ marginBottom: 12 }}>
                <div className="hack-meta">
                  Sent: You requested to join {requestItem.teamName} (Creator: {requestItem.creatorName}) | Match {requestItem.matchPercent}% | {requestItem.status}
                </div>
              </div>
            ))}
            {!incomingTeamInvites.length && !incomingJoinRequests.length && !sentJoinRequests.length && (
              <div className="ghost-row">No requests yet.</div>
            )}
          </div>

        </div>

        <div className={`page ${page === "skillswap" ? "active" : ""}`}>
          <div className="flex-between" style={{ marginBottom: 24 }}>
            <div className="section-title" style={{ margin: 0 }}>
              <span className="dot" /> Skill Swap
            </div>
            <button className="btn-sm btn-accent" onClick={() => setShowSwapModal(true)}>Post a Swap</button>
          </div>
          <p className="text-muted" style={{ marginBottom: 20 }}>Exchange skills with other developers in real time.</p>

          <div className="swap-grid">
            {swaps.map((swap) => {
              const creator = skillSwapCreators[swap.createdBy];
              return (
              <div className="swap-card" key={swap._id}>
                <div className="swap-user">{creator?.name || shortId(swap.createdBy)} | Rank: {creator?.rankScore?.toFixed(2) || "N/A"}</div>
                <div className="swap-row">
                  <span className="swap-tag tag-teach">Can teach: {swap.canTeach.join(", ") || "-"}</span>
                </div>
                <div className="swap-row">
                  <span className="swap-tag tag-learn">Wants to learn: {swap.wantsToLearn.join(", ") || "-"}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text2)", margin: "10px 0", lineHeight: 1.5 }}>
                  Status: {swap.status}{swap.matchedWith ? ` | Matched: ${shortId(swap.matchedWith)}` : ""}
                </p>
                {creator && (
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>
                    Exp: {creator.experienceLevel || "-"} | Skills: {creator.skills?.tech?.slice(0, 2).join(", ") || "-"}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn-sm btn-outline" onClick={() => void openSkillSwap(swap)}>
                    {swap.createdBy === currentUser._id ? "View Requests" : swap.status === "matched" && swap.matchedWith === currentUser._id ? "Open Chat" : "Open Swap"}
                  </button>
                  {swap.createdBy !== currentUser._id && swap.status === "open" && (
                    <button className="btn-sm btn-accent" onClick={() => void createSkillSwapRequest(swap._id)}>
                      Send Swap Request
                    </button>
                  )}
                </div>
              </div>
            );
            })}
            {!swaps.length && <div className="ghost-row">No skill swaps yet.</div>}
          </div>

          {selectedSkillSwap && (
            <div className="hack-card" style={{ marginTop: 18 }}>
              <div className="hack-meta" style={{ marginBottom: 8, fontWeight: 700, color: "#c9b37a" }}>
                Selected Swap Details
              </div>
              <div className="hack-card" style={{ marginBottom: 12, padding: "12px", backgroundColor: "var(--bg2)" }}>
                <div className="hack-meta" style={{ marginBottom: 8, fontWeight: 700 }}>
                  {selectedSkillSwap.createdBy === currentUser._id ? "Your Swap" : "Posted by"}
                </div>
                {skillSwapCreator ? (
                  <div>
                    <div className="hack-meta" style={{ marginBottom: 6 }}>Name: {skillSwapCreator.name}</div>
                    <div className="hack-meta" style={{ marginBottom: 6 }}>Rank Score: {skillSwapCreator.rankScore?.toFixed(2) || "N/A"}</div>
                    <div className="hack-meta" style={{ marginBottom: 6 }}>Experience: {skillSwapCreator.experienceLevel || "-"}</div>
                    <div className="hack-meta" style={{ marginBottom: 6 }}>Skills: {skillSwapCreator.skills?.tech?.join(", ") || "-"}</div>
                  </div>
                ) : (
                  <div className="hack-meta">Loading creator details...</div>
                )}
              </div>
              {selectedSkillSwap.createdBy === currentUser._id && (
                <div className="form-row" style={{ marginBottom: 12 }}>
                  <input
                    value={skillSwapRequestMessage}
                    onChange={(e) => setSkillSwapRequestMessage(e.target.value)}
                    placeholder="Message for developers who want to swap"
                  />
                </div>
              )}

              <div className="section-title" style={{ marginTop: 14, marginBottom: 12 }}>
                <span className="dot" /> Requests
              </div>

              {selectedSkillSwapRequests.map((requestItem) => {
                const requester = skillSwapRequesters[requestItem.requesterId];
                const isOwner = selectedSkillSwap.createdBy === currentUser._id;
                const isMyRequest = requestItem.requesterId === currentUser._id;
                const isAccepted = requestItem.status === "accepted";
                return (
                  <div className="hack-card" key={requestItem._id} style={{ marginBottom: 10 }}>
                    <div className="flex-between" style={{ marginBottom: 8 }}>
                      <div className="hack-meta">
                        {requester?.name ?? shortId(requestItem.requesterId)} | {requestItem.status}
                      </div>
                      {isOwner && requestItem.status === "pending" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-sm btn-accent" onClick={() => void updateSkillSwapRequest(requestItem._id, "accepted")}>Accept</button>
                          <button className="btn-sm btn-outline" onClick={() => void updateSkillSwapRequest(requestItem._id, "declined")}>Decline</button>
                        </div>
                      )}
                      {!isOwner && isAccepted && isMyRequest && (
                        <button className="btn-sm btn-accent" onClick={() => void joinSkillSwapChat(requestItem._id)}>
                          Open Chat
                        </button>
                      )}
                    </div>
                    <div className="hack-meta" style={{ marginBottom: 8 }}>Message: {requestItem.message || "-"}</div>
                    {requester && (
                      <div className="hack-meta" style={{ marginBottom: 8 }}>
                        Rank Score: {requester.rankScore?.toFixed(2) || "N/A"} | Skills: {requester.skills?.tech?.join(", ") || "-"}
                      </div>
                    )}
                    {isOwner && isAccepted && requestItem.chatRoomId && (
                      <button className="btn-sm btn-outline" onClick={() => void joinSkillSwapChat(requestItem._id)}>
                        View Chat
                      </button>
                    )}
                  </div>
                );
              })}
              {!selectedSkillSwapRequests.length && <div className="ghost-row">No requests yet.</div>}

              {selectedSkillSwapRequestId && (
                <>
                  <hr className="divider" />
                  <div className="section-title" style={{ marginBottom: 12 }}>
                    <span className="dot" /> Swap Chat
                  </div>
                  <div style={{ backgroundColor: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
                    <div style={{ minHeight: 160, maxHeight: 240, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      {skillSwapChatMessages.length === 0 ? (
                        <div className="ghost-row">No messages yet. Start the conversation.</div>
                      ) : (
                        skillSwapChatMessages.map((message, idx) => (
                          <div
                            key={`${message.timestamp}-${idx}`}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              maxWidth: "80%",
                              fontSize: 13,
                              lineHeight: 1.4,
                              alignSelf: message.fromUserId === currentUser._id ? "flex-end" : "flex-start",
                              background: message.fromUserId === currentUser._id ? "rgba(124,106,247,0.25)" : "var(--bg3)",
                              color: message.fromUserId === currentUser._id ? "var(--text)" : "var(--text2)"
                            }}
                          >
                            <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>{message.fromUserName}</div>
                            <div>{message.text}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={skillSwapChatInput}
                        onChange={(e) => setSkillSwapChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void sendSkillSwapMessage();
                        }}
                        placeholder="Say something..."
                      />
                      <button className="btn-sm btn-accent" onClick={() => void sendSkillSwapMessage()}>Send</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className={`page ${page === "stranger" ? "active" : ""}`}>
          {!strangerRoom && !strangerWaiting && (
            <div className="stranger-box" id="stranger-idle">
              <div className="section-title" style={{ justifyContent: "center", marginBottom: 8 }}>
                <span className="dot" /> Stranger Devs
              </div>
              <p className="text-muted" style={{ marginBottom: 24 }}>
                Omegle for developers. Meet random devs and network.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
                <button className="btn-primary" style={{ width: 220 }} onClick={getStrangerToken}>Get Queue Token</button>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
                <input
                  value={strangerAlias}
                  onChange={(e) => setStrangerAlias(e.target.value)}
                  placeholder="Alias"
                  style={{ maxWidth: 260 }}
                />
                <label className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={strangerAnonymous}
                    onChange={(e) => setStrangerAnonymous(e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  Anonymous
                </label>
              </div>
              <button className="btn-primary" style={{ width: 220 }} onClick={joinStrangerQueue} disabled={!strangerToken}>Find a Developer</button>
            </div>
          )}

          {strangerWaiting && (
            <div className="stranger-box" id="stranger-loading">
              <div className="connecting-anim" />
              <p style={{ color: "var(--text2)", fontSize: 14, marginTop: 8 }}>Connecting you to a random dev...</p>
              <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 8 }}>Queue size: {strangerQueueSize}</p>
              <button className="btn-secondary" style={{ marginTop: 14 }} onClick={leaveStrangerQueue}>Cancel</button>
            </div>
          )}

          {strangerRoom && (
            <div className="stranger-box" id="stranger-chat">
              <div className="stranger-card">
                <div className="profile-header">
                  <div className="p-avatar" style={{ background: "var(--accent)" }}>RT</div>
                  <div style={{ flex: 1 }}>
                    <div className="p-name">Room {shortId(strangerRoom)}</div>
                    <div className="p-role">Matched users: {strangerUsers.join(" & ") || "waiting"}</div>
                  </div>
                  <span className="p-rank">Queue: {strangerQueueSize}</span>
                </div>
              </div>
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
                <div id="stranger-messages" style={{ minHeight: 160, maxHeight: 240, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {strangerMessages.map((message, idx) => (
                    <div
                      key={`${message.timestamp}-${idx}`}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        maxWidth: "80%",
                        fontSize: 13,
                        lineHeight: 1.4,
                        alignSelf: message.fromSocket === socket.id ? "flex-end" : "flex-start",
                        background: message.fromSocket === socket.id ? "rgba(124,106,247,0.25)" : "var(--bg3)",
                        color: message.fromSocket === socket.id ? "var(--text)" : "var(--text2)"
                      }}
                    >
                      {message.text}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={strangerInput}
                    onChange={(e) => setStrangerInput(e.target.value)}
                    placeholder="Say something..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendStrangerMessage();
                    }}
                  />
                  <button className="btn-sm btn-accent" onClick={sendStrangerMessage}>Send</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    leaveStrangerQueue();
                    joinStrangerQueue();
                  }}
                >
                  Next Dev
                </button>
                <button className="btn-secondary" style={{ color: "var(--rose)", borderColor: "rgba(244,63,94,0.3)" }} onClick={leaveStrangerQueue}>
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`page ${page === "marketplace" ? "active" : ""}`}>
          <div className="flex-between" style={{ marginBottom: 24 }}>
            <div className="section-title" style={{ margin: 0 }}>
              <span className="dot" /> Task Marketplace
            </div>
            <button className="btn-sm btn-accent" onClick={() => setShowTaskModal(true)}>Post a Task</button>
          </div>
          <p className="text-muted" style={{ marginBottom: 20 }}>Post tasks, submit proposals, and complete work in real time.</p>

          <div className="tasks-grid">
            {tasks.map((task) => (
              <div className="task-card" key={task._id}>
                <div className="task-title">{task.title}</div>
                <div className="task-desc">{task.description}</div>
                <div className="task-footer">
                  <div>
                    <div className="task-price">{task.budget}</div>
                    <div className="task-by">{task.status}</div>
                  </div>
                  <button
                    className="btn-sm btn-accent"
                    onClick={() =>
                      void withError(async () => {
                        await loadProposals(task._id);
                        setSelectedTask(task._id);
                      })
                    }
                    disabled={task.status !== "open" && task.createdBy !== currentUser._id && task.assignedTo !== currentUser._id}
                  >
                    {task.createdBy === currentUser._id 
                      ? "Check Proposals" 
                      : task.status === "open" 
                        ? "Send Proposal" 
                        : task.assignedTo === currentUser._id
                          ? "View Task"
                          : task.status === "assigned"
                            ? "Task Assigned"
                            : "Task Closed"}
                  </button>
                </div>
              </div>
            ))}
            {!tasks.length && <div className="ghost-row">No tasks yet.</div>}
          </div>

          <hr className="divider" />
          <div className="section-title">
            <span className="dot" /> Task Actions
          </div>
          {!selectedTask && <div className="ghost-row">Select a task card first to take action.</div>}

          {selectedTask && (
            <div className="hack-card" style={{ marginBottom: 12 }}>
              <div className="hack-meta" style={{ marginBottom: 10 }}>
                Selected task: {selectedTaskDetails?.title ?? shortId(selectedTask)} | Status: {selectedTaskDetails?.status ?? "unknown"}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button 
                  className="btn-sm btn-outline" 
                  onClick={() => setShowTaskCreatorDetails(!showTaskCreatorDetails)}
                >
                  {showTaskCreatorDetails ? "Hide Who Posted" : "See Who Posted"}
                </button>
              </div>

              {showTaskCreatorDetails && taskCreatorDetails && (
                <div className="hack-card" style={{ marginBottom: 12, backgroundColor: "rgba(201,179,122,0.08)", borderLeft: "3px solid #c9b37a" }}>
                  <div className="hack-meta" style={{ marginBottom: 8, fontWeight: "700", color: "#c9b37a" }}>Posted by: {taskCreatorDetails.name}</div>
                  <div className="hack-meta" style={{ marginBottom: 6 }}>Rank Score: {taskCreatorDetails.rankScore?.toFixed(2) || "N/A"}</div>
                  {taskCreatorDetails.skills?.tech && taskCreatorDetails.skills.tech.length > 0 && (
                    <div className="hack-meta" style={{ marginBottom: 6 }}>Skills: {taskCreatorDetails.skills.tech.join(", ")}</div>
                  )}
                  {taskCreatorDetails.experienceLevel && (
                    <div className="hack-meta">Experience: {taskCreatorDetails.experienceLevel}</div>
                  )}
                </div>
              )}

              {canSubmitProposal && (
                <>
                  <div style={{ marginBottom: 12, fontWeight: "700", color: "#c9b37a" }}>Send Your Proposal</div>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <input value={proposalPrice} onChange={(e) => setProposalPrice(e.target.value)} placeholder="Proposal price" />
                    <input value={proposalReasoning} onChange={(e) => setProposalReasoning(e.target.value)} placeholder="Why you are fit for this task" />
                  </div>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <input value={proposalPortfolioUrl} onChange={(e) => setProposalPortfolioUrl(e.target.value)} placeholder="Portfolio URL (optional)" />
                    <input value={proposalResumeUrl} onChange={(e) => setProposalResumeUrl(e.target.value)} placeholder="Resume/CV URL (optional)" />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button
                      className="btn-sm btn-outline"
                      onClick={() => setProposalPrice((prev) => String(Math.max(1, Number(prev || "0") - 100)))}
                    >
                      Price -100
                    </button>
                    <button
                      className="btn-sm btn-outline"
                      onClick={() => setProposalPrice((prev) => String(Math.max(1, Number(prev || "0") + 100)))}
                    >
                      Price +100
                    </button>
                    <button className="btn-sm btn-accent" onClick={submitProposal}>Send Proposal</button>
                  </div>
                </>
              )}

              {!canSubmitProposal && !isSelectedTaskOwner && myProposalForSelectedTask?.status === "accepted" && (
                <div className="ghost-row">✓ Your proposal was accepted! Check your assigned work in the task details.</div>
              )}

              {!canSubmitProposal && !isSelectedTaskOwner && myProposalForSelectedTask?.status === "pending" && (
                <div className="ghost-row">Proposal sent. Wait for acceptance from task creator.</div>
              )}

              {!canSubmitProposal && !isSelectedTaskOwner && selectedTaskDetails?.status === "assigned" && !myProposalForSelectedTask && (
                <div className="ghost-row">Task already assigned to another developer.</div>
              )}

              {isSelectedTaskOwner && selectedTaskDetails?.status === "open" && (
                <div className="hack-meta" style={{ marginBottom: 10, color: "#c9b37a" }}>
                  ⏳ Waiting for proposals... ({proposals.length} received)
                </div>
              )}

              {isSelectedTaskOwner && selectedTaskDetails?.status === "assigned" && (
                <>
                  <div className="hack-meta" style={{ marginBottom: 10, color: "#c9b37a" }}>
                    ✓ Task assigned. Waiting for work submission...
                  </div>
                  <div className="hack-meta" style={{ marginBottom: 10 }}>
                    Payment: {selectedTaskDetails.paymentStatus === "escrowed" ? "Escrow funded" : "Awaiting escrow payment"}
                    {typeof selectedTaskDetails.commissionRate === "number" ? ` | Platform fee: ${selectedTaskDetails.commissionRate}%` : ""}
                  </div>
                  {selectedTaskDetails.paymentStatus !== "escrowed" && (
                    <button className="btn-sm btn-accent" onClick={fundTaskEscrow} style={{ marginBottom: 12 }}>
                      Fund Escrow Before Work
                    </button>
                  )}
                  <button 
                    className="btn-sm btn-outline" 
                    onClick={() => setShowAssignedDeveloperDetails(!showAssignedDeveloperDetails)}
                    style={{ marginBottom: 12 }}
                  >
                    {showAssignedDeveloperDetails ? "Hide Developer Details" : "View Assigned Developer"}
                  </button>
                  {showAssignedDeveloperDetails && assignedDeveloperDetails && (
                    <div className="hack-card" style={{ marginBottom: 12, backgroundColor: "rgba(201,179,122,0.08)", borderLeft: "3px solid #c9b37a" }}>
                      <div className="hack-meta" style={{ marginBottom: 8, fontWeight: "700", color: "#c9b37a" }}>Assigned to: {assignedDeveloperDetails.name}</div>
                      <div className="hack-meta" style={{ marginBottom: 6 }}>Rank Score: {assignedDeveloperDetails.rankScore?.toFixed(2) || "N/A"}</div>
                      {assignedDeveloperDetails.skills?.tech && assignedDeveloperDetails.skills.tech.length > 0 && (
                        <div className="hack-meta" style={{ marginBottom: 6 }}>Skills: {assignedDeveloperDetails.skills.tech.join(", ")}</div>
                      )}
                      {assignedDeveloperDetails.experienceLevel && (
                        <div className="hack-meta">Experience: {assignedDeveloperDetails.experienceLevel}</div>
                      )}
                    </div>
                  )}
                </>
              )}

              {isSelectedTaskAssignee && selectedTaskDetails?.status === "assigned" && (
                <>
                  <div className="hack-meta" style={{ marginBottom: 10 }}>
                    Payment: {selectedTaskDetails.paymentStatus === "escrowed" ? "Escrow funded" : "Waiting for owner to fund escrow"}
                    {typeof selectedTaskDetails.commissionRate === "number" ? ` | Platform fee: ${selectedTaskDetails.commissionRate}%` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button className="btn-sm btn-outline" onClick={submitTaskWork} disabled={selectedTaskDetails.paymentStatus !== "escrowed"}>Submit Work</button>
                  </div>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <input
                      value={extensionMessage}
                      onChange={(e) => setExtensionMessage(e.target.value)}
                      placeholder="Request extended deadline message"
                    />
                  </div>
                  <button className="btn-sm btn-outline" onClick={requestTaskExtension}>Request Deadline Extension</button>
                </>
              )}

              {isSelectedTaskOwner && selectedTaskDetails?.extensionRequestMessage && (
                <div className="hack-meta" style={{ marginBottom: 10 }}>
                  Extension request: {selectedTaskDetails.extensionRequestMessage}
                </div>
              )}

              {isSelectedTaskOwner && selectedTaskDetails?.status === "submitted" && (
                <>
                  <div className="hack-meta" style={{ marginBottom: 10 }}>
                    Release payout: {typeof selectedTaskDetails.payoutAmount === "number" ? `$${selectedTaskDetails.payoutAmount.toFixed(2)}` : "calculated on release"}
                    {typeof selectedTaskDetails.commissionAmount === "number" ? ` | Commission: $${selectedTaskDetails.commissionAmount.toFixed(2)}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={completionRating} onChange={(e) => setCompletionRating(e.target.value)} placeholder="Rating 1-5" style={{ maxWidth: 160 }} />
                    <button className="btn-sm btn-outline" onClick={completeTask}>Pay Developer & Complete</button>
                  </div>
                </>
              )}

              {(isSelectedTaskOwner || isSelectedTaskAssignee) && selectedTaskDetails && (["assigned", "submitted"].includes(selectedTaskDetails.status)) && (
                <>
                  <hr style={{ margin: "12px 0", borderColor: "rgba(255,255,255,0.1)" }} />
                  <div style={{ marginBottom: 12, fontWeight: "700", color: "#c9b37a" }}>💬 Messages</div>
                  <div style={{ 
                    maxHeight: 200, 
                    overflowY: "auto", 
                    backgroundColor: "rgba(0,0,0,0.2)", 
                    padding: 10, 
                    borderRadius: 4, 
                    marginBottom: 10,
                    minHeight: 60
                  }}>
                    {taskMessages.length === 0 ? (
                      <div className="ghost-row">No messages yet. Start a conversation!</div>
                    ) : (
                      taskMessages.map((msg, idx) => (
                        <div key={idx} style={{ marginBottom: 8, fontSize: 12 }}>
                          <div style={{ color: "#c9b37a", fontWeight: "600" }}>{msg.senderName}</div>
                          <div style={{ color: "#e0e0e0" }}>{msg.message}</div>
                          <div style={{ color: "#888", fontSize: 10 }}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <input 
                      value={taskMessageInput}
                      onChange={(e) => setTaskMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && sendTaskMessage()}
                      placeholder="Type a message..."
                    />
                  </div>
                  <button className="btn-sm btn-accent" onClick={sendTaskMessage}>Send Message</button>
                </>
              )}
            </div>
          )}

          {selectedTask && (
            <div>
              <div style={{ marginBottom: 12, marginTop: 12, fontWeight: "700", color: "#c9b37a" }}>All Proposals</div>
              {proposals.map((proposal) => (
                <div className="hack-card" style={{ marginBottom: 10 }} key={proposal._id}>
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <div className="hack-meta">
                      {proposalDeveloperDetails[proposal.developerId]
                        ? proposalDeveloperDetails[proposal.developerId].name
                        : shortId(proposal.developerId)} | {proposal.price} | {proposal.status}
                    </div>
                    {proposal.status === "pending" && isSelectedTaskOwner && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn-sm btn-accent" onClick={() => updateProposal(proposal._id, "accepted")}>Accept</button>
                        <button className="btn-sm btn-outline" onClick={() => updateProposal(proposal._id, "declined")}>Decline</button>
                      </div>
                    )}
                  </div>
                  {proposalDeveloperDetails[proposal.developerId] && (
                    <div className="hack-card" style={{ marginBottom: 8, backgroundColor: "rgba(201,179,122,0.08)", borderLeft: "3px solid #c9b37a" }}>
                      <div className="hack-meta" style={{ marginBottom: 6, fontWeight: "700", color: "#c9b37a" }}>
                        Proposal by: {proposalDeveloperDetails[proposal.developerId].name}
                      </div>
                      <div className="hack-meta" style={{ marginBottom: 6 }}>Rank Score: {proposalDeveloperDetails[proposal.developerId].rankScore?.toFixed(2) || "N/A"}</div>
                      {proposalDeveloperDetails[proposal.developerId].skills?.tech && proposalDeveloperDetails[proposal.developerId].skills!.tech!.length > 0 && (
                        <div className="hack-meta" style={{ marginBottom: 6 }}>
                          Skills: {proposalDeveloperDetails[proposal.developerId].skills!.tech!.join(", ")}
                        </div>
                      )}
                      {proposalDeveloperDetails[proposal.developerId].experienceLevel && (
                        <div className="hack-meta">Experience: {proposalDeveloperDetails[proposal.developerId].experienceLevel}</div>
                      )}
                    </div>
                  )}
                  <div className="hack-meta" style={{ marginBottom: 8 }}>Reason: {proposal.reasoning}</div>
                  <div className="hack-meta">
                    Portfolio: {proposal.portfolioUrl ? proposal.portfolioUrl : "-"} | Resume/CV: {proposal.resumeUrl ? proposal.resumeUrl : "-"}
                  </div>
                </div>
              ))}
              {!proposals.length && <div className="ghost-row">No proposals for selected task.</div>}
            </div>
          )}
        </div>

        <div className={`page ${page === "ranking" ? "active" : ""}`}>
          <div className="section-title">
            <span className="dot" /> Global Rankings
          </div>
          <div className="hack-card" style={{ marginBottom: 16 }}>
            <div className="hack-meta" style={{ marginBottom: 8, fontWeight: 700, color: "#c9b37a" }}>
              Your Ranking Score: {currentUser.rankScore} pts
            </div>
            <div className="hack-meta" style={{ marginBottom: 10 }}>
              This score changes after GitHub sync, task ratings, hackathon activity, and skill swap activity.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <div className="hack-card" style={{ margin: 0 }}>
                <div className="hack-meta" style={{ marginBottom: 4, fontWeight: 700 }}>GitHub</div>
                <div className="hack-meta">{rankingBreakdown.githubScore}% influence</div>
                <div className="hack-meta" style={{ fontSize: 12 }}>Commits: {rankingBreakdown.githubCommits} | PRs: {rankingBreakdown.githubPullRequests} | Repos: {rankingBreakdown.githubRepos}</div>
              </div>
              <div className="hack-card" style={{ margin: 0 }}>
                <div className="hack-meta" style={{ marginBottom: 4, fontWeight: 700 }}>Task Ratings</div>
                <div className="hack-meta">{rankingBreakdown.taskRatingScore}% influence</div>
                <div className="hack-meta" style={{ fontSize: 12 }}>Average rating: {rankingBreakdown.ratingSummary ? rankingBreakdown.ratingSummary.toFixed(1) : "N/A"}/5</div>
              </div>
              <div className="hack-card" style={{ margin: 0 }}>
                <div className="hack-meta" style={{ marginBottom: 4, fontWeight: 700 }}>Hackathons</div>
                <div className="hack-meta">{rankingBreakdown.hackathonScore}% influence</div>
                <div className="hack-meta" style={{ fontSize: 12 }}>History entries: {currentUser.hackathonHistory?.length ?? 0}</div>
              </div>
              <div className="hack-card" style={{ margin: 0 }}>
                <div className="hack-meta" style={{ marginBottom: 4, fontWeight: 700 }}>Skill Swaps</div>
                <div className="hack-meta">{rankingBreakdown.skillSwapScore}% influence</div>
                <div className="hack-meta" style={{ fontSize: 12 }}>Swap score: {rankingBreakdown.skillSwapRaw.toFixed(2)}</div>
              </div>
            </div>
          </div>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--card-radius)", overflow: "hidden" }}>
            <table className="rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Developer</th>
                  <th>Role</th>
                  <th>Points</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, index) => {
                  const max = leaderboard[0]?.points || 1;
                  const width = Math.round((row.points / max) * 100);
                  const rankClass = index < 3 ? `rank-${index + 1}` : "";
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className={`rank-num ${rankClass}`}>{index + 1}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: hashColor(row.name),
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#fff",
                              flexShrink: 0
                            }}
                          >
                            {initials(row.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              {row.name}
                              {row.isYou ? <span style={{ fontSize: 11, color: "var(--accent2)", marginLeft: 6 }}>(you)</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--text2)", fontSize: 13 }}>{row.role}</td>
                      <td>
                        <span style={{ color: "var(--gold)", fontWeight: 600 }}>* {row.points}</span>
                      </td>
                      <td>
                        <div className="points-bar-wrap">
                          <div className="points-bar" style={{ width: `${width}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!leaderboard.length && <div className="ghost-row">No ranking data yet.</div>}
          </div>

          <hr className="divider" />
          <div className="section-title">
            <span className="dot" /> Real-time Event Feed
          </div>
          <div>
            {events.map((event, index) => (
              <div className="hack-card" style={{ marginBottom: 10 }} key={`${event}-${index}`}>
                <div className="hack-meta">{event}</div>
              </div>
            ))}
            {!events.length && <div className="ghost-row">No events yet.</div>}
          </div>
        </div>

        <div className={`page ${page === "profile" ? "active" : ""}`}>
          <div className="profile-page-card">
            <div className="profile-big-avatar" style={{ background: hashColor(currentUser.name) }}>{initials(currentUser.name)}</div>
            <div className="profile-big-name">{currentUser.name}</div>
            <div className="profile-big-sub">{currentUser.email} | Rank {currentUser.rankScore}</div>
            <hr className="divider" />
            <div className="profile-section">
              <div className="profile-section-label">Skills</div>
              <div className="skills-grid">
                {profileSkills.map((skill) => (
                  <span className="skill-chip selected" key={skill}>{skill}</span>
                ))}
                {!profileSkills.length && <span className="text-muted">No skills added yet.</span>}
              </div>
            </div>
            <div className="profile-section">
              <div className="profile-section-label">Details</div>
              <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 2 }}>
                GitHub: {currentUser.githubUrl || "Not set"}
                <br />
                LinkedIn: {currentUser.linkedinUrl || "Not set"}
                <br />
                Profile Completed: {currentUser.profileCompleted ? "Yes" : "No"}
              </div>
            </div>
            <hr className="divider" />
            <button className="btn-secondary" onClick={openEditProfile}>Edit Profile</button>
            <button className="btn-secondary" style={{ marginLeft: 8, color: "var(--rose)", borderColor: "rgba(244,63,94,0.3)" }} onClick={logout}>
              Logout
            </button>
            <button className="btn-secondary" style={{ marginLeft: 8 }} onClick={completeProfile}>Complete Profile</button>
          </div>
        </div>
      </div>

      {showCreateTeamModal && (
        <div className="modal-overlay open" onClick={() => setShowCreateTeamModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              Create a Team
              <button className="modal-close" onClick={() => setShowCreateTeamModal(false)}>x</button>
            </div>
            <div className="form-group">
              <label>Team Name</label>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team Nexus" />
            </div>
            <div className="form-group">
              <label>Hackathon</label>
              <input value={teamHackathon} onChange={(e) => setTeamHackathon(e.target.value)} placeholder="HackIndia 2025" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} placeholder="What are you building?" />
            </div>
            <div className="form-group">
              <label>Roles Needed</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  value={teamRoleInput}
                  onChange={(e) => setTeamRoleInput(e.target.value)}
                  placeholder="Type custom role (ex: blockchain dev)"
                  list="team-role-suggestions"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomTeamRole();
                    }
                  }}
                />
                <button type="button" className="btn-sm btn-accent" onClick={addCustomTeamRole}>Add</button>
                <datalist id="team-role-suggestions">
                  {TEAM_ROLE_OPTIONS.map((role) => (
                    <option value={role} key={`role-suggest-${role}`} />
                  ))}
                </datalist>
              </div>
              <div className="skills-grid">
                {[...new Set([...TEAM_ROLE_OPTIONS, ...teamRoles])].map((role) => (
                  <span
                    key={role}
                    className={`skill-chip ${teamRoles.includes(role) ? "selected" : ""}`}
                    onClick={() => toggleTeamRole(role)}
                    role="button"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
            <button className="btn-primary" onClick={createTeam} disabled={isBusy}>Create Team & Find Matches</button>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="modal-overlay open" onClick={() => setShowJoinModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              Join a Team
              <button className="modal-close" onClick={() => setShowJoinModal(false)}>x</button>
            </div>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Select the team you want to join. Teams are ranked by compatibility and your request goes to that team&apos;s creator.
            </p>
            <div className="hackathons-grid" style={{ gridTemplateColumns: "1fr", marginBottom: 16 }}>
              {rankedOpenTeams.map((team) => (
                <div
                  className="hack-card"
                  key={`join-${team.teamId}`}
                  style={{ borderColor: selectedTeam === team.teamId ? "var(--accent2)" : undefined }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div>
                      <div className="hack-name">{team.teamName}</div>
                      <div className="hack-meta">{team.hackathon}</div>
                      <div className="hack-meta">Roles needed: {team.requiredRoles?.length ? team.requiredRoles.join(", ") : "Not specified"}</div>
                      <div className="hack-meta">Creator approval required</div>
                    </div>
                    <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                      <span className="match-pct">{team.matchPercent}% match</span>
                      <button className="btn-sm btn-outline" onClick={() => setSelectedTeam(team.teamId)}>
                        {selectedTeam === team.teamId ? "Selected" : "Select"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!rankedOpenTeams.length && (
                <div className="ghost-row">
                  No ranked teams available yet. Create a profile or refresh teams.
                </div>
              )}
            </div>
            <div className="hack-card" style={{ marginBottom: 16 }}>
              <div className="hack-meta">Selected team: {selectedTeamDetails ? selectedTeamDetails.name : "None"}</div>
            </div>
            <button className="btn-primary" onClick={joinSelectedTeam} disabled={!selectedTeam || isBusy}>
              Send Request to Team Creator
            </button>
          </div>
        </div>
      )}

      {showSwapModal && (
        <div className="modal-overlay open" onClick={() => setShowSwapModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              Post a Skill Swap
              <button className="modal-close" onClick={() => setShowSwapModal(false)}>x</button>
            </div>
            <div className="form-group">
              <label>I can teach</label>
              <input value={teachInput} onChange={(e) => setTeachInput(e.target.value)} placeholder="React, Node.js" />
            </div>
            <div className="form-group">
              <label>I want to learn</label>
              <input value={learnInput} onChange={(e) => setLearnInput(e.target.value)} placeholder="UI Design, Figma" />
            </div>
            <button className="btn-primary" onClick={createSkillSwap} disabled={isBusy}>Post Swap Request</button>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="modal-overlay open" onClick={() => setShowTaskModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              Post a Task
              <button className="modal-close" onClick={() => setShowTaskModal(false)}>x</button>
            </div>
            <div className="form-group">
              <label>Task Title</label>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Build a landing page" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Describe what you need in detail..." />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Budget</label>
                <input value={taskBudget} onChange={(e) => setTaskBudget(e.target.value)} type="number" />
              </div>
            </div>
            <button className="btn-primary" onClick={createTask} disabled={isBusy}>Post Task</button>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="modal-overlay open" onClick={() => setShowProfileModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              Edit Profile
              <button className="modal-close" onClick={() => setShowProfileModal(false)}>x</button>
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="form-group">
              <label>Primary Role</label>
              <input value={editRole} onChange={(e) => setEditRole(e.target.value)} placeholder="Full Stack Developer" />
            </div>
            <div className="form-group">
              <label>Experience Level</label>
              <select value={editExperience} onChange={(e) => setEditExperience(e.target.value as "beginner" | "intermediate" | "advanced")}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="form-group">
              <label>Skills (comma separated)</label>
              <textarea value={editSkillCsv} onChange={(e) => setEditSkillCsv(e.target.value)} placeholder="react, node, mongodb" />
            </div>
            <div className="form-group">
              <label>Interests (comma separated)</label>
              <textarea value={editInterestsCsv} onChange={(e) => setEditInterestsCsv(e.target.value)} placeholder="fintech, healthcare" />
            </div>
            <div className="form-group">
              <label>Hackathon History (comma separated)</label>
              <textarea value={editHackathonCsv} onChange={(e) => setEditHackathonCsv(e.target.value)} placeholder="Smart India Hackathon 2025, HackIndia 2025" />
            </div>
            <div className="form-group">
              <label>GitHub URL</label>
              <input value={editGithub} onChange={(e) => setEditGithub(e.target.value)} placeholder="github.com/username" />
            </div>
            <div className="form-group">
              <label>LinkedIn URL</label>
              <input value={editLinkedin} onChange={(e) => setEditLinkedin(e.target.value)} placeholder="linkedin.com/in/name" />
            </div>
            <button className="btn-primary" onClick={saveProfile} disabled={isBusy}>Save Changes</button>
          </div>
        </div>
      )}

      {error ? <p className="global-error">{error}</p> : null}
    </>
  );
}
