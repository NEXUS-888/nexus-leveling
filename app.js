// ── GLOBAL ERROR BOUNDARY FOR DEBUGGING ───────────────────
window.addEventListener('error', function(e) {
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '10px';
  errDiv.style.left = '10px';
  errDiv.style.right = '10px';
  errDiv.style.background = '#ff3b5c';
  errDiv.style.color = '#fff';
  errDiv.style.padding = '15px';
  errDiv.style.zIndex = '99999';
  errDiv.style.fontFamily = 'monospace';
  errDiv.style.whiteSpace = 'pre-wrap';
  errDiv.innerHTML = `<strong>CRITICAL RUNTIME ERROR:</strong><br>${e.message}<br>at ${e.filename}:${e.lineno}:${e.colno}`;
  document.body.appendChild(errDiv);
});

// ── FIREBASE CLOUD SYNC ────────────────────────────────────
let currentUser = null;
let db = null;

function updateSyncUI() {
  const btn = document.getElementById('fb-auth-btn');
  const status = document.getElementById('fb-sync-status');
  if (!btn || !status) return;

  if (currentUser) {
    btn.innerHTML = 'Sign out';
    btn.onclick = () => firebase.auth().signOut();
    status.innerHTML = '🟢 Synced to ' + currentUser.email;
  } else {
    btn.innerHTML = 'Sign in with Google';
    btn.onclick = () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider).catch(e => console.error(e));
    };
    status.innerHTML = '⚪ Local only';
  }
}

function initFirebase() {
  const firebaseConfig = {
    apiKey: "AIzaSyDxkyeXKGEynqArhU4DuTOEUKTsIBx8pg4",
    authDomain: "nexus-leveling.firebaseapp.com",
    databaseURL: "https://nexus-leveling-default-rtdb.firebaseio.com",
    projectId: "nexus-leveling",
    storageBucket: "nexus-leveling.firebasestorage.app",
    messagingSenderId: "341636710567",
    appId: "1:341636710567:web:b70f441af31e275637db82"
  };
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();

  firebase.auth().onAuthStateChanged((user) => {
    currentUser = user;
    updateSyncUI();
    if (user) {
      // Pull data once on login
      db.ref(`users/${user.uid}`).once('value').then(snapshot => {
        const cloudData = snapshot.val();
        if (cloudData) {
          for (const key in cloudData) {
            localStorage.setItem(key, JSON.stringify(cloudData[key]));
          }
          if (typeof render === 'function') render();
          if (typeof renderCustomList === 'function') renderCustomList();
          if (typeof loadLog === 'function') loadLog();
        }
      });
    }
  });
}

// Dynamically load Firebase SDKs
(function loadFirebaseSDKs() {
  const v = "10.12.0";
  const scripts = [
    `https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`,
    `https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`,
    `https://www.gstatic.com/firebasejs/${v}/firebase-database-compat.js`
  ];
  let loaded = 0;
  scripts.forEach(src => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => {
      loaded++;
      if (loaded === scripts.length) initFirebase();
    };
    document.head.appendChild(s);
  });
})();

// ── STORAGE ──────────────────────────────────────────────
const S = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => {
    localStorage.setItem(k, JSON.stringify(v));
    if (currentUser && db) db.ref(`users/${currentUser.uid}/${k}`).set(v).catch(console.error);
  },
  del: k => {
    localStorage.removeItem(k);
    if (currentUser && db) db.ref(`users/${currentUser.uid}/${k}`).remove().catch(console.error);
  }
};

const KEYS = {
  entries: 'dt_entries',
  roadmap: 'dt_roadmap',
  resources: 'dt_resources_visited',
  apps: 'dt_applications',
  cmds: 'dt_commands',
  cards: 'dt_flashcard_scores',
  why: 'dt_why',
  projects: 'dt_projects'
};

