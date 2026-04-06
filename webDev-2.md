# [Web Development - Project 2]

## 🚀 Project Title
DevMatch

## 🧠 Problem Statement
Hackathon participants, especially college students, struggle to find the right teammates quickly. Existing tools do not reliably match people based on technical skills, role fit, experience level, and proof of work.

## 🎯 Objective
Build a real-time developer collaboration platform that:
- Matches users to teams based on weighted role-fit scoring.
- Ranks users with transparent signals (GitHub activity, hackathon history, platform reputation).
- Helps users collaborate, network, and grow through features beyond matching.

## 👥 Target Users
- College students
- First-time hackathon participants
- Early-stage startup founders
- Freelance developers

## 🔐 User Onboarding & Profile Setup
### Sign-up / Login
- Clean authentication flow with email/password or OAuth (optional in MVP).
- New users are guided through profile completion before entering matching.

### Profile Fields
Most profile fields are required to ensure match quality.

- Technical skills:
	- Languages: Java, C++, Python, JavaScript, etc.
	- Frameworks/tools: React, Node.js, Django, etc.
	- Domain expertise: Frontend, Backend, AI/ML, DevOps, UI/UX
- Soft skills and preferred roles:
	- Communication, pitching, leadership, product thinking, project management
- Hackathon experience:
	- Hackathons attended, wins, project categories
	- Interest areas: EdTech, FinTech, Healthcare, etc.
- External profiles:
	- GitHub profile URL (for contribution-based scoring)
	- LinkedIn profile URL

### Profile Editing Policy
- Users can edit profile anytime.
- Ranking-critical fields can be rate-limited (for example, daily/weekly update window) to prevent abuse.

## 🏅 Ranking System
Each user gets a ranking score that influences visibility in suggestions and search.

### Ranking Inputs
- GitHub contribution history:
	- Commits, PRs, active repositories, consistency
- Verified hackathon participation and outcomes
- Task Marketplace ratings
- Skill Swap activity quality and engagement

### Example Weighted Formula (Configurable)
`rankScore = 0.35 * githubScore + 0.25 * hackathonScore + 0.20 * taskRatingScore + 0.20 * skillSwapScore`

## ⚙️ Core Feature — Hackathon Team Matching (MVP Priority)
This must work accurately and update in real time.

### MVP A: Create a Team
- User selects a hackathon.
- User enters team name and short description.
- User adds required roles (for example: Backend Developer, UI Designer, Pitching Lead).
- System returns ranked, real user suggestions immediately.
- Team creator sends join requests to selected users.

### MVP B: Join a Team
- User browses open teams.
- Teams are ranked by role/skill compatibility with the user.
- Teams with `>= 60%` to `65%` fit appear first.
- User sends join request; team leader accepts/declines.

### Real-time Expectations
- Suggestions refresh instantly when profile/team requirements change.
- Team dashboard updates live when members join/leave.
- No full page reload needed.

## 🌟 Advanced Features (Top Team Scope)
### 1) Skill Swap (ScreenShaper)
Peer-learning module where users exchange skills.

Example:
- User A: teaches Coding, wants UI Design.
- User B: teaches UI Design, wants Coding.

Flow:
- Post swap request.
- Find compatible swap partner.
- Connect via in-app chat.
- Optional built-in video call integration.

### 2) Find Stranger Devs
Omegle-style random networking for developers.
- Random matching by background/interests.
- Anonymous or named mode.
- Useful for networking and startup ideation.

### 3) Task Marketplace
Developer micro-task board (similar model to Fiverr/Hunstop).

Flow:
- Client posts task with budget and requirements.
- Developers submit proposals (price + approach).
- Client selects developer.
- Work is submitted in-platform.
- Quality check and payment release.
- Client rating updates developer ranking score.

## 🔄 User Flow (MVP)
1. Sign up and complete profile
2. System computes initial rank and skill vectors
3. User either creates a team or joins one
4. Real-time matching and join request exchange
5. Team dashboard collaboration starts

## 🏗️ System Design Overview
### High-Level Components
- Frontend client (web)
- Backend API service
- Matching engine (weighted scoring)
- Real-time gateway (WebSockets / Socket.io)
- Database (users, teams, requests, events)
- Caching layer for GitHub and match results

