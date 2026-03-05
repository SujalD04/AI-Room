<div align="center">
  <h1>AIRoom</h1>
  <p>A multiplayer, real-time collaboration workspace with branching chat, built-in AI assistance, and high-performance WebRTC voice channels.</p>
</div>

---

## 🚀 Features

### 💬 Branching Multiplayer Chat
- Built on a **Directed Acyclic Graph (DAG)** message architecture, allowing users to "branch" conversations off any message infinitely without losing context.
- Real-time multiplayer synchronization via **Socket.IO**.
- Presence indicators, read receipts, and live typing indicators.

### 🤖 "Bring Your Own Key" (BYOK) AI Assistant
- Integrated AI participants that answer queries directly in chat.
- Supports multiple providers: **OpenAI, Anthropic, Gemini, Groq, DeepSeek, Together, OpenRouter**.
- Thread-level model selection: switch between GPT-4o, Claude 3.5 Sonnet, etc., on a per-conversation basis.
- Server-side rate limiting and abuse prevention.

### 🎙️ Scalable Voice & Video (Mediasoup SFU)
- Premium, low-latency audio and screen sharing powered by a custom **Mediasoup Selective Forwarding Unit (SFU)** backend.
- Highly optimized performance — runs on an internal Worker pool to handle hundreds of concurrent participants.
- Explicit participant tracking, mute indicators, and live layout grids.

### 📝 Collaborative Notes
- Integrated workspace notes that update in real time.
- Embedded Todo lists for task management.

### 🛡️ Secure Workspace Architecture
- Role-based Access Control (Host vs. Member permissions).
- Hosts can delete rooms, threads, and moderate messages.
- Members completely own their custom API keys, ensuring no leakage of sensitive billing information.

---

## 🏗️ Technology Stack

**Frontend (`apps/web`)**
- [Next.js](https://nextjs.org/) (App Router, React 18)
- [Zustand](https://github.com/pmndrs/zustand) (Client-side state management)
- [Socket.IO Client](https://socket.io/) (Real-time synchronization)
- [Mediasoup Client](https://mediasoup.org/) (WebRTC endpoints)

**Backend (`apps/server`)**
- [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
- [Socket.IO Server](https://socket.io/) (Handling real-time presence and updates)
- [Mediasoup](https://mediasoup.org/) (C++ based media router for voice/video)
- [Prisma](https://www.prisma.io/) + [PostgreSQL](https://www.postgresql.org/) (Database & ORM)
- [Vercel AI SDK](https://sdk.vercel.ai/docs) (LLM abstractions and streaming)

---

## 🛠️ Local Development

### Prerequisites
- Node.js (v18+)
- PostgreSQL database
- pnpm or npm

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/AIRoom.git
   cd AIRoom
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create `.env` files in both `apps/server` and `apps/web`.

   **`apps/server/.env`:**
   ```env
   DATABASE_URL="postgresql://user:pass@localhost:5432/airoom"
   JWT_SECRET="your-super-secret-key"
   FRONTEND_URL="http://localhost:3000"
   MEDIASOUP_LISTEN_IP="0.0.0.0"     # For local testing
   MEDIASOUP_ANNOUNCED_IP="127.0.0.1" # The IP your client will connect to
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=465
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-app-password"
   ```

   **`apps/web/.env.local`:**
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:4000"
   ```

4. **Initialize Database:**
   ```bash
   cd apps/server
   npx prisma migrate dev
   ```

5. **Start Development Servers:**
   *Note: Due to the monorepo structure, open two terminal windows.*
   
   Terminal 1 (Backend):
   ```bash
   cd apps/server
   npm run dev
   ```
   
   Terminal 2 (Frontend):
   ```bash
   cd apps/web
   npm run dev
   ```

---

## ☁️ Deployment Requirements

Deploying AIRoom requires specialized networking support due to the Mediasoup SFU handling raw WebRTC traffic.

- **Frontend:** Vercel, Netlify, or any static provider.
- **Database:** Supabase, Neon, or managed PostgreSQL.
- **Server:** A Linux VPS with control over Security Groups/Firewalls. Standard serverless platforms (like AWS Lambda or Vercel Functions) **cannot** run Mediasoup.
  - **Recommended:** Oracle Cloud (Always Free ARM Instance), AWS EC2, or DigitalOcean Droplet.
  - **Networking:** You must expose TCP port `4000` (for API/Socket.io) and UDP ports `40000-49999` (for Mediasoup WebRTC).

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).
