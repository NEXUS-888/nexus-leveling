# NEXUS leveling — Vishal's Personal Learning Dashboard

A personal learning tracker built as a static website. No backend, no database — everything saves to `localStorage` in your browser.

## Features

- **Dashboard** — streak, heatmap, built-vs-watched ratio chart, phase progress, data backup/restore
- **Daily Log** — log what you learned + built, tutorial time tracker, tutorial hell warning, Notion export
- **Roadmap** — full 12-month roadmap with click-to-mark-done topics
- **Resources** — every course/book/lab from the roadmap with visited tracking
- **Flashcards** — 20 built-in interview cards (Linux, AWS, Docker, K8s) + add your own custom cards
- **Projects** — track hands-on builds with tech stack, GitHub links, deploy status, and progress stats
- **Job Tracker** — log applications, track status, follow-up alerts, target companies
- **Cheatsheet** — personal command reference with 40+ built-in DevOps commands
- **Data Backup** — export/import all your data as JSON so you never lose progress
- **Responsive** — hamburger menu for mobile devices

## Deploy to Vercel (2 minutes)

```bash
# 1. Create a GitHub repo called devops-tracker
# 2. Push these files
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/devops-tracker.git
git push -u origin main

# 3. Go to vercel.com → Import Git Repository → select devops-tracker → Deploy
# Your site will be live at devops-tracker.vercel.app
```

## Deploy to GitHub Pages (alternative)

```bash
# In your GitHub repo → Settings → Pages → Source: main branch → / (root) → Save
# Site will be at: YOUR_USERNAME.github.io/devops-tracker
```

## Local usage

Just open `index.html` in your browser. No server needed.

## Data

All data saves to `localStorage` in your browser. Use the **Download backup** button on the Dashboard to export your data as JSON. Use **Import backup** to restore from a backup file. You can also use the **Notion export** button in Daily Log to back up entries in markdown format.

## Tech stack

Pure HTML + CSS + Vanilla JS. No frameworks. Chart.js via CDN for charts.