// ── ROADMAP DATA ──────────────────────────────────────────
const ROADMAP = [
  {
    id: 'w1', label: 'Week 1', phase: 'Phase 1 — Internship sprint',
    color: '#f07660', badge: 'amber',
    topics: [
      'Linux — chmod/permissions','Linux — find command','Linux — grep/awk/sed',
      'Linux — process management (ps, kill, top)','Linux — networking (netstat, curl)',
      'Linux — shell redirects (>, >>, |, 2>&1)','Linux — systemctl / journalctl',
      'AWS — IAM users, roles, policies','AWS — VPC & subnets','AWS — EC2 basics',
      'AWS — S3 storage classes','AWS — Security Groups vs NACLs','AWS — NAT Gateway'
    ]
  },
  {
    id: 'w2', label: 'Week 2', phase: 'Phase 1 — Internship sprint',
    color: '#f07660', badge: 'amber',
    topics: [
      'Docker — images vs containers','Docker — Dockerfile writing',
      'Docker — volumes & bind mounts','Docker — networking','Docker — docker-compose',
      'Containerise a Python script','Multi-container app setup'
    ]
  },
  {
    id: 'w3', label: 'Week 3', phase: 'Phase 1 — Internship sprint',
    color: '#f07660', badge: 'amber',
    topics: [
      'Flask app setup','Deploy Flask to EC2','S3 integration from app',
      'IAM roles attached to EC2','GitHub repo + README','Project debugging'
    ]
  },
  {
    id: 'w4', label: 'Week 4', phase: 'Phase 1 — Internship sprint',
    color: '#f07660', badge: 'amber',
    topics: [
      'AWS revision — all 7 questions','Project demo practice (explain in 2 min)',
      'Interview Q&A prep','Applications sent (target: 50+)'
    ]
  },
  {
    id: 'm2', label: 'Month 2', phase: 'Phase 2 — Job roadmap',
    color: '#2dd4bf', badge: 'blue',
    topics: [
      'AWS Cloud Practitioner — domains','Bash scripting basics',
      'Bash — loops & conditionals','Bash — functions & scripts',
      'TLCL book — full read','Linux — file system deep dive'
    ]
  },
  {
    id: 'm34', label: 'Months 3–4', phase: 'Phase 2 — Job roadmap',
    color: '#2dd4bf', badge: 'blue',
    topics: [
      'K8s — pods','K8s — deployments','K8s — services & ingress',
      'K8s — configmaps & secrets','K8s — namespaces','Minikube local setup',
      'KodeKloud lab — pods','KodeKloud lab — deployments','Deploy project on K8s'
    ]
  },
  {
    id: 'm5', label: 'Month 5', phase: 'Phase 2 — Job roadmap',
    color: '#2dd4bf', badge: 'blue',
    topics: [
      'GitHub Actions — basics','GitHub Actions — build pipeline',
      'GitHub Actions — Docker build & push','Jenkins — basics','CI/CD debugging'
    ]
  },
  {
    id: 'm6', label: 'Month 6', phase: 'Phase 2 — Job roadmap',
    color: '#2dd4bf', badge: 'blue',
    topics: [
      'Terraform — HCL basics','Terraform — provision EC2',
      'Terraform — VPC & networking','Terraform — variables & outputs',
      'AWS SAA — compute domain','AWS SAA — networking domain',
      'AWS SAA — storage domain','AWS SAA — databases domain'
    ]
  },
  {
    id: 'm78', label: 'Months 7–8', phase: 'Phase 2 — Job roadmap',
    color: '#2dd4bf', badge: 'blue',
    topics: [
      'Prometheus setup','Prometheus — scrape configs','Grafana dashboards',
      'Grafana — alerting','ELK — Elasticsearch basics','ELK — Kibana'
    ]
  },
  {
    id: 'm910', label: 'Months 9–10', phase: 'Phase 2 — Job roadmap',
    color: '#2dd4bf', badge: 'blue',
    topics: [
      'Go — Tour of Go','Go — structs & interfaces','Go — goroutines',
      'Go — HTTP client/server','Go — CLI tool build','Read K8s source code'
    ]
  },
  {
    id: 'm1112', label: 'Months 11–12', phase: 'Phase 2 — Job roadmap',
    color: '#2dd4bf', badge: 'blue',
    topics: [
      'Capstone — GitHub Actions pipeline','Capstone — Docker + ECR',
      'Capstone — EKS deployment','Capstone — Terraform infra',
      'Capstone — Grafana monitoring','Portfolio polish','Job applications'
    ]
  }
];

