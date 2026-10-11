<h1 align="center">LinkedUp</h1>

<p align="center">
  <strong>Professional connections, without the BS.</strong><br>
  The antithesis of LinkedIn – real-time, genuine professional connections via sleek UI, effective AI-powered smart matching, and live voice/video calls.<br>
<!--   <a href="https://devpost.com/software/linkedup-d5slpu?ref_content=user-portfolio&ref_feature=in_progress">HackTAMS 2025 Project</a> -->
</p>

---

## What this repo actually is

A **single Next.js App Router application** (no monorepo, no separate backend service):

- **Landing page** (`/`) and marketing UI.
- **Clerk authentication** with top-level `/sign-in` and `/sign-up` catch-all pages, and a middleware gate: signed-out users are sent to sign-in, and users who have not completed onboarding are sent to `/onboarding`.
- **A five-step onboarding wizard** (`/onboarding`) — basic info, professional info, bio, interests, review — persisted by a server action into Postgres via **Drizzle ORM**, with the Clerk `onboardingComplete` metadata written only after every database write succeeds.
- **The signed-in app** under `/app`: home with queue-type selection, dashboard, match queue, professional queue variants (B2B, collaboration, investment, mentorship), profile, settings, and smart-connection.
- **A simulated video-meeting demo** at `/videocall/[id]`: mock participants, speaking/connection-state simulation, discussion prompts, notes, chat, and a meeting-time manager (elapsed clock, low-time warnings, single-flight extension requests with a cooldown and a hard 20-minute cap).

**Status of real-time calls:** the previous `/app/call/[id]` Stream-backed room was removed because its page imported a component that no longer exists and the route did not build. The Stream SDK packages and the `StreamClientProvider` are kept for the future real room; until that room exists, the accept-match flows route into the `/videocall/[id]` demo. There is no ML matching service in this repo — matching and queue pages are UI flows over mock data.

---

<h3 align="center">Lander Page</h3>
<p align="center">
  <img src="https://github.com/user-attachments/assets/f5ac64e0-747b-4f27-b7c6-8d4c2a8fd751" alt="Lander Page">
</p>

<h3 align="center">Smooth Onboarding</h3>
<p align="center">
  <img src="https://github.com/user-attachments/assets/75b0f718-e8fb-42e4-bf39-0fed942ffb38" alt="Smooth Onboarding">
</p>

---

## Tech Stack

| Area | What's used |
|:----|:------------|
| Framework | [Next.js](https://nextjs.org/) (App Router) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| UI | [Tailwind CSS](https://tailwindcss.com/), shadcn-style components on [Radix UI](https://www.radix-ui.com/), [lucide-react](https://lucide.dev/) icons, [framer-motion](https://www.framer.com/motion/) |
| Auth | [Clerk](https://clerk.com/) (`@clerk/nextjs` middleware, server actions, `<SignInButton>`/`<UserButton>`) |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/) + [postgres.js](https://github.com/porsager/postgres) |
| Validation | [zod](https://zod.dev/) schemas shared by the onboarding form (react-hook-form) and its server action |
| Real-time (dormant) | Stream video SDKs — provider kept, no active call room |
| Misc | sonner toasts, canvas-confetti, recharts, Vercel Analytics |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/sign-in/       # Clerk sign-in catch-all
│   ├── (auth)/sign-up/       # Clerk sign-up catch-all
│   ├── onboarding/           # 5-step wizard + _actions.ts server action
│   ├── videocall/[id]/       # simulated meeting demo (TimeManager UI)
│   └── app/                  # signed-in area (home, dashboard, queues, profile, settings)
├── components/
│   ├── app/                  # nav, user card, dashboard widgets
│   ├── queue/                # match queue lobby and variants
│   ├── video-meeting/        # top bar, video area, dialogs, toasts, time-manager
│   └── ui/                   # shadcn-style primitives
├── db/                       # drizzle client + schema (users, interests, meetings, connections, messages)
├── schemas/                  # zod schemas shared by forms and server actions
└── middleware.ts             # Clerk auth + onboarding gate
```

---

## How to Run Locally

### Requirements

- Node.js (this project has been developed on Node 20+)
- npm (or any JS package manager)
- A Postgres database reachable via `DATABASE_URL`
- Clerk API keys

1. **Clone and install**:
   ```bash
   git clone https://github.com/SamGu-NRX/LinkedUp.git
   cd LinkedUp
   npm install
   ```
2. **Configure environment**: copy `.env.local.example` to `.env.local` and fill in:
   - `DATABASE_URL` — your Postgres connection string
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — from your Clerk dashboard
   - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` — defaults in the example file
3. **Create the schema** (Drizzle push):
   ```bash
   npm run db:push
   ```
4. **Run the dev server**:
   ```bash
   npm run dev
   ```

### Scripts

| Script | What it does |
|:-------|:-------------|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:push` | Push the Drizzle schema to Postgres |
| `npm run db:studio` | Open Drizzle Studio |

---

## Project Status

### Working

- [x] Clerk sign-in/sign-up with middleware gating on `onboardingComplete`
- [x] Five-step onboarding wizard persisting profile + interests to Postgres
- [x] Signed-in app shell with dashboard, profile, settings, and queue flows
- [x] Simulated video-meeting demo with managed meeting-time lifecycle

### In Progress / Not Started

- [ ] A real Stream-backed call room to replace the removed `/app/call/[id]` route
- [ ] Real matching — queue pages currently use mock data, no ML service in this repo
- [ ] Real-time features behind the demo page's `FIGURE OUT HOW TO BUILD REAL-TIME` marker

---

<p align="center">
  <a href="https://nextjs.org/">Next.js</a> •
  <a href="https://reactjs.org/">React</a> •
  <a href="https://clerk.com/">Clerk</a> •
  <a href="https://orm.drizzle.team/">Drizzle</a>
</p>
