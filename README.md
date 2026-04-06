# DevMatch

Real-time developer collaboration platform for hackathons.

This repository now includes:

- Frontend: React + Vite + TypeScript
- Backend: Express + Socket.io + TypeScript
- Database: MongoDB via Mongoose
- Auth: JWT + bcrypt password hashing
- Realtime: team/join/task/skill-swap event streams

## Core Features Implemented

- Sign up, login, JWT auth, current-user endpoint
- Profile completion with rank-critical update lock window
- Ranking refresh and rank retrieval
- Team creation and open-team listing
- Team suggestion scoring with weighted role-fit matching
- Join request workflow with leader accept/decline
- Overfill safety for team acceptance path
- Skill Swap post and auto-match flow
- Task Marketplace post/proposal/accept/submit/complete flow
- Stranger-dev queue token endpoint and socket room join events

## Local Setup

### 1) Backend

1. Go to backend directory.
2. Install dependencies.
3. Copy .env.example to .env.
4. Set MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN.
5. Start development server.

Backend commands:

- npm install
- npm run dev

Default backend URL: http://localhost:4000

### 2) Frontend

1. Go to frontend directory.
2. Install dependencies.
3. Copy .env.example to .env.
4. Set VITE_API_URL to backend URL.
5. Start development server.

Frontend commands:

- npm install
- npm run dev

Default frontend URL: http://localhost:5173

## Deployment Plan

### Backend on Render

- render.yaml is already added at repository root.
- Create a Render Web Service from this repo.
- Render root directory: backend (already configured in render.yaml).
- Add env vars in Render dashboard:
   - CLIENT_ORIGIN = your Vercel frontend URL
   - MONGODB_URI = your MongoDB Atlas connection string
   - JWT_SECRET = strong secret

### Frontend on Vercel

- vercel.json is added in frontend directory.
- Import repository in Vercel.
- Set project root directory to frontend.
- Add env var:
   - VITE_API_URL = your Render backend URL

### MongoDB Atlas

- Create cluster and database named devmatch.
- Add database user and password.
- Allow network access for Render/Vercel IP strategy (or 0.0.0.0/0 for hackathon speed with caution).
- Put Atlas connection string into Render MONGODB_URI.

## Important Realtime Notes

- Socket.io CORS uses CLIENT_ORIGIN.
- CLIENT_ORIGIN can hold multiple comma-separated origins.
- Keep frontend and backend origins in sync after deployment.