// ── FLASHCARD DATA ────────────────────────────────────────
const FLASHCARDS = [
  { id: 'fc1', topic: 'Linux', q: 'What does chmod 755 mean? Break down each digit.', a: '7 = owner has read(4)+write(2)+execute(1). First 5 = group has read(4)+execute(1). Second 5 = others have read(4)+execute(1). So owner can do everything, group and others can read and run but not write.' },
  { id: 'fc2', topic: 'Linux', q: 'What is the difference between > and >> in shell?', a: '> redirects output and OVERWRITES the file. >> redirects output and APPENDS to the file. Example: echo "hello" > file.txt (creates/overwrites), echo "world" >> file.txt (adds a line).' },
  { id: 'fc3', topic: 'Linux', q: 'How do you find all files modified in the last 24 hours?', a: 'find /path -mtime -1\n\nBreakdown: find = search command, /path = where to look, -mtime = modification time, -1 = less than 1 day ago. Use . for current directory.' },
  { id: 'fc4', topic: 'Linux', q: 'What is the difference between a process and a thread?', a: 'A process is an independent program with its own memory space. A thread is a unit of execution within a process, sharing the same memory. Threads are lighter. Check processes with ps aux or top/htop.' },
  { id: 'fc5', topic: 'Linux', q: 'You SSH into a server and start a long job. Your connection drops. What should you have done?', a: 'Use tmux or screen before starting the job. These create persistent terminal sessions that survive disconnection. Run: tmux new -s mysession, start your job, then detach with Ctrl+B then D. Reconnect with tmux attach.' },
  { id: 'fc6', topic: 'Linux', q: 'What is the difference between systemctl start and systemctl enable?', a: 'start = runs the service RIGHT NOW but does not persist after reboot. enable = makes it start AUTOMATICALLY on boot but does not start it now. Use both together: systemctl enable --now service.' },
  { id: 'fc7', topic: 'Linux', q: 'What is a symlink vs a hard link?', a: 'Symlink = a pointer to a file path (like a Windows shortcut). If the original is deleted, symlink breaks. Hard link = another name pointing to the same inode (actual data). Deleting original does not affect hard link. Create with: ln -s (symlink) or ln (hard link).' },
  { id: 'fc8', topic: 'Linux', q: 'A process is eating 100% CPU. How do you identify and kill it?', a: '1. Run top or htop to find it. 2. Note the PID (process ID). 3. kill PID (sends SIGTERM, graceful). 4. If it does not stop: kill -9 PID (SIGKILL, force). Or use: pkill processname.' },
  { id: 'fc9', topic: 'AWS', q: 'What is the difference between Security Groups and NACLs?', a: 'Security Groups: stateful (return traffic auto-allowed), attached to EC2 instances, allow rules only. NACLs: stateless (must explicitly allow inbound AND outbound), attached to subnets, allow and deny rules. SGs are the first line of defence for instances.' },
  { id: 'fc10', topic: 'AWS', q: 'EC2 in a private subnet needs to download packages from internet. What do you set up?', a: 'A NAT Gateway in a PUBLIC subnet. Route the private subnet traffic (0.0.0.0/0) to the NAT Gateway. NAT Gateway needs an Elastic IP. Private subnet → NAT Gateway (public subnet) → Internet Gateway → internet.' },
  { id: 'fc11', topic: 'AWS', q: 'What is the difference between S3 Standard, S3-IA, and Glacier?', a: 'Standard: frequent access, high cost, instant retrieval. S3-IA (Infrequent Access): cheaper storage, higher per-retrieval cost, instant retrieval. Glacier: archival, very cheap, retrieval takes minutes to hours. Use Glacier for compliance/backup data you rarely need.' },
  { id: 'fc12', topic: 'AWS', q: 'What is VPC Peering and one limitation it has?', a: 'VPC Peering connects two VPCs so they can communicate as if on the same network. Works across accounts and regions. Key limitation: NO TRANSITIVE PEERING. If A peers with B and B peers with C, A cannot reach C through B. Each pair needs its own peering connection.' },
  { id: 'fc13', topic: 'AWS', q: 'What is the difference between vertical and horizontal scaling? Which AWS service helps with horizontal scaling?', a: 'Vertical scaling = making one server bigger (more CPU/RAM). Has a physical limit. Horizontal scaling = adding more servers. No theoretical limit. Auto Scaling Groups (ASG) handle horizontal scaling on AWS, automatically adding/removing EC2 instances based on load.' },
  { id: 'fc14', topic: 'AWS', q: 'App needs a database that scales reads automatically. RDS, Aurora, or DynamoDB?', a: 'Aurora for SQL or DynamoDB for NoSQL. Aurora has read replicas that auto-scale. DynamoDB scales reads and writes automatically. RDS has read replicas but requires manual management. For most web apps: Aurora. For massive scale or key-value access: DynamoDB.' },
  { id: 'fc15', topic: 'AWS', q: 'What is IAM Role vs IAM User? When do you attach a role to EC2?', a: 'IAM User = a person with long-term credentials (username/password/access keys). IAM Role = a set of permissions assumed temporarily, no long-term credentials. Attach a role to EC2 when the instance needs to call AWS services (e.g. access S3). NEVER put access keys on an EC2 instance — use a role.' },
  { id: 'fc16', topic: 'Docker', q: 'What is the difference between a Docker image and a container?', a: 'Image = a read-only template with the app and its dependencies, like a class. Container = a running instance of an image, like an object. One image can spawn many containers. Containers are ephemeral — data is lost when stopped unless you use volumes.' },
  { id: 'fc17', topic: 'Docker', q: 'What does this Dockerfile line do: COPY . /app', a: 'Copies everything from the current directory on your host machine into the /app directory inside the Docker image. Runs during build time. Use .dockerignore to exclude files like node_modules or .git.' },
  { id: 'fc18', topic: 'Docker', q: 'What is the difference between CMD and ENTRYPOINT in a Dockerfile?', a: 'ENTRYPOINT = the command that always runs. Cannot be overridden at runtime (only with --entrypoint flag). CMD = default arguments, can be overridden at runtime. Common pattern: ENTRYPOINT ["python"] CMD ["app.py"] — you can override app.py but python always runs.' },
  { id: 'fc19', topic: 'K8s', q: 'What is a Pod in Kubernetes?', a: 'The smallest deployable unit in K8s. A Pod wraps one or more containers that share network and storage. Containers in a pod communicate via localhost. Pods are ephemeral — if they die, K8s creates a new one. You rarely create pods directly; use Deployments.' },
  { id: 'fc20', topic: 'K8s', q: 'What is the difference between a Deployment and a StatefulSet?', a: 'Deployment: for stateless apps. Pods are interchangeable, can be created/deleted in any order. StatefulSet: for stateful apps (databases). Pods have stable names (pod-0, pod-1), stable storage, ordered startup/shutdown. Use StatefulSet for Postgres, MongoDB, Kafka.' },
];