### Real-time Events (Examples)
- `team.created`
- `team.requirements.updated`
- `match.suggestions.updated`
- `team.join.requested`
- `team.member.added`

## 🔌 API Design (Initial)
### Auth & Profile
- `POST /auth/signup`
- `POST /auth/login`
- `GET /users/:id`
- `PATCH /users/:id`

### Team Matching
- `POST /teams`
- `GET /teams/open`
- `GET /teams/:id/suggestions`
- `POST /teams/:id/join-requests`
- `PATCH /join-requests/:id` (accept/decline)

### Ranking
- `GET /users/:id/rank`
- `POST /users/:id/rank/refresh`

## 🗄️ Database Schema (Core)
### User
- `id`
- `name`, `email`, `passwordHash`
- `skillsTech[]`, `skillsSoft[]`
- `preferredRoles[]`
- `experienceLevel`
- `hackathonHistory[]`
- `interests[]`
- `githubUrl`, `linkedinUrl`
- `githubMetrics` (cached)
- `rankScore`
- `createdAt`, `updatedAt`

### Team
- `id`
- `hackathonId`
- `name`, `description`
- `createdBy`
- `requiredRoles[]`
- `members[]`
- `status` (open/closed)
- `createdAt`, `updatedAt`

### JoinRequest
- `id`
- `teamId`
- `userId`
- `matchPercent`
- `status` (pending/accepted/declined)
- `createdAt`, `updatedAt`

## ⚠️ Engineering Challenges
- Matching accuracy:
	- Use weighted scoring by role category instead of plain keyword match.
- Real-time synchronization:
	- Keep team and suggestion state consistent across concurrent actions.
- GitHub API limits:
	- Cache contribution data and refresh periodically.
- Abuse prevention:
	- Protect ranking inputs from manipulation.

## 🧪 Edge Cases
- Sparse user base:
	- Show best partial matches with visible match percentage.
- New users with little history:
	- Bootstrap score using declared skills + onboarding signals.
- Stale external data:
	- Mark last sync time for GitHub metrics.
- Concurrent accepts:
	- Enforce transactional checks so teams do not overfill.

## 🧰 Suggested Tech Stack
- Frontend: React + TypeScript
- Backend: Node.js + Express
- Real-time: Socket.io
- Database: MongoDB or PostgreSQL
- Cache/queue (optional): Redis
- Auth: JWT

## 📊 Evaluation Criteria
- Innovation
- System Design
- Code Quality
- Completeness
- UX

## 📦 Deliverables (Mandatory)
- Source code
- README with setup and run instructions
- Architecture diagram
- API documentation (basic)

## ⏱️ Constraints
- 24-hour hackathon build window
- MVP-first execution
- Real users only in suggestions (no placeholder matches)

## ✅ MVP Scope Lock (Recommended)
Ship these first:
- Auth + profile setup
- Team creation/join request flows
- Real-time ranked matching suggestions
- Basic rank score display

Then add:
- Chat
- Skill Swap
- Marketplace
- Stranger Dev networking

## 💡 Bonus Ideas
- Explainable match scores ("why this person matches")
- Team chemistry estimator (skill diversity + role balance)
- Smart fallback recommendations when user pool is low

## 🛠️ Full Build Plan (Do Everything You Requested)
This section converts the idea into an execution checklist so your team can deliver MVP first, then advanced modules.

### Phase 1: Foundation Setup (Hour 0 to 2)
- [ ] Create frontend app (React + TypeScript)
- [ ] Create backend app (Node + Express + TypeScript)
- [ ] Configure database (MongoDB/PostgreSQL)
- [ ] Add Socket.io server and client setup
- [ ] Add auth base (JWT, password hashing, middleware)
- [ ] Create shared env config and validation
- [ ] Setup folders:
	- frontend: pages, components, services, sockets, utils
	- backend: modules, routes, controllers, services, models, events

### Phase 2: Auth + Profile (Hour 2 to 6)
- [ ] Build sign-up page
- [ ] Build login page
- [ ] Build profile completion wizard
- [ ] Validate required profile fields
- [ ] Save technical skills and soft skills arrays
- [ ] Save GitHub and LinkedIn URLs
- [ ] Add profile edit policy (daily or weekly for score-critical fields)

