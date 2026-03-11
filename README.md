# 🖥️ Emergency108 – Admin Control Panel

> Real-time, role-protected admin dashboard for the Emergency108 dispatch system — built with React 19, TypeScript, Vite, Tailwind CSS v4, WebSockets (STOMP), and Google Maps.

**[🚀 View Live Demo on Vercel](https://emergency-dispatch-admin-panel.vercel.app/)**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-STOMP%2FSockJS-blueviolet?logo=socketdotio)
![Google Maps](https://img.shields.io/badge/Google%20Maps-API-4285F4?logo=googlemaps&logoColor=white)
![Axios](https://img.shields.io/badge/HTTP-Axios-5A29E4?logo=axios&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-black?logo=jsonwebtokens)
![Backend](https://img.shields.io/badge/Backend-Spring%20Boot-brightgreen?logo=springboot)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Stable-success)

---

## 🌟 Overview

**Emergency108 Admin Control Panel** is the **administrative interface** for the Emergency108 emergency dispatch system. It gives authorised administrators a single pane of glass to monitor and control the entire dispatch operation in real-time — from live ambulance positions on a map to driver verification and emergency management.

The panel connects to the [Emergency108 Spring Boot backend](https://github.com/anupamkushwaha85/emergency-dispatch-system) over **REST APIs** (JWT-authenticated) and **WebSockets (STOMP/SockJS)** for zero-latency updates without polling.

### 🔗 Related Repositories & Links

| Component | Link |
|---|---|
| 📱 Flutter Mobile App | [emergency108](https://github.com/anupamkushwaha85/emergency108) |
| ⚙️ Backend (Spring Boot) | [emergency-dispatch-system](https://github.com/anupamkushwaha85/emergency-dispatch-system) |
| 🌐 Admin Panel Live Demo | [emergency-dispatch-admin-panel.vercel.app](https://emergency-dispatch-admin-panel.vercel.app/) |

---

## ✨ Key Features

- 📊 **Real-Time Dashboard**
  - KPI cards: active emergencies, available ambulances, pending driver approvals
  - Live activity feed powered by WebSocket subscriptions — no polling
  - Optimistic stat updates on driver online/offline and emergency state changes

- 🗺️ **Live Map (Google Maps)**
  - Real-time ambulance location tracking via WebSocket
  - Custom dark "Electric Blue" map theme for operational clarity
  - Ambulance markers with info windows showing driver name, plate, and status
  - Hospital overlays with proximity data
  - SockJS fallback for environments that block raw WebSocket

- 🚨 **Emergency Management**
  - Paginated list of all active emergencies with status and severity badges
  - Color-coded status labels: `CREATED`, `DISPATCHED`, `AT_PATIENT`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
  - Admin cancel action with reason capture and confirmation dialog
  - Suspect cancellation flagging

- 🚑 **Driver Management**
  - **Pending Drivers tab:** review submitted documents, approve or reject with one click
  - **Online Drivers tab:** live view of drivers currently on shift with location and ambulance info
  - Real-time additions and removals via WebSocket driver-status subscription

- 🏥 **Hospital & Ambulance Management**
  - View all registered hospitals and ambulances
  - Add new hospitals and ambulances directly from the panel

- 🔒 **Secure Admin-Only Access**
  - OTP-based authentication flow backed by the Spring Boot backend
  - JWT stored in `localStorage`, attached automatically to every API request
  - Role guard: only users with `ADMIN` role can access the panel
  - Automatic redirect to `/login` on `401 Unauthorized`

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           Emergency108 Admin Control Panel          │
│                                                     │
│  React 19 + TypeScript (SPA, Vite bundler)          │
│  React Router v7 (client-side routing)              │
│  Tailwind CSS v4 (utility-first styling)            │
│  Axios (REST API calls + JWT interceptor)           │
│  STOMP/SockJS (real-time WebSocket client)          │
│  Google Maps JS API (live ambulance map)            │
│  Context API (auth state management)                │
│                                                     │
│  Connects to: Emergency108 Spring Boot Backend      │
│  Auth: OTP → JWT (role = ADMIN required)            │
└─────────────────────────────────────────────────────┘
```

**Tech Stack:**

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5.9 |
| Bundler | Vite 7 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| HTTP Client | Axios 1.x (with JWT interceptor) |
| Real-time | STOMP over SockJS (`@stomp/stompjs` + `sockjs-client`) |
| Maps | Google Maps JS API (`@react-google-maps/api`) |
| Icons | Lucide React |
| Auth | OTP + JWT (ADMIN role only) |

---

## 📂 Project Structure

```text
emergency_admin_control/
├── public/                 # Static assets
├── src/
│   ├── main.tsx            # App entry point
│   ├── App.tsx             # Root component & router setup
│   ├── index.css           # Global styles
│   ├── assets/             # Images and static files
│   ├── components/
│   │   └── Sidebar.tsx     # Navigation sidebar
│   ├── context/
│   │   └── AuthContext.tsx # JWT auth state (login / logout / role guard)
│   ├── layouts/            # Shared page layouts
│   ├── pages/
│   │   ├── Login.tsx       # OTP authentication page
│   │   ├── Dashboard.tsx   # KPI stats + live activity feed
│   │   ├── LiveMap.tsx     # Real-time ambulance map (Google Maps)
│   │   ├── Emergencies.tsx # Active emergency list + admin cancel
│   │   ├── Drivers.tsx     # Pending verification + online drivers
│   │   ├── Ambulances.tsx  # Ambulance fleet management
│   │   └── Hospitals.tsx   # Hospital registry management
│   └── services/
│       ├── api.ts          # Axios instance with JWT interceptor
│       └── websocketService.ts  # STOMP/SockJS WebSocket client
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🔄 Real-Time WebSocket Subscriptions

The panel connects to the backend WebSocket endpoint at `ws://<host>/ws` (SockJS fallback at `/ws`) automatically on relevant pages.

| Topic | Direction | Used On | Purpose |
|---|---|---|---|
| `/topic/live-locations` | Server → Admin | Live Map | Streams GPS coordinates for all active drivers |
| `/topic/driver-status` | Server → Admin | Dashboard, Drivers | Driver online / offline / on-trip events |
| `/topic/emergency-updates` | Server → Admin | Dashboard, Emergencies | Emergency state change events (created, dispatched, completed, cancelled) |
| `/topic/driver/{driverId}` | Server → Driver | (backend only) | Per-driver dispatch commands |

WebSocket connections are established on component mount and cleanly disconnected on unmount to prevent memory leaks.

---

## 🔒 Authentication Flow

```
Admin opens panel
       │
       ▼
POST /api/auth/send-otp  (phone number)
       │
       ▼
Admin enters 6-digit OTP
       │
       ▼
POST /api/auth/verify-otp
       │
       ├── role = ADMIN  ──► JWT stored in localStorage → redirect to /dashboard
       │
       └── role ≠ ADMIN  ──► Access denied, stays on /login
```

Every subsequent API call attaches `Authorization: Bearer <JWT>` via the Axios request interceptor. On any `401` response, the token is cleared and the user is redirected to `/login`.

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file in the project root (or set environment variables in your hosting provider):

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL, e.g. `https://your-app-name.onrender.com/api` |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps JavaScript API key (for Live Map page) |

> **Security:** Never commit `.env` files with real keys to the repository. Add `.env` to `.gitignore`.

**Example `.env`:**
```env
VITE_API_URL=https://your-app-name.onrender.com/api
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

---

## 🚀 Running Locally

### Prerequisites

- Node.js 18+
- npm or yarn
- A running instance of the [Emergency108 backend](https://github.com/anupamkushwaha85/emergency-dispatch-system)

### Steps

1. Clone the repository and navigate to the project directory:
   ```bash
   cd emergency_admin_control
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your configuration:
   ```env
   VITE_API_URL=http://localhost:8081/api
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The panel will be available at **http://localhost:5173** by default.

### Build for Production

```bash
npm run build
```

The production-ready files are output to the `dist/` directory. Serve them with any static file host (Vercel, Netlify, Nginx, etc.).

### Preview Production Build

```bash
npm run preview
```

---

## 🔐 Admin Login (Test / Dev)

When connecting to the deployed backend, the Admin OTP is configured separately on the server via environment variables. Contact the backend administrator for the test OTP.

For reference, the other role OTPs used by the mobile app are:

| Role | Static OTP | Note |
| :--- | :--- | :--- |
| **User** | `123456` | For standard users (mobile app) |
| **Driver** | `654321` | For ambulance drivers (mobile app) |
| **Admin** | *(configured server-side)* | Set via `MAGIC_OTP_ADMIN` env var |

---

## 📄 Pages Reference

| Page | Route | Description |
|---|---|---|
| Login | `/login` | OTP authentication entry point |
| Dashboard | `/dashboard` | KPI overview + real-time activity feed |
| Live Map | `/map` | Real-time ambulance tracking on Google Maps |
| Emergencies | `/emergencies` | Active emergency list with admin cancel action |
| Drivers | `/drivers` | Pending verification queue + online driver list |
| Ambulances | `/ambulances` | Fleet management — view and add ambulances |
| Hospitals | `/hospitals` | Hospital registry — view and add hospitals |

---

## 🚀 Release

- **Version:** `v1.0.0`
- **Status:** Stable
- **Last Updated:** March 2026

---

## � Mobile App — Download the APK

The Flutter mobile app for citizens and drivers that works alongside this admin panel is available for Android.

[![Download APK](https://img.shields.io/badge/Download-Latest%20APK-02569B?style=for-the-badge&logo=android&logoColor=white)](https://github.com/anupamkushwaha85/emergency108/releases/latest)

> The APK is automatically built and released via GitHub Actions on every push to the Flutter repo's `main` branch. Download the latest `app-release.apk` from the link above and install it on any Android device.

---

## �📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 📬 Contact

I am a B.Tech CSE student passionate about building scalable Java applications.

[![Email](https://img.shields.io/badge/Email-anupamkushwaha639%40gmail.com-red?style=flat-square&logo=gmail)](mailto:anupamkushwaha639@gmail.com)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-anupamkushwaha85-blue?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/anupamkushwaha85/)
[![Portfolio](https://img.shields.io/badge/Portfolio-anupamkushwaha.me-brightgreen?style=flat-square&logo=google-chrome&logoColor=white)](https://anupamkushwaha.me)

> For more info on the full system, see the [Backend README](https://github.com/anupamkushwaha85/emergency-dispatch-system#readme) and the [Flutter Mobile App README](https://github.com/anupamkushwaha85/emergency108#readme).

---

### Built with ❤️ by Anupam Kushwaha

⭐ **If you find this project helpful, please give it a star!**