// ── RESOURCES DATA ────────────────────────────────────────
const RESOURCES = [
  // ── Week 1: Linux + AWS Foundations ──
  { id: 'r1', name: 'The Linux Command Line (TLCL)', url: 'http://linuxcommand.org/tlcl.php', phase: 'Week 1', type: 'Book', free: true, icon: '📖', desc: 'Best free Linux book. Read the whole thing, not just ch1–10.' },
  { id: 'r2', name: 'iximiuz Labs — Linux & Containers', url: 'https://labs.iximiuz.com', phase: 'Week 1', type: 'Lab', free: true, icon: '🧪', desc: 'Modern interactive Linux/container labs. Break things safely in-browser.' },
  { id: 'r3', name: 'AWS Skill Builder (free labs)', url: 'https://skillbuilder.aws', phase: 'Week 1', type: 'Lab', free: true, icon: '🧪', desc: 'Official AWS labs. No credit card needed. Always up to date.' },
  { id: 'r4', name: 'FreeCodeCamp AWS Full Course', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+AWS+full+course', phase: 'Week 1', type: 'Video', free: true, icon: '▶️', desc: '5hr YouTube video. Focus on VPC, IAM, EC2, S3.' },

  // ── Week 1–2: Networking (CRITICAL — don't skip) ──
  { id: 'r18', name: 'Nana — Networking for DevOps', url: 'https://www.youtube.com/watch?v=3OR6jZc_oJc', phase: 'Week 1', type: 'Video', free: true, icon: '▶️', desc: 'DNS, TCP/IP, ports, load balancers explained for DevOps. Not dry theory.' },
  { id: 'r19', name: 'Cisco NetAcad — Networking Essentials', url: 'https://www.netacad.com/courses/networking', phase: 'Week 1', type: 'Course', free: true, icon: '🎓', desc: 'Gold standard networking fundamentals. OSI model, subnetting, CIDR.' },

  // ── Week 1–2: Git (CRITICAL — don't skip) ──
  { id: 'r20', name: 'Learn Git Branching (Interactive)', url: 'https://learngitbranching.js.org', phase: 'Week 1', type: 'Practice', free: true, icon: '💻', desc: 'Visual interactive Git exercises. Understand rebase, cherry-pick in 30 min.' },
  { id: 'r21', name: 'Atlassian Git Tutorials', url: 'https://www.atlassian.com/git/tutorials', phase: 'Week 1', type: 'Docs', free: true, icon: '📄', desc: 'Best written Git guides. Branching, merging, workflows, advanced topics.' },

  // ── Week 2: Docker ──
  { id: 'r5', name: 'TechWorld with Nana — Docker', url: 'https://www.youtube.com/results?search_query=techworld+with+nana+docker+full+course', phase: 'Week 2', type: 'Video', free: true, icon: '▶️', desc: '3hr Docker course. Best free resource. Clear explanations.' },
  { id: 'r6', name: 'Killercoda — Docker & K8s Labs', url: 'https://killercoda.com', phase: 'Week 2', type: 'Lab', free: true, icon: '🧪', desc: 'Free interactive Docker & K8s labs in-browser. Better than Play with Docker.' },

  // ── Month 2: AWS Cert + Bash + Python ──
  { id: 'r7', name: 'Stephane Maarek — AWS CCP (Udemy)', url: 'https://www.udemy.com/course/aws-certified-cloud-practitioner-new/', phase: 'Month 2', type: 'Course', free: false, icon: '🎓', desc: 'Best CCP/CLF-C02 prep. Wait for Udemy sale (~₹499).' },
  { id: 'r22', name: 'Automate the Boring Stuff (Python)', url: 'https://automatetheboringstuff.com', phase: 'Month 2', type: 'Book', free: true, icon: '📖', desc: 'Best free Python automation book. Files, web scraping, CLI scripting.' },
  { id: 'r23', name: 'boto3 — AWS SDK for Python', url: 'https://boto3.amazonaws.com/v1/documentation/api/latest/index.html', phase: 'Month 2', type: 'Docs', free: true, icon: '📄', desc: 'Automate AWS with Python. Manage EC2, S3, IAM programmatically.' },

  // ── Month 3–4: Kubernetes ──
  { id: 'r8', name: 'TechWorld with Nana — Kubernetes', url: 'https://www.youtube.com/results?search_query=techworld+with+nana+kubernetes+full+course', phase: 'Month 3-4', type: 'Video', free: true, icon: '▶️', desc: 'Best free K8s intro. Watch this BEFORE doing labs.' },
  { id: 'r9', name: 'KodeKloud Labs', url: 'https://kodekloud.com', phase: 'Month 3-4', type: 'Lab', free: false, icon: '🧪', desc: 'Hands-on K8s labs. Free tier limited — paid plan ~$20/mo is worth it.' },

  // ── Month 5: CI/CD ──
  { id: 'r10', name: 'GitHub Actions Docs', url: 'https://docs.github.com/en/actions', phase: 'Month 5', type: 'Docs', free: true, icon: '📄', desc: 'Official docs. Build a real CI/CD pipeline for your project.' },
  { id: 'r24', name: 'Abhishek Veeramalla — DevOps Zero to Hero', url: 'https://www.youtube.com/@AbhishekVeeramalla', phase: 'Month 5', type: 'Video', free: true, icon: '▶️', desc: '#1 DevOps YouTube channel. Real-world projects, CI/CD, K8s, Terraform.' },

  // ── Month 6: Terraform + AWS SAA + Ansible ──
  { id: 'r11', name: 'HashiCorp Terraform Tutorials', url: 'https://developer.hashicorp.com/terraform/tutorials', phase: 'Month 6', type: 'Course', free: true, icon: '🎓', desc: 'Official free tutorials. Do the AWS provider track.' },
  { id: 'r12', name: 'Stephane Maarek — AWS SAA (Udemy)', url: 'https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/', phase: 'Month 6', type: 'Course', free: false, icon: '🎓', desc: 'Most important paid resource. SAA is the most respected AWS cert.' },
  { id: 'r25', name: 'Ansible for the Absolute Beginner (KodeKloud)', url: 'https://kodekloud.com', phase: 'Month 6', type: 'Course', free: false, icon: '🎓', desc: 'Many JDs list Ansible alongside Terraform. Learn playbooks & roles.' },

  // ── Month 7–8: Monitoring + Security ──
  { id: 'r13', name: 'Nana — Prometheus & Grafana', url: 'https://www.youtube.com/results?search_query=techworld+nana+prometheus+grafana', phase: 'Month 7-8', type: 'Video', free: true, icon: '▶️', desc: 'Best free monitoring stack intro. Prometheus + Grafana + alerting.' },
  { id: 'r26', name: 'Trivy — Container Security Scanner', url: 'https://aquasecurity.github.io/trivy', phase: 'Month 7-8', type: 'Docs', free: true, icon: '📄', desc: 'Scan Docker images for vulnerabilities. Add to your CI/CD pipeline.' },

  // ── Month 9–10: Go ──
  { id: 'r14', name: 'Tour of Go', url: 'https://go.dev/tour', phase: 'Month 9-10', type: 'Course', free: true, icon: '🎓', desc: 'Official interactive Go tutorial. The best starting point.' },
  { id: 'r15', name: 'Go by Example', url: 'https://gobyexample.com', phase: 'Month 9-10', type: 'Docs', free: true, icon: '📄', desc: 'Quick reference with runnable examples. Use while building your CLI tool.' },

  // ── General ──
  { id: 'r16', name: 'NeetCode.io', url: 'https://neetcode.io', phase: 'General', type: 'Practice', free: true, icon: '💻', desc: 'Blind 75 → NeetCode 150. Best structured DSA practice.' },
  { id: 'r17', name: 'LeetCode (Easy/Medium)', url: 'https://leetcode.com', phase: 'General', type: 'Practice', free: true, icon: '💻', desc: 'Focus on arrays, hashmaps, strings, two-pointer. Skip hard/CP problems.' },
  { id: 'r27', name: 'roadmap.sh — DevOps Roadmap', url: 'https://roadmap.sh/devops', phase: 'General', type: 'Docs', free: true, icon: '📄', desc: 'Industry-standard visual roadmap. Compare against your tracker for gaps.' },
];

// ── UTILITIES ─────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toast(msg, type = '') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast ' + type;
  requestAnimationFrame(() => {
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function calcStreak(entries) {
  if (!entries || !entries.length) return 0;
  const days = [...new Set(entries.map(e => e.date))].sort().reverse();
  if (!days.length) return 0;
  let streak = 1;
  for (let i = 0; i < days.length - 1; i++) {
    const a = new Date(days[i]);
    const b = new Date(days[i + 1]);
    const diff = (a - b) / (1000 * 60 * 60 * 24);
    if (diff <= 1.5) streak++;
    else break;
  }
  return streak;
}

function calcLongestStreak(entries) {
  if (!entries || !entries.length) return 0;
  const days = [...new Set(entries.map(e => e.date))].sort();
  if (!days.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i]) - new Date(days[i - 1])) / (1000 * 60 * 60 * 24);
    if (diff <= 1.5) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}

function getRoadmapProgress() {
  const done = S.get(KEYS.roadmap) || {};
  let total = 0, completed = 0;
  ROADMAP.forEach(p => {
    total += p.topics.length;
    completed += (done[p.id] || []).length;
  });
  return { total, completed, pct: total ? Math.round(completed / total * 100) : 0 };
}

function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === page || (page === '' && href === 'index.html'));
  });
}

