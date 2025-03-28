<h1 align="center">LinkedUp</h1>

<p align="center">
  <strong>Professional connections, without the BS.</strong><br>
  The antithesis of LinkedIn – real-time, genuine professional connections via sleek UI, effective AI-powered smart matching, and live voice/video calls.<br>
<!--   <a href="https://devpost.com/software/linkedup-d5slpu?ref_content=user-portfolio&ref_feature=in_progress">HackTAMS 2025 Project</a> -->
</p>

---

## Overview

LinkedUp was born out of the frustration with platforms like LinkedIn – cluttered interfaces, bot-filled interactions, and an overall unproductive networking environment. We reimagined professional connections by building an app that emphasizes:

- **Real Human Interaction:** Instant voice and video calls powered by Stream.
- **Seamless Onboarding:** Robust authentication and onboarding with Clerk.
- **Smart Matching:** An ML model that pairs professionals with like-minded peers.
- **Sleek Design:** A minimalist UI that focuses on productivity and genuine networking.

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

## Features

### Authentic Real-Time Connections
Engage in live voice and video calls that bypass endless text exchanges.
<p align="center">
  <img src="https://github.com/user-attachments/assets/0199e27e-8b1f-4ff1-8b69-ce046c0a012a" alt="Real-Time Call Interface" width="600">
</p>

### Intelligent Matchmaking
Our ML-driven system pairs you with professionals who share your interests and ambitions.
<p align="center">
  <img src="https://github.com/user-attachments/assets/fee31d22-e144-4896-b655-ef38437475e4" alt="Smart Matching Dashboard" width="600">
</p>

### Sleek, Minimalist UI
A clean, distraction-free environment that lets you focus on building meaningful connections.
<p align="center">
  <img src="https://github.com/user-attachments/assets/57167d18-050c-46d6-bcc4-0e5ca0d6f237" alt="Minimalist UI" width="600">
</p>

---

## How We Built It

> *A quick overview of the core technologies powering this project.*