### Phase 3: Ranking Engine (Hour 6 to 8)
- [ ] Create ranking service
- [ ] Implement weighted rank formula
- [ ] Add rank refresh endpoint
- [ ] Cache GitHub metrics in DB
- [ ] Store last GitHub sync timestamp
- [ ] Add fallback rank path for new users

### Phase 4: Core Matching MVP (Hour 8 to 14)
- [ ] Team creation API (hackathon, team details, required roles)
- [ ] Team listing API (open teams only)
- [ ] Build match scoring for user to team and team to user
- [ ] Return top ranked candidates with match percentage
- [ ] Show partial matches when user pool is low
- [ ] Add join request flow (send, accept, decline)
- [ ] Add transaction safety to avoid overfilling teams

### Phase 5: Real-time Layer (Hour 14 to 17)
- [ ] Emit live events for team creation and role updates
- [ ] Emit join request events
- [ ] Emit member added/removed events
- [ ] Update suggestions without page refresh
- [ ] Add reconnect handling for dropped sockets

### Phase 6: Team Dashboard UX (Hour 17 to 19)
- [ ] Team dashboard page with live member list
- [ ] Join request inbox for team leaders
- [ ] Match explanation chips (role fit, skill fit, score)
- [ ] Loading/empty/error states

### Phase 7: Advanced Features (Hour 19 to 23)
- [ ] Skill Swap posting and matching
- [ ] In-app chat for swap users
- [ ] Basic video call integration placeholder or provider SDK
- [ ] Stranger Dev random match room (anonymous or named)
- [ ] Task marketplace:
	- post task
	- submit proposal
	- accept proposal
	- submit delivery
	- rate developer

### Phase 8: Finalization (Hour 23 to 24)
- [ ] Seed data for demo users, teams, and requests
- [ ] Add README setup and run guide
- [ ] Add architecture diagram
- [ ] Add API docs summary
- [ ] Run smoke test of full user flow

## ✅ Definition of Done (Per Module)
### Auth/Profile Done When
- Users can sign up, login, and complete profile.
- Required fields are enforced.
- Profile persists and can be edited by policy.

### Matching Done When
- Team suggestions and open team rankings are visible.
- Match percent is shown for each result.
- Join request flow completes successfully.
- Suggestions update in real time.

### Ranking Done When
- Rank is visible on profile.
- Rank updates after profile and activity changes.
- GitHub data is cached and not fetched on every request.

### Advanced Done When
- Skill Swap can create and match requests.
- Stranger Dev can connect two random users.
- Task marketplace supports post to proposal to rating flow.

## 🧮 Matching Logic Blueprint (Simple and Accurate)
Use weighted role-aware scoring instead of plain keyword overlap.

`matchPercent = 0.45 * roleSkillFit + 0.20 * experienceFit + 0.15 * domainFit + 0.10 * availabilityFit + 0.10 * rankFit`

Rules:
- Hard fail if required role has zero related skill match.
- Boost if user has verified hackathon history in same domain.
- Penalize stale/incomplete profiles.
- If sparse users, lower threshold gradually but always show percent.

## 🧪 Test Checklist (Must Run Before Demo)
- [ ] Sign-up and login success/failure paths
- [ ] Profile validation and edit policy enforcement
- [ ] Team creation and open team listing
- [ ] Suggestions sorted by match percent
- [ ] Join request accept/decline and dashboard updates
- [ ] Concurrent join requests do not overfill team
- [ ] Socket reconnect restores live updates
- [ ] Ranking recalculation reflects activity changes

## 📌 Team Role Split (For Fast Hackathon Delivery)
- Member 1 (Backend): Auth, profile APIs, ranking service
- Member 2 (Backend + Realtime): Matching APIs, join flow, Socket.io events
- Member 3 (Frontend): Auth UI, profile UI, team and match screens
- Member 4 (Frontend + QA): Dashboard polish, advanced modules, test pass

## 🚨 Scope Guardrail
If time gets tight, lock to this demo-safe sequence:
1. Auth and profile
2. Team create and join
3. Real-time match suggestions
4. Rank display
5. One advanced feature only (Skill Swap or Task Marketplace)