function updateStreakPill() {
  const entries = S.get(KEYS.entries) || [];
  const streak = calcStreak(entries);
  const el = document.getElementById('streak-pill');
  if (el) el.textContent = `🔥 ${streak}d streak`;
}

function renderNav() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  setActiveNav();
  updateStreakPill();
}

document.addEventListener('DOMContentLoaded', renderNav);

// ── DATA BACKUP ──────────────────────────────────────────
function exportAllData() {
  const data = {};
  Object.keys(KEYS).forEach(k => {
    const val = S.get(KEYS[k]);
    if (val !== null) data[KEYS[k]] = val;
  });
  const customCards = S.get('dt_custom_flashcards');
  if (customCards) data['dt_custom_flashcards'] = customCards;
  return JSON.stringify(data, null, 2);
}

function importAllData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    Object.entries(data).forEach(([key, val]) => {
      localStorage.setItem(key, JSON.stringify(val));
    });
    return true;
  } catch (e) {
    return false;
  }
}

function downloadBackup() {
  const data = exportAllData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nexus-leveling-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Backup downloaded!', 'success');
}

function triggerImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (!confirm('This will merge imported data with your current data. Continue?')) return;
      if (importAllData(ev.target.result)) {
        toast('Data imported! Refreshing...', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        toast('Invalid backup file.', 'warning');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── CUSTOM FLASHCARDS ────────────────────────────────────
function getCustomCards() {
  return S.get('dt_custom_flashcards') || [];
}

function addCustomCard(topic, q, a) {
  const cards = getCustomCards();
  cards.push({ id: 'custom_' + Date.now(), topic, q, a, custom: true });
  S.set('dt_custom_flashcards', cards);
  return cards;
}

function deleteCustomCard(id) {
  let cards = getCustomCards();
  cards = cards.filter(c => c.id !== id);
  S.set('dt_custom_flashcards', cards);
  return cards;
}

function getAllFlashcards() {
  return [...FLASHCARDS, ...getCustomCards()];
}

// ── PROJECTS ─────────────────────────────────────────────
function getProjects() {
  return S.get(KEYS.projects) || [];
}

function addProject(project) {
  const projects = getProjects();
  projects.unshift(project);
  S.set(KEYS.projects, projects);
  return projects;
}

function updateProjectStatus(id, newStatus) {
  const projects = getProjects();
  const p = projects.find(p => p.id === id);
  if (p) { p.status = newStatus; p.updatedAt = Date.now(); }
  S.set(KEYS.projects, projects);
  return projects;
}

function deleteProject(id) {
  let projects = getProjects();
  projects = projects.filter(p => p.id !== id);
  S.set(KEYS.projects, projects);
  return projects;
}

// ── SCROLL REVEAL ANIMATIONS ──────────────────────────────
(function initScrollReveal() {
  if (typeof IntersectionObserver === 'undefined') {
    // Immediate fallback for environments without observer support
    document.querySelectorAll('.animate-in').forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  // Observe on DOM ready
  function observeAll() {
    document.querySelectorAll('.animate-in').forEach(el => observer.observe(el));
    
    // Failsafe timeout to force visibility if observer doesn't fire (e.g. inside iframe previews)
    setTimeout(() => {
      document.querySelectorAll('.animate-in:not(.visible)').forEach(el => {
        el.classList.add('visible');
      });
    }, 850);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAll);
  } else {
    observeAll();
  }
  // Re-observe after dynamic renders
  window._scrollRevealObserver = observer;
  window.observeAnimateIn = function() {
    document.querySelectorAll('.animate-in:not(.visible)').forEach(el => observer.observe(el));
  };
})();

// ── ANIMATED COUNTER ──────────────────────────────────────
function animateCounter(el, target, duration) {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  const suffix = el.dataset.suffix || '';
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ── BUTTON RIPPLE EFFECT ──────────────────────────────────
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  btn.style.setProperty('--ripple-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
  btn.style.setProperty('--ripple-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
});

// ── 3D WEBGL ENGINE INJECTION ─────────────────────────────
(function initGlobal3DBg() {
  console.log("NEXUS 3D: Initializing background engine...");
  const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const GSAP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js';

  // State Helpers for Data-Aware Nodes
  function getLogStreak() {
    const entries = S.get(KEYS.entries) || [];
    return calcStreak(entries);
  }
  function getRoadmapPct() {
    const progress = getRoadmapProgress();
    return progress.pct;
  }
  function getFlashcardMastery() {
    const scores = S.get(KEYS.cards) || {};
    const vals = Object.values(scores);
    if (!vals.length) return 0;
    const know = vals.filter(v => v === 'know').length;
    return Math.round(know / vals.length * 100);
  }
  function getJobAppCount() {
    const apps = S.get(KEYS.apps) || [];
    return apps.length;
  }

  const NODES = [
    { id: 'dashboard', label: 'CORE_DASHBOARD', href: 'index.html', progress: null },
    { id: 'log', label: 'DAILY_LOG', href: 'log.html', progress: getLogStreak() },
    { id: 'roadmap', label: 'ROADMAP', href: 'roadmap.html', progress: getRoadmapPct() },
    { id: 'resources', label: 'RESOURCES', href: 'resources.html', progress: null },
    { id: 'flashcards', label: 'FLASHCARDS', href: 'flashcards.html', progress: getFlashcardMastery() },
    { id: 'projects', label: 'PROJECTS', href: 'projects.html', progress: null },
    { id: 'jobs', label: 'JOBS', href: 'jobs.html', progress: getJobAppCount() },
    { id: 'cheatsheet', label: 'CHEATSHEET', href: 'cheatsheet.html', progress: null },
  ];

  function formatReadout(node) {
    if (node.id === 'log' && node.progress) return `${node.progress}D_STREAK`;
    if (node.id === 'roadmap' && node.progress) return `${node.progress}%_COMPLETED`;
    if (node.id === 'flashcards' && node.progress) return `${node.progress}%_MASTERY`;
    if (node.id === 'jobs' && node.progress) return `${node.progress}_APPLICATIONS`;
    return 'ONLINE';
  }

  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = (err) => console.error("NEXUS 3D: Script load failed: " + src, err);
    document.head.appendChild(s);
  }

  function start3D() {
    try {
      const canvas = document.createElement('canvas');
    canvas.id = 'nexus-3d-bg';
    document.body.insertBefore(canvas, document.body.firstChild);

    // Create HUD overlays
    const overlay = document.createElement('div');
    overlay.id = 'nexus-nodes-overlay';
    document.body.appendChild(overlay);

    const flash = document.createElement('div');
    flash.id = 'nexus-transition-overlay';
    document.body.appendChild(flash);

    // SR-only screen-reader static navigation fallback
    const staticNav = document.createElement('nav');
    staticNav.className = 'sr-only';
    staticNav.id = 'nexus-static-nav';
    staticNav.innerHTML = NODES.map(n => `<a href="${n.href}">${n.label.replace('_', ' ')}</a>`).join('');
    document.body.appendChild(staticNav);

    // Three.js Core Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Outer cyber-sphere (Cyan)
    const outerGeo = new THREE.IcosahedronGeometry(1.8, 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.08
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    scene.add(outerMesh);

    // Nodes (Magenta points at vertices)
    const pointsMat = new THREE.PointsMaterial({
      color: 0xff2d7a,
      size: 0.05,
      transparent: true,
      opacity: 0.6
    });
    const nodes = new THREE.Points(outerGeo, pointsMat);
    outerMesh.add(nodes);

    // Inner core (Magenta)
    const innerGeo = new THREE.IcosahedronGeometry(1.0, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xff2d7a,
      wireframe: true,
      transparent: true,
      opacity: 0.04
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerMesh);

    // Create 3D Nodes Group for Orbit
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);

    // Add nodes in orbit around center sphere
    NODES.forEach((node, index) => {
      const theta = (index / NODES.length) * Math.PI * 2;
      const radius = 2.5;

      const nodeMesh = new THREE.Object3D();
      nodeMesh.position.x = Math.cos(theta) * radius;
      nodeMesh.position.y = Math.sin(theta) * (radius * 0.6);
      nodeMesh.position.z = Math.sin(theta * 1.5) * 0.8;
      nodesGroup.add(nodeMesh);
      node.mesh = nodeMesh;

      // Inject HTML Node button
      const nodeEl = document.createElement('div');
      nodeEl.className = 'cyber-node-label';
      nodeEl.innerHTML = `
        <div class="node-btn">
          <svg class="node-progress-svg" viewBox="0 0 100 40">
            <rect class="node-progress-rect" x="1.5" y="1.5" width="97" height="37" />
          </svg>
          ${node.label}
        </div>
        <div class="node-readout">> OFFLINE</div>
      `;

      // Set progress indicator ring
      const rect = nodeEl.querySelector('.node-progress-rect');
      if (rect) {
        const perimeter = (97 + 37) * 2;
        rect.style.strokeDasharray = perimeter;
        if (node.progress !== null) {
          const completion = node.progress / 100;
          rect.style.strokeDashoffset = perimeter * (1 - completion);
        } else {
          // Standard links get full glow or none depending on status
          rect.style.strokeDashoffset = 0;
        }
      }

      overlay.appendChild(nodeEl);
      node.el = nodeEl;

      // Hover Readout with Typewriter
      function typewriter(el, text) {
        if (el._typeInterval) clearInterval(el._typeInterval);
        el.textContent = '';
        let i = 0;
        el._typeInterval = setInterval(() => {
          if (i < text.length) {
            el.textContent += text[i];
            i++;
          } else {
            clearInterval(el._typeInterval);
          }
        }, 25);
      }

      nodeEl.addEventListener('mouseenter', () => {
        typewriter(nodeEl.querySelector('.node-readout'), `> ${formatReadout(node)}`);
        // Highlight corresponding mesh temporarily
        node.mesh.scale.set(1.5, 1.5, 1.5);
      });

      nodeEl.addEventListener('mouseleave', () => {
        typewriter(nodeEl.querySelector('.node-readout'), '> OFFLINE');
        node.mesh.scale.set(1, 1, 1);
      });

      // Navigation transition sequencing
      let navState = 'idle';
      nodeEl.addEventListener('click', () => {
        if (navState !== 'idle') return;
        navState = 'zooming';
        overlay.style.pointerEvents = 'none';

        const worldPos = new THREE.Vector3();
        node.mesh.getWorldPosition(worldPos);

        const tl = gsap.timeline({
          onComplete: () => {
            sessionStorage.setItem('nexus-transition-in', node.id);
            window.location.href = node.href;
          }
        });

        tl.to(camera.position, {
          x: worldPos.x * 0.9,
          y: worldPos.y * 0.9,
          z: worldPos.z * 0.9,
          duration: 0.8,
          ease: 'power2.in',
          onUpdate: () => {
            camera.lookAt(worldPos);
          }
        })
        .to('.cyber-node-label', {
          opacity: 0,
          scale: 0.5,
          duration: 0.3
        }, '<')
        .to(flash, {
          opacity: 1,
          duration: 0.3
        }, '-=0.2');
      });
    });

    // ── PROJECTION & OCCLUSION LOGIC ────────────────────────
    function updateNodeScreenPositions() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      const camPosDir = camera.position.clone().normalize();

      NODES.forEach(node => {
        if (!node.mesh || !node.el) return;

        const worldPos = new THREE.Vector3();
        node.mesh.getWorldPosition(worldPos);

        const vec = worldPos.clone().project(camera);

        const nodeDir = worldPos.clone().normalize();
        const facing = camPosDir.dot(nodeDir); // >0 = facing camera side

        // Occlusion Check: is the node facing away relative to globe center?
        const behindGlobe = facing < 0.15;
        node.el.style.opacity = behindGlobe ? '0.12' : '1';
        node.el.style.pointerEvents = behindGlobe ? 'none' : 'auto';
        node.el.style.filter = behindGlobe ? 'grayscale(1) blur(1px)' : 'none';

        const x = (vec.x * 0.5 + 0.5) * width;
        const y = (-vec.y * 0.5 + 0.5) * height;

        node.el.style.left = `${x}px`;
        node.el.style.top = `${y}px`;

        const scale = 1.3 - vec.z * 0.5;
        node.el.style.transform = `translate(-50%, -50%) scale(${Math.max(0.6, Math.min(1.3, scale)).toFixed(2)})`;
      });
    }

    // ── ENTRY ZOOM ANIMATION ──────────────────────────────
    function handleEntryAnimation() {
      const transitionInNode = sessionStorage.getItem('nexus-transition-in');
      if (!transitionInNode) return;
      sessionStorage.removeItem('nexus-transition-in');

      flash.style.opacity = 1;
      const labels = document.querySelectorAll('.cyber-node-label');
      labels.forEach(l => l.style.opacity = 0);

      camera.position.set(0, 0, 0.4);

      const tl = gsap.timeline();
      tl.to(flash, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out'
      })
      .to(camera.position, {
        x: 0,
        y: 0,
        z: 5,
        duration: 0.8,
        ease: 'power2.out'
      }, '<')
      .to(labels, {
        opacity: 1,
        duration: 0.4
      });
    }

    handleEntryAnimation();

    // ── PERFORMANCE SAMPLER FALLBACK ──────────────────────
    function detectPerformanceTier() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        applyTier('low');
        return;
      }

      const start = performance.now();
      let frames = 0;

      function sample(now) {
        frames++;
        if (now - start < 1200) {
          requestAnimationFrame(sample);
        } else {
          const fps = frames / 1.2;
          if (fps < 40) applyTier('low');
        }
      }
      requestAnimationFrame(sample);
    }

    function applyTier(tier) {
      if (tier === 'low') {
        document.body.classList.add('reduced-3d');
        outerGeo.dispose();
        innerGeo.dispose();
        // Lower mesh density
        outerMesh.geometry = new THREE.IcosahedronGeometry(1.8, 0);
        innerMesh.geometry = new THREE.IcosahedronGeometry(1.0, 0);
      }
    }

    detectPerformanceTier();

    // Animation variables
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    let scrollSpeed = 0;
    let targetScrollSpeed = 0;

    // Parallax mouse movements
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 0.3;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 0.3;
    });

    // Scroll rotation speed transfer
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      targetScrollSpeed = Math.abs(currentScroll - lastScrollY) * 0.015;
      lastScrollY = currentScroll;
    });

    // Handle Resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    // Render loop
    const clock = new THREE.Clock();
    function tick() {
      const delta = clock.getDelta();

      scrollSpeed += (targetScrollSpeed - scrollSpeed) * 0.05;
      targetScrollSpeed *= 0.95;

      // Base rotations
      outerMesh.rotation.y += (0.04 + scrollSpeed) * delta;
      outerMesh.rotation.x += 0.015 * delta;

      innerMesh.rotation.y -= (0.02 + scrollSpeed * 0.5) * delta;
      innerMesh.rotation.x -= 0.01 * delta;

      // Slowly rotate the entire orbit group
      nodesGroup.rotation.y += (0.03 + scrollSpeed * 0.2) * delta;

      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      scene.rotation.y = targetX;
      scene.rotation.x = targetY;

      // Project positions & check occlusion
      updateNodeScreenPositions();

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }

    tick();
    } catch (err) {
      console.error("NEXUS 3D: Scenic engine failed to load:", err);
      document.body.classList.add('reduced-3d');
    }
  }

  // ── COMMAND PALETTE ESCAPE HATCH ────────────────────────
  function initCommandPalette() {
    const overlay = document.createElement('div');
    overlay.id = 'nexus-cmd-overlay';
    document.body.appendChild(overlay);

    const palette = document.createElement('div');
    palette.id = 'nexus-cmd-palette';
    palette.innerHTML = `
      <input type="text" id="nexus-cmd-input" placeholder="SEARCH SYSTEM NODES... (ESC to close)" autocomplete="off">
      <ul id="nexus-cmd-results"></ul>
    `;
    document.body.appendChild(palette);

    const input = document.getElementById('nexus-cmd-input');
    const results = document.getElementById('nexus-cmd-results');

    function filterResults() {
      const query = input.value.toLowerCase();
      const matches = NODES.filter(n => n.label.toLowerCase().replace('_', ' ').includes(query));

      results.innerHTML = matches.map((n, idx) => `
        <li class="nexus-cmd-item ${idx === 0 ? 'active' : ''}" data-href="${n.href}">
          <span>${n.label.replace('_', ' ')}</span>
          <span class="nexus-cmd-shortcut">Enter</span>
        </li>
      `).join('');

      document.querySelectorAll('.nexus-cmd-item').forEach(item => {
        item.onclick = () => {
          window.location.href = item.dataset.href;
        };
      });
    }

    function openPalette() {
      overlay.classList.add('open');
      palette.classList.add('open');
      input.value = '';
      filterResults();
      setTimeout(() => input.focus(), 50);
    }

    function closePalette() {
      overlay.classList.remove('open');
      palette.classList.remove('open');
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openPalette();
      }
      if (e.key === 'Escape') {
        closePalette();
      }
    });

    overlay.onclick = closePalette;
    input.oninput = filterResults;

    input.addEventListener('keydown', (e) => {
      const items = document.querySelectorAll('.nexus-cmd-item');
      let activeIdx = Array.from(items).findIndex(item => item.classList.contains('active'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeIdx < items.length - 1) {
          items[activeIdx].classList.remove('active');
          items[activeIdx + 1].classList.add('active');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIdx > 0) {
          items[activeIdx].classList.remove('active');
          items[activeIdx - 1].classList.add('active');
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0) {
          window.location.href = items[activeIdx].dataset.href;
        }
      }
    });
  }

  // Load Three.js & GSAP dynamically if not already present
  let libsLoaded = 0;
  function onLibLoaded() {
    libsLoaded++;
    if (libsLoaded === 2) {
      start3D();
      initCommandPalette();
    }
  }

  if (typeof THREE === 'undefined') {
    loadScript(THREE_CDN, onLibLoaded);
  } else {
    libsLoaded++;
  }

  if (typeof gsap === 'undefined') {
    loadScript(GSAP_CDN, onLibLoaded);
  } else {
    libsLoaded++;
  }

  if (libsLoaded === 2) {
    start3D();
    initCommandPalette();
  }
})();

