<h1 align="center">LinkedUp</h1>

<p align="center">
  <strong>Professional connections, without the BS.</strong><br>
  The antithesis of LinkedIn – real-time, genuine professional connections via sleek UI, effective matching, and live voice/video calls.<br>
  <a href="https://devpost.com/software/linkedup-d5slpu?ref_content=user-portfolio&ref_feature=in_progress">HackTAMS Project</a>
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

## How It's Built

<table>
  <tr>
    <td><strong>Front-end</strong></td>
    <td>Next.js, React, Tailwind CSS</td>
  </tr>
  <tr>
    <td><strong>Authentication & Onboarding</strong></td>
    <td>Clerk</td>
  </tr>
  <tr>
    <td><strong>Real-Time Communication</strong></td>
    <td>Stream (Voice/Video Calls)</td>
  </tr>
  <tr>
    <td><strong>Backend & Database</strong></td>
    <td>Supabase</td>
  </tr>
  <tr>
    <td><strong>ML Matching Engine</strong></td>
    <td>Custom ML Model (PyTorch)</td>
  </tr>
</table>

---

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

## What's Next for LinkUp

- **New Connection Modes:** Explore B2B meeting opportunities, mentor-client sessions, and more.
- **Enhanced Matching:** Continuously refine our ML matching for even more effective networking.
- **User Experience:** Constant UI improvements to ensure a competitive, engaging platform.
- **Community Building:** Introduce gamified interactions and extended conversation features.

---

## How to Run

### Requirements
Before you begin, ensure you have met the following requirements:

- A modern web browser
- Node.js installed on your machine
- A JS package manager (pnpm recommended)
- Python 3 and pip (for backend services)

### Step 1: Node Setup and Run

```bash
# Clone the repository
git clone https://github.com/SamGu-NRX/LinkedUp.git
cd LinkedUp

# Using pnpm (recommended)
./setup.bat  # this is for windows, otherwise, use ./setup.sh

# Or, if not using pnpm
<package manager> install

# add in drizzle setup

# Run Next.js development server
<package manager> run dev
```

### Step 2: Back-end Setup
```bash
# Navigate to the backend folder
cd Backend

# Install Python dependencies
pip install -r requirements.txt

# Run the Flask server (ensure it runs on port 5000 or update .env accordingly)
python -m flask run
```

> **Note:** The Flask app should run on port 5000 by default. Update your `.env` file if needed:
> `FLASK_API_URL=http://127.0.0.1:5000/`

### Step 3: Enjoy LinkUp!
Once both servers are running, open your browser and head to `http://localhost:3000` to start networking!

---

<p align="center">
  <a href="https://nextjs.org/">Next.js</a> • 
  <a href="https://reactjs.org/">React</a> • 
  <a href="https://clerk.dev/">Clerk</a> • 
  <a href="https://getstream.io/">Stream</a>
</p>
