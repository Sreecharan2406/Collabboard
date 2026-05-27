<div align="center">

# ⬡ CollabBoard

**A real-time collaborative whiteboard built for teams that move fast.**

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.6-010101?style=flat-square&logo=socket.io&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18-000000?style=flat-square&logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

[Live Demo](https://collabboard-syws.onrender.com/) • [Features](#-features) • [Getting Started](#-getting-started) • [Tech Stack](#-tech-stack)

</div>

---

## ✨ What is CollabBoard?

CollabBoard is a **real-time multiplayer whiteboard** where teams can draw, brainstorm, and collaborate — all in the same canvas, at the same time. No accounts. No installs. Just share a link and start drawing together.

Think Miro or Figma's multiplayer canvas — built from scratch with Node.js and Socket.IO.

---

## 🚀 Features

### 🎨 Drawing Tools
- **Pen** — freehand drawing with smooth strokes
- **Eraser** — erase any part of the canvas
- **Shapes** — rectangle, circle, line, arrow, triangle
- **Text** — click anywhere to type directly on the canvas
- **Fill Bucket** — flood fill any region with color
- **Sticky Notes** — colorful draggable notes that float over the canvas

### ⚡ Real-Time Collaboration
- **Live drawing sync** — see others draw stroke by stroke in real time
- **Live cursors** — see every collaborator's cursor with their name
- **Cursor trails** — each user leaves a glowing colored trail
- **Shareable room links** — share a URL, anyone joins instantly

### 🎉 Fun Effects
- **🔴 Laser Pointer** — hold `Space` to activate a glowing red laser dot visible to all users
- **🎊 Confetti Burst** — double-click anywhere to explode confetti that everyone sees
- **Click Ripples** — visual ripple effects on interaction

### 🛠 Power Features
- **Undo / Redo** — full history with `Ctrl+Z` / `Ctrl+Y`
- **Zoom** — zoom in and out of the canvas
- **Export PNG** — download your board as an image
- **Keyboard Shortcuts** — `P` pen, `E` eraser, `T` text, `R` rect, `C` circle, `L` line, `A` arrow, `F` fill

---

## 🖥 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express |
| **Real-time** | Socket.IO |
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **Canvas** | HTML5 Canvas API |
| **Fonts** | Inter, JetBrains Mono (Google Fonts) |

No frontend frameworks. No databases. Pure, fast, lightweight.

---

## 🏁 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/collabboard.git
cd collabboard

# Install dependencies
npm install

# Start the server
node server.js
```

Open **http://localhost:3000** in your browser.

To test multiplayer, open two tabs, enter the same room code, and draw!

---

## 📁 Project Structure

```
collabboard/
├── server.js          # Express + Socket.IO backend
├── package.json
└── public/
    ├── index.html     # UI & join screen
    ├── style.css      # Dark theme styling
    └── app.js         # Canvas logic, tools, effects
```

---

## 🎮 How to Use

1. **Enter your name** and a **room code** on the join screen
2. **Share the room link** with teammates — they auto-join
3. **Draw together** in real time
4. Hold **Space** for laser pointer mode
5. **Double-click** anywhere for a confetti explosion 🎉
6. Hit **Export** to save your board as PNG

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `P` | Pen tool |
| `E` | Eraser |
| `T` | Text tool |
| `F` | Fill bucket |
| `R` | Rectangle |
| `C` | Circle |
| `L` | Line |
| `A` | Arrow |
| `Space` | Laser pointer |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

---

## 🚀 Deployment

CollabBoard is deployed on **Render**. To deploy your own instance:

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) and create a new **Web Service**
3. Connect your GitHub repo
4. Set build command: `npm install`
5. Set start command: `node server.js`
6. Deploy ✓

---

## 👨‍💻 Author

**Sreecharan R** — built as a portfolio project to demonstrate real-time full-stack development.

- GitHub: https://github.com/Sreecharan2406
- LinkedIn: https://www.linkedin.com/in/sreecharan-r-b593b1319/

---

<div align="center">

If you found this useful, drop a ⭐ — it means a lot!

</div>