| **Category**                  | **Technologies**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
|:------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Monorepo** :rocket:          | [![Turborepo](https://img.shields.io/badge/Turborepo-000000?style=for-the-badge&logo=turbo&logoColor=white)](#) <br> *All-in-one monorepo management*                                                                                                                                                                                                                                                                                                                                                             |
| **Front-End** :sparkles:       | [![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/) [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind-C0C0C0?style=for-the-badge&logo=tailwind-css&logoColor=06B6D4)](https://tailwindcss.com/) [![Shadcn UI](https://img.shields.io/badge/Shadcn%20UI-4F46E5?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2IiBjbGFzcz0iaC02IHctNiI+PHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIGZpbGw9Im5vbmUiPjwvcmVjdD48bGluZSB4MT0iMjA4IiB5MT0iMTI4IiB4Mj0iMTI4IiB5Mj0iMjA4IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjMyIj48L2xpbmU+PGxpbmUgeDE9IjE5MiIgeTE9IjQwIiB4Mj0iNDAiIHkyPSIxOTIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS13aWR0aD0iMzIiPjwvbGluZT48L3N2Zz4=)](#) [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) <br> *Hosted on [Vercel](https://vercel.com/)* |
| **Authentication** :lock:      | [![Clerk](https://img.shields.io/badge/Clerk-000000?style=for-the-badge&logo=clerk&logoColor=white)](https://clerk.com/)                                                                                                                                                                                                                                                                                                                                                                         |
| **Real-Time Communication** :satellite: | [![Stream API](https://img.shields.io/badge/Stream%20API-EEEEEE?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgNDAwIDI0MS4xIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCBtZWV0Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImIiIHgxPSIwIiB4Mj0iMzc1LjIiIHkxPSI4LjUiIHkyPSItMzEuOSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzU0YmNmZSIvPjxzdG9wIG9mZnNldD0iLjQiIHN0b3AtY29sb3I9IiMyODVmZjYiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzYzY4ZjUiLz48L2xpbmVhckdyYWRpZW50PjxjbGlwUGF0aCBpZD0iYSI+PHBhdGggZmlsbD0ibm9uZSIgZD0iTTAgMGg0MDB2MjQxSDB6Ii8+PC9jbGlwUGF0aD48L2RlZnM+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBjbGlwLXBhdGg9InVybCgjYSkiIGZvbnQtZmFtaWx5PSJub25lIiBmb250LXNpemU9Im5vbmUiIGZvbnQtd2VpZ2h0PSJub25lIiBzdHlsZT0ibWl4LWJsZW5kLW1vZGU6bm9ybWFsIiB0ZXh0LWFuY2hvcj0ibm9uZSI+PHBhdGggZmlsbD0idXJsKCNiKSIgZD0iTTIwMi40IDguOWMtLjcuMi0xLjkuOS0yLjYgMS40LTEuMiAxLTIgMi02LjQgNy45YTg2NjcuNSA4NjY3LjUgMCAwIDEtMjkuNCA0MCAxODU3LjggMTg1Ny44IDAgMCAxLTE1IDIwLjUgNzQyIDc0MiAwIDAgMS05LjUgMTMuMyAxMDY0LjcgMTA2NC43IDAgMCAxLTE4LjggMjYuNSAzMTczLjIgMzE3My4yIDAgMCAxLTE4LjggMjYuNSAzODMzLjggMzgzMy44IDAgMCAwLTE1LjQgMjEuNmMtMTAuOCAxNC42LTEwLjkgMTYuMi0yIDI4bDUuMiA3LjJhODUuMyA4NS4zIDAgMCAwIDEzLjYgMTYuOGMzIDEuNyAzLjYgMS44IDI2LjkgMmwzMC45LjVjMTggLjUgMTcuNy42IDI1LjUtMTBhODQ3Mi45IDg0NzIuOSAwIDAgMSAyMS42LTI5LjIgMTEwMS42IDExMDEuNiAwIDAgMCAxMy42LTE4LjUgMjgwMy43IDI4MDMuNyAwIDAgMCA0MC4zLTU1LjdjNi40LTkgNy42LTExIDcuOS0xNC4yLjMtNC0uMy01LTExLjItMTkuOEwyNDkuMyA2MWwtMzEuNy00M2MtNS44LTcuOC03LjctOS4zLTExLjgtOS40YTggOCAwIDAgMC0zLjQuNE0xOC42IDg2Yy00LjcgMS03LjMgNS40LTUuOCA5LjggMSAyLjguNyAyLjUgMjAgMjguNUw0NS4zIDE0MWMxMy4yIDE3LjggMTMuOCAxOC40IDE2LjYgMTkuNCAzLjYgMS4yIDUuNy0uMiAxMS44LThhOTU4LjQgOTU4LjQgMCAwIDAgMzQuOS00N2MxLjgtMy44IDEuMS03LjgtMS44LTEwLTIuMi0xLjgtNC42LTIuNC0xMi42LTNhODE1IDgxNSAwIDAgMS0yNS0yLjVjLTYuNy0uNS0xNC0xLjItMTkuMi0xLjhhNjI5LjggNjI5LjggMCAwIDAtMzEuNC0ybTM0Ny42IDFhMTc0My44IDE3NDMuOCAwIDAgMC0zMy4yIDMuMyA2MTMuNSA2MTMuNSAwIDAgMC0yMC4yIDJjLTIwLjMgMS43LTE5LjYgMS40LTI5LjEgMTQuNmE3NjUuMiA3NjUuMiAwIDAgMC02My4zIDg5LjNjLTUgNy04LjcgMTIuOC05LjMgMTQuMi0xLjcgNCAuNCA4LjMgNC40IDkuMyAyLjQuNiA2Ny41IDEuMiA3MC45LjcgNS4zLS44IDUuMi0uNyAyMy44LTI1LjdhNjE3Mi42IDYxNzIuNiAwIDAgMSAyOC0zNy45IDQ2OTQuNiA0Njk0LjYgMCAwIDEgMTkuNi0yNy40IDY0Ni40IDY0Ni40IDAgMCAwIDkuOC0xMy44YzEzLjktMTkuNCAxNC43LTIxIDEyLjUtMjUtMS45LTMuNC01LjMtNC4zLTEzLjktMy41TTMuMiAyNDAuNWMtLjEuNCAwIC43LjQuNnYtLjZjLS4yLS40LS4yLS40LS4zIDAiLz48L2c+PC9zdmc+)](#) <br> *Voice/Video Calls* |
| **Backend & Database** :floppy_disk: | [![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/) [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/) [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/) [![pgvector](https://img.shields.io/badge/pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](#) [![Numpy](https://img.shields.io/badge/Numpy-013243?style=for-the-badge&logo=numpy&logoColor=white)](https://numpy.org/) [![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/) [![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNzIgNzIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCAwLjM4KSI+CiAgICA8cmVjdCB3aWR0aD0iNS4yNTM2NSIgaGVpZ2h0PSIyMi4yODM0IiByeD0iMi42MjY4MyIgdHJhbnNmb3JtPSJtYXRyaXgoMC44NzMwMjggMC40ODc2NyAtMC40OTcyMTIgMC44Njc2MjkgMTYuMDc5MSAzMC4zMjkyKSIgZmlsbD0iI2NmZjY2YiIvPgogICAgPHJlY3Qgd2lkdGg9IjUuMjUzNjUiIGhlaWdodD0iMjIuMjgzNCIgcng9IjIuNjI2ODMiIHRyYW5zZm9ybT0ibWF0cml4KDAuODczMDI4IDAuNDg3NjcgLTAuNDk3MjEyIDAuODY3NjI5IDM0LjMzMDEgMTkpIiBmaWxsPSIjY2ZmNjZiIi8+CiAgICA8cmVjdCB3aWR0aD0iNS4yNTM2NSIgaGVpZ2h0PSIyMi4yODM0IiByeD0iMi42MjY4MyIgdHJhbnNmb3JtPSJtYXRyaXgoMC44NzMwMjggMC40ODc2NyAtMC40OTcyMTIgMC44Njc2MjkgNjIuNDEzMSAxOS4wMDA1KSIgZmlsbD0iI2NmZjY2YiIvPgogICAgPHJlY3Qgd2lkdGg9IjUuMjUzNjUiIGhlaWdodD0iMjIuMjgzNCIgcng9IjIuNjI2ODMiIHRyYW5zZm9ybT0ibWF0cml4KDAuODczMDI4IDAuNDg3NjcgLTAuNDk3MjEyIDAuODY3NjI5IDQ0LjE1NjIgMzAuMzI5MikiIGZpbGw9IiNjZmY2NmIiLz4KICA8L2c+Cjwvc3ZnPgo=)](https://orm.drizzle.team/) <br> *Hosted on [Render](https://render.com/)* |
| **ML Matching Engine** :robot: | [![XGBoost](https://img.shields.io/badge/XGBoost-EB0028?style=for-the-badge&logo=xgboost&logoColor=white)](https://xgboost.ai/) [![PTM](https://img.shields.io/badge/PTM%20Model-grey?style=for-the-badge&logoColor=white)](#) <br> *Vector-based similarity (dot products, cosine/euclidean distance) \+ semantic analysis using OpenAI* |

---

## Project Structure

```
.
├── apps
│   ├── web        # Next.js + Tailwind + Shadcn UI front-end
│   └── backend    # FastAPI, Python, XGBoost pipeline, etc.
├── packages
│   ├── shared     # Shared libraries/config
│   └── ui         # Reusable UI components (React, TS, Shadcn)
├── turborepo.json # Turborepo config
└── ...
```

### Hosting
- **Front-End** deployed on **Vercel**
- **Back-End** deployed on **Render**

---

## How to Run Locally

### Requirements
Before you begin, ensure you have met the following requirements:

- A modern web browser
- Node.js installed on your machine
- A JS package manager (pnpm recommended)
- Python 3 and pip (for backend services)

1. **Clone** the repo:
   ```bash
   git clone https://github.com/SamGu-NRX/linkedup.git
   cd linkedup
   ```
2. **Install dependencies** (using Turborepo + workspaces):
   ```bash
   pnpm install --recursive
   ```
3. **Setup environment variables** for each app (web, backend):
   - E.g., `.env.local` for Next.js, `.env` for FastAPI, with your Supabase keys, Clerk keys, etc.

---

## Development Workflow

- **Run the dev servers**:
  ```bash
  npx turbo run dev --parallel
  ```
  This starts both the front-end (Next.js) and the FastAPI back-end.

- **Build**:
  ```bash
  npx turbo run build --parallel
  ```

- **Lint/test**:
  ```bash
  npx turbo run lint
  npx turbo run test
  ```

---

## Algorithms & Matching Pipeline

We employ a combination of **xgBoost** (for our “PTM” pipeline) and vector-based methods (via **pgvector** + **OpenAI** semantic embeddings) to produce high-quality matches. You can find our specific methodology in [`docs/MatchingPipeline.pdf`](./docs/MatchingPipeline.pdf):




## Project Status

### In Progress
- [ ] Integrate advanced ML algorithms for improved matching.
- [ ] Expand platform features (B2B meetings, mentor sessions, etc.).
- [ ] Enhance UI/UX for an even sleeker experience.
- [ ] Implement ML-based moderation for a safe community.

### Completed
- [x] Developed core real-time call functionality with Stream.
- [x] Implemented secure and smooth onboarding with Clerk.
- [x] Built a scalable backend on Supabase.
- [x] Delivered a working demo showcasing our flagship features.

---

## Lessons Learned

- **API Integration:** Mastering Clerk and Stream in a fast-paced hackathon environment.
- **Team Collaboration:** Effective communication and problem-solving under pressure.
- **Scalability Concerns:** Designing an app that's both scalable and modifiable for future growth.
- **Real-Time Tech:** Handling live calls and ML matching in a production-like setting.

---

## What's Next for LinkedUp

- **New Connection Modes:** Explore B2B meeting opportunities, mentor-client sessions, and more.
- **Enhanced Matching:** Continuously refine our ML matching for even more effective networking.
- **User Experience:** Constant UI improvements to ensure a competitive, engaging platform.
- **Community Building:** Introduce gamified interactions and extended conversation features.

---

<p align="center">
  <a href="https://nextjs.org/">Next.js</a> •
  <a href="https://reactjs.org/">React</a> •
  <a href="https://clerk.dev/">Clerk</a> •
  <a href="https://getstream.io/">Stream</a>
</p>
