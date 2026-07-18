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
        let changed = false;
        if (cloudData) {
          for (const key in cloudData) {
            if (key.endsWith('_updatedAt')) continue;
            if (key === '_nexus_pending') continue;
            const localRaw = localStorage.getItem(key);
            if (localRaw) {
              try {
                const local = JSON.parse(localRaw);
                const cloudVal = cloudData[key];
                let localTs = 0, cloudTs = 0;
                if (Array.isArray(local)) {
                  localTs = JSON.parse(localStorage.getItem(key + '_updatedAt') || '0');
                  cloudTs = cloudData[key + '_updatedAt'] || 0;
                } else {
                  localTs = local._updatedAt || 0;
                  cloudTs = cloudVal._updatedAt || 0;
                }
                if (cloudTs > localTs) {
                  localStorage.setItem(key, JSON.stringify(cloudVal));
                  if (Array.isArray(cloudVal) && cloudData[key + '_updatedAt']) {
                    localStorage.setItem(key + '_updatedAt', JSON.stringify(cloudData[key + '_updatedAt']));
                  }
                  changed = true;
                }
              } catch {
                changed = true;
              }
            } else {
              localStorage.setItem(key, JSON.stringify(cloudData[key]));
              if (cloudData[key + '_updatedAt']) {
                localStorage.setItem(key + '_updatedAt', JSON.stringify(cloudData[key + '_updatedAt']));
              }
              changed = true;
            }
          }
        }
        if (changed) {
          if (typeof render === 'function') render();
          if (typeof renderCustomList === 'function') renderCustomList();
          if (typeof loadLog === 'function') loadLog();
        }
      });
    }
  });
}

// Dynamically load Firebase SDKs sequentially to guarantee execution order
(function loadFirebaseSDKs() {
  const v = "10.12.0";
  const scripts = [
    `https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`,
    `https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`,
    `https://www.gstatic.com/firebasejs/${v}/firebase-database-compat.js`
  ];
  let index = 0;
  function loadNext() {
    if (index >= scripts.length) {
      initFirebase();
      return;
    }
    const s = document.createElement('script');
    s.src = scripts[index];
    s.onload = () => {
      index++;
      loadNext();
    };
    s.onerror = (err) => {
      console.error("NEXUS: Firebase SDK failed to load: " + scripts[index], err);
      if (index === 0) {
        document.getElementById('fb-sync-status').textContent = '🔴 Firebase unavailable (offline?)';
      }
      updateSyncUI();
    };
    document.head.appendChild(s);
  }
  loadNext();
})();

// ── STORAGE ──────────────────────────────────────────────
const S = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => {
    const now = Date.now();
    let val = v;
    if (typeof v === 'object' && v !== null) {
      if (Array.isArray(v)) {
        localStorage.setItem(k + '_updatedAt', JSON.stringify(now));
        val = v;
      } else {
        val = { ...v, _updatedAt: now };
      }
    }
    localStorage.setItem(k, JSON.stringify(val));
    if (currentUser && db) db.ref(`users/${currentUser.uid}/${k}`).set(val).catch(console.error);
    if (Array.isArray(v) && currentUser && db) {
      db.ref(`users/${currentUser.uid}/${k}_updatedAt`).set(now).catch(console.error);
    }
    window.dispatchEvent(new CustomEvent('nexus-state-change', { detail: { key: k, val } }));
  },
  del: k => {
    localStorage.removeItem(k);
    localStorage.removeItem(k + '_updatedAt');
    window.dispatchEvent(new CustomEvent('nexus-state-change', { detail: { key: k, val: null } }));
    if (currentUser && db) {
      db.ref(`users/${currentUser.uid}/${k}`).remove().catch(err => {
        console.error("NEXUS: Firebase delete failed, queuing for retry:", err);
        const queue = JSON.parse(localStorage.getItem('_nexus_pending') || '[]');
        queue.push({ type: 'del', key: k, ts: Date.now() });
        localStorage.setItem('_nexus_pending', JSON.stringify(queue));
      });
      db.ref(`users/${currentUser.uid}/${k}_updatedAt`).remove().catch(() => {});
    }
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
    id: 'p1',
    phase_id: 1,
    title: "Local Substrate & Network Primitives",
    duration: "Weeks 1-2",
    status: "pending",
    topics: [
      "Git Ledger (Trunk-based development, Atomic commits)",
      "Linux Internals (ip route, namespaces, systemd, strace)",
      "Network Protocols (CIDR math, TCP State Machine, DNS resolution)",
      "Packet Analysis (tcpdump, Wireshark basics)"
    ],
    resources: [
      {"type": "Book", "title": "TCP/IP Illustrated, Vol 1 (Routing & TCP chapters)"},
      {"type": "Zine", "title": "Julia Evans' Networking Zines (tcpdump, dig)"},
      {"type": "Docs", "title": "Linux man pages (man ip-route, man tcpdump)"}
    ],
    primary_artifact: "Capture the exact TCP SYN/ACK handshake of your C-based E-Voting server using tcpdump.",
    label: "Phase 1",
    phase: "Local Substrate & Network Primitives"
  },
  {
    id: 'p2',
    phase_id: 2,
    title: "Process Isolation & Packaging",
    duration: "Weeks 3-4",
    status: "pending",
    topics: [
      "Kernel Isolation (namespaces, cgroups via unshare)",
      "Docker Mechanics (Multi-stage builds, non-root execution)",
      "Container Networking (Bridge networks, internal DNS)",
      "State Management (Docker volumes)"
    ],
    resources: [
      {"type": "Docs", "title": "Official Docker Engine Documentation (Networking & Storage)"},
      {"type": "Video", "title": "Hussein Nasser: Docker Networking Explained"},
      {"type": "Docs", "title": "man unshare, man cgroups"}
    ],
    primary_artifact: "Write a docker-compose.yml for Sankat. FastAPI and PostgreSQL must communicate via an internal bridge. Port 5432 remains unexposed to the host.",
    label: "Phase 2",
    phase: "Process Isolation & Packaging"
  },
  {
    id: 'p3',
    phase_id: 3,
    title: "The Declarative Cloud (IaC)",
    duration: "Months 2-3",
    status: "pending",
    topics: [
      "Cloud Networking (VPCs, Subnets, Internet/NAT Gateways, Security Groups)",
      "Terraform Syntax (HCL, Providers, Resources, Variables)",
      "State Management (Remote backends, State locking)",
      "Modular Architecture (Terraform modules)"
    ],
    resources: [
      {"type": "Docs", "title": "Terraform Official Registry & HashiCorp Learn"},
      {"type": "Docs", "title": "AWS/Azure VPC Architectural Concepts"}
    ],
    primary_artifact: "Write a Terraform manifest provisioning an isolated Cloud VPC, deploying your containerized Sankat backend onto a VM inside the public subnet.",
    label: "Phase 3",
    phase: "The Declarative Cloud (IaC)"
  },
  {
    id: 'p4',
    phase_id: 4,
    title: "Global Orchestration (Kubernetes)",
    duration: "Months 4-5",
    status: "pending",
    topics: [
      "Go Deep Dive (Goroutines, channels - to understand K8s controllers)",
      "Control Plane Architecture (etcd, kube-apiserver, kubelet, kube-proxy)",
      "Declarative Workloads (Pods, Deployments, ReplicaSets)",
      "Service Networking (ClusterIP, NodePort, Ingress Controllers)",
      "Configuration (ConfigMaps, Secrets, Persistent Volumes)"
    ],
    resources: [
      {"type": "Docs", "title": "Kubernetes Official Documentation (Concepts > Architecture)"},
      {"type": "Repo", "title": "Kelsey Hightower: Kubernetes the Hard Way"},
      {"type": "Video", "title": "CNCF YouTube: KubeCon Networking Demystified"}
    ],
    primary_artifact: "Strip Docker Compose. Write K8s YAML manifests for Sankat. Deploy locally using K3s or Minikube.",
    label: "Phase 4",
    phase: "Global Orchestration (Kubernetes)"
  },
  {
    id: 'p5',
    phase_id: 5,
    title: "Automated Execution & Telemetry",
    duration: "Month 6",
    status: "pending",
    topics: [
      "CI/CD Pipelines (Automated testing, image building, registry pushing)",
      "Infrastructure Automation (Terraform apply via CI)",
      "Observability (Prometheus metrics collection)",
      "Data Visualization (Grafana Dashboards)",
      "Structured Logging"
    ],
    resources: [
      {"type": "Docs", "title": "GitHub Actions Official Documentation"},
      {"type": "Docs", "title": "Prometheus Official Concepts Guide"},
      {"type": "Docs", "title": "Grafana Dashboard Configuration Docs"}
    ],
    primary_artifact: "Build a GitHub Actions pipeline that auto-deploys your Docker image to K3s on main branch push. Monitor pod CPU with Prometheus.",
    label: "Phase 5",
    phase: "Automated Execution & Telemetry"
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
// Portfolio-focused replacement content. Keeping the same data shape preserves
// existing progress, project, log, and flashcard UI behavior.
ROADMAP.splice(0, ROADMAP.length, ...[
  {
    id: 'p1',
    phase_id: 1,
    title: "Portfolio Positioning",
    duration: "Week 1",
    status: "pending",
    topics: [
      "Define your engineering identity and target roles",
      "Write a short portfolio headline and about section",
      "Choose 3-5 proof themes: systems, web, tooling, data, or automation",
      "Set up public links: GitHub, LinkedIn, resume, Obsidian notes"
    ],
    resources: [
      { type: "Guide", title: "GitHub profile README examples" },
      { type: "Guide", title: "Developer portfolio copywriting notes" },
      { type: "Template", title: "One-page engineer positioning canvas" }
    ],
    primary_artifact: "Publish a clear portfolio landing page that says who you are, what you build, and where your notes/projects live.",
    label: "Phase 1",
    phase: "Portfolio Positioning"
  },
  {
    id: 'p2',
    phase_id: 2,
    title: "Project Evidence",
    duration: "Weeks 2-3",
    status: "pending",
    topics: [
      "Select flagship projects with real README files",
      "Add screenshots, live demos, setup steps, and decisions made",
      "Write one case study per serious project",
      "Track status, tech stack, GitHub URL, and live URL"
    ],
    resources: [
      { type: "Docs", title: "Make a README that explains the problem, tradeoffs, and result" },
      { type: "Checklist", title: "Project evidence checklist: demo, tests, screenshots, notes" },
      { type: "Example", title: "Engineering case study structure" }
    ],
    primary_artifact: "Turn one project into a complete portfolio case study with GitHub link, demo link, screenshots, and lessons learned.",
    label: "Phase 2",
    phase: "Project Evidence"
  },
  {
    id: 'p3',
    phase_id: 3,
    title: "Obsidian Engineering Journal",
    duration: "Weeks 3-4",
    status: "pending",
    topics: [
      "Create an Obsidian vault for daily logs, project notes, and decisions",
      "Use tags like #daily-log, #project, #bug, #decision, #learning",
      "Create templates for daily entries and project writeups",
      "Link notes back to portfolio projects and GitHub commits"
    ],
    resources: [
      { type: "Docs", title: "Obsidian URI links: obsidian://open?vault=..." },
      { type: "Template", title: "Daily engineering log template" },
      { type: "Template", title: "Project decision record template" }
    ],
    primary_artifact: "Create an Obsidian vault called Engineering Journey and link this website to it with an obsidian://open URL.",
    label: "Phase 3",
    phase: "Obsidian Engineering Journal"
  },
  {
    id: 'p4',
    phase_id: 4,
    title: "Public Proof System",
    duration: "Month 2",
    status: "pending",
    topics: [
      "Convert private notes into public-friendly summaries",
      "Publish weekly engineering notes or project retrospectives",
      "Add searchable commands, snippets, and concepts to the cheatsheet",
      "Keep sensitive/private details out of public exports"
    ],
    resources: [
      { type: "Guide", title: "Writing technical notes without oversharing" },
      { type: "Checklist", title: "Public note safety checklist" },
      { type: "Example", title: "Weekly learning log format" }
    ],
    primary_artifact: "Publish a weekly engineering digest: what you built, what broke, what you learned, and what you will improve.",
    label: "Phase 4",
    phase: "Public Proof System"
  },
  {
    id: 'p5',
    phase_id: 5,
    title: "Career Readiness",
    duration: "Month 3",
    status: "pending",
    topics: [
      "Tailor resume bullets around shipped projects and measurable outcomes",
      "Prepare project walkthrough stories for interviews",
      "Track applications, referrals, follow-ups, and outcomes",
      "Use flashcards for architecture, debugging, and project explanation practice"
    ],
    resources: [
      { type: "Template", title: "STAR project story template" },
      { type: "Checklist", title: "Portfolio review checklist before applying" },
      { type: "Practice", title: "Mock project walkthrough questions" }
    ],
    primary_artifact: "Apply to roles with a portfolio, resume, and project stories that all point to the same proof.",
    label: "Phase 5",
    phase: "Career Readiness"
  }
]);

FLASHCARDS.splice(0, FLASHCARDS.length, ...[
  { id: 'fc1', topic: 'Portfolio', q: 'What should your portfolio answer in the first 10 seconds?', a: 'Who you are, what kind of engineering work you do, your strongest proof, and where to inspect it. A visitor should quickly find your projects, GitHub, resume, and engineering notes.' },
  { id: 'fc2', topic: 'Portfolio', q: 'What makes a project portfolio-worthy?', a: 'It solves a clear problem, has runnable code or a demo, explains tradeoffs, includes screenshots or evidence, and documents what you learned or changed after debugging.' },
  { id: 'fc3', topic: 'Projects', q: 'What belongs in a strong project README?', a: 'Problem, features, tech stack, architecture notes, setup steps, screenshots or demo, tests, known limitations, and future improvements.' },
  { id: 'fc4', topic: 'Projects', q: 'How do you write a project case study?', a: 'Use: context, goal, constraints, architecture, hard problems, decisions, result, screenshots, lessons learned, and links. Keep it honest and specific.' },
  { id: 'fc5', topic: 'Obsidian', q: 'How should Obsidian connect to the portfolio?', a: 'Use Obsidian for private raw notes and the website for public proof. Export polished summaries from notes into project pages, logs, or weekly updates.' },
  { id: 'fc6', topic: 'Obsidian', q: 'What tags help document an engineering journey?', a: '#daily-log, #project, #bug, #decision, #architecture, #learning, #interview, #snippet, and #retrospective are a useful starting set.' },
  { id: 'fc7', topic: 'Writing', q: 'What is the best daily engineering log format?', a: 'Today I learned, today I built, errors/debugging, decision made, link to code/commit, and next step. Short but consistent beats long but rare.' },
  { id: 'fc8', topic: 'Writing', q: 'How do you turn a private note into a public post?', a: 'Remove secrets and rough speculation, add context, show the final lesson, include links or screenshots, and state what changed in your thinking or implementation.' },
  { id: 'fc9', topic: 'Interview', q: 'How should you explain a project in an interview?', a: 'Start with the problem and user, then your role, architecture, tradeoffs, hard bugs, result, and what you would improve next.' },
  { id: 'fc10', topic: 'Interview', q: 'What is a good answer to "Tell me about yourself" for an engineer?', a: 'A concise story: current stage, engineering interests, strongest project proof, what you are improving now, and the roles/problems you want to work on.' },
  { id: 'fc11', topic: 'Career', q: 'What should application tracking capture?', a: 'Company, role, source, date, status, job link, referral/contact, follow-up date, notes, and which portfolio proof you sent.' },
  { id: 'fc12', topic: 'Career', q: 'How can your portfolio help with referrals?', a: 'It gives people a low-effort way to understand your work and forward proof. A good project link is easier to recommend than a vague request.' },
  { id: 'fc13', topic: 'Systems', q: 'What should a decision record include?', a: 'Context, options considered, decision, reasons, consequences, date, and links to related code or notes.' },
  { id: 'fc14', topic: 'Systems', q: 'Why document bugs you fixed?', a: 'Debugging notes prove depth. They show how you isolate problems, test hypotheses, read errors, and improve systems after failure.' },
  { id: 'fc15', topic: 'GitHub', q: 'What makes a GitHub profile stronger?', a: 'Pinned relevant repositories, clean READMEs, meaningful commits, issue/PR history, screenshots, and a profile README that links to your portfolio.' },
  { id: 'fc16', topic: 'GitHub', q: 'What should commit messages communicate?', a: 'The intent of the change. Prefer specific messages like "Add project filtering by status" over vague messages like "update files".' },
  { id: 'fc17', topic: 'Proof', q: 'What is stronger: a certificate or a shipped project?', a: 'A shipped project is usually stronger because it shows applied skill. Certificates can help, but proof comes from working code, decisions, and results.' },
  { id: 'fc18', topic: 'Proof', q: 'How do you show progress without pretending to be senior?', a: 'Be specific and honest: "I built X, struggled with Y, learned Z, and next I am improving A." Growth plus evidence reads well.' },
  { id: 'fc19', topic: 'Review', q: 'What should you review before sharing the portfolio?', a: 'Broken links, mobile layout, spelling, project clarity, GitHub visibility, secret leakage, resume link, and whether the first screen says what you do.' },
  { id: 'fc20', topic: 'Review', q: 'What metric matters most for this site?', a: 'Consistency. The site becomes valuable when it accumulates logs, projects, decisions, and visible progress over weeks.' }
]);

RESOURCES.splice(0, RESOURCES.length, ...[
  { id: 'r1', name: 'Obsidian URI documentation', url: 'https://help.obsidian.md/Extending+Obsidian/Obsidian+URI', phase: 'Obsidian', type: 'Docs', free: true, icon: 'OB', desc: 'Use obsidian://open links from this site to your local vault and notes.' },
  { id: 'r2', name: 'Obsidian templates guide', url: 'https://help.obsidian.md/Plugins/Templates', phase: 'Obsidian', type: 'Docs', free: true, icon: 'MD', desc: 'Create reusable templates for daily logs, project notes, and decision records.' },
  { id: 'r3', name: 'GitHub profile README guide', url: 'https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/about-your-profile', phase: 'Portfolio', type: 'Docs', free: true, icon: 'GH', desc: 'Make your GitHub profile point to your best work and your portfolio.' },
  { id: 'r4', name: 'GitHub Pages', url: 'https://docs.github.com/en/pages', phase: 'Portfolio', type: 'Docs', free: true, icon: 'GH', desc: 'Free static hosting for this portfolio website.' },
  { id: 'r5', name: 'Vercel static deployments', url: 'https://vercel.com/docs/deployments', phase: 'Portfolio', type: 'Docs', free: true, icon: 'VX', desc: 'Another easy way to deploy and share this site publicly.' },
  { id: 'r6', name: 'Make a README', url: 'https://www.makeareadme.com/', phase: 'Projects', type: 'Guide', free: true, icon: 'RM', desc: 'Simple structure for README files that recruiters and engineers can scan.' },
  { id: 'r7', name: 'Keep a Changelog', url: 'https://keepachangelog.com/en/1.1.0/', phase: 'Projects', type: 'Guide', free: true, icon: 'CL', desc: 'A clean habit for documenting project changes over time.' },
  { id: 'r8', name: 'Architecture Decision Records', url: 'https://adr.github.io/', phase: 'Projects', type: 'Guide', free: true, icon: 'AD', desc: 'Use ADRs in Obsidian or repos to explain why you made technical choices.' },
  { id: 'r9', name: 'Google Technical Writing Courses', url: 'https://developers.google.com/tech-writing', phase: 'Writing', type: 'Course', free: true, icon: 'TW', desc: 'Improve the clarity of engineering notes and project writeups.' },
  { id: 'r10', name: 'Diataxis documentation framework', url: 'https://diataxis.fr/', phase: 'Writing', type: 'Guide', free: true, icon: 'DX', desc: 'Great mental model for tutorials, how-to guides, explanations, and references.' },
  { id: 'r11', name: 'STAR interview method', url: 'https://www.themuse.com/advice/star-interview-method', phase: 'Career', type: 'Guide', free: true, icon: 'ST', desc: 'Turn projects into interview stories with situation, task, action, and result.' },
  { id: 'r12', name: 'roadmap.sh Computer Science', url: 'https://roadmap.sh/computer-science', phase: 'Career', type: 'Practice', free: true, icon: 'CS', desc: 'Use this only as a gap map, not as a reason to delay building.' }
]);

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

  // Verify that the most recent entry was logged today or yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mostRecent = new Date(days[0]);
  const diffFromToday = (today - mostRecent) / (1000 * 60 * 60 * 24);
  if (diffFromToday > 1) return 0; // Streak is broken

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

function getFlashcardMastery() {
  const scores = S.get(KEYS.cards) || {};
  const vals = Object.values(scores);
  if (!vals.length) return 0;
  const know = vals.filter(v => v === 'know').length;
  return Math.round(know / vals.length * 100);
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
  if (el) el.textContent = `${streak}d log streak`;
}

function applyPortfolioChrome() {
  const brand = document.querySelector('.nav-brand');
  if (brand) brand.innerHTML = '<span>VISHAL</span> portfolio';

  const labels = {
    'index.html': 'Home',
    'log.html': 'Journal',
    'roadmap.html': 'Build Plan',
    'resources.html': 'Library',
    'flashcards.html': 'Practice',
    'projects.html': 'Projects',
    'jobs.html': 'Applications',
    'cheatsheet.html': 'Snippets'
  };

  document.querySelectorAll('nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (labels[href]) a.textContent = labels[href];
  });
}

function renderNav() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  applyPortfolioChrome();
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
      const existing = localStorage.getItem(key);
      const serialized = JSON.stringify(val);
      if (existing !== serialized) {
        localStorage.setItem(key, serialized);
        if (currentUser && db) {
          db.ref(`users/${currentUser.uid}/${key}`).set(val).catch(console.error);
        }
        window.dispatchEvent(new CustomEvent('nexus-state-change', { detail: { key, val } }));
      }
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
  a.download = `engineering-portfolio-backup-${todayStr()}.json`;
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

// ── 3D WEBGL ENGINE INJECTION ─────────────────────────────
(function initGlobal3DBg() {
  console.log("NEXUS 3D: Initializing background engine...");
  
  // Inject canvas and overlays synchronously on load (prevents layout popping during async script loading)
  const canvas = document.createElement('canvas');
  canvas.id = 'nexus-3d-bg';
  document.body.insertBefore(canvas, document.body.firstChild);

  const overlay = document.createElement('div');
  overlay.id = 'nexus-nodes-overlay';
  document.body.appendChild(overlay);

  const flash = document.createElement('div');
  flash.id = 'nexus-transition-overlay';
  document.body.appendChild(flash);

  // Synchronously hide page content immediately if transitioning or landing to prevent pops
  const transitionInNode = sessionStorage.getItem('nexus-transition-in');
  const isIndexPage = location.pathname.endsWith('index.html') || 
                      location.pathname.endsWith('/') || 
                      location.pathname === '' || 
                      !location.pathname.includes('.html');

  if (transitionInNode || isIndexPage) {
    document.body.classList.add('portal-open');
  }

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
  function getJobAppCount() {
    const apps = S.get(KEYS.apps) || [];
    return apps.length;
  }

  const NODES = [
    { id: 'dashboard', label: 'HOME', href: 'index.html', progress: null },
    { id: 'log', label: 'JOURNAL', href: 'log.html', progress: getLogStreak() },
    { id: 'roadmap', label: 'BUILD_PLAN', href: 'roadmap.html', progress: getRoadmapPct() },
    { id: 'resources', label: 'LIBRARY', href: 'resources.html', progress: null },
    { id: 'flashcards', label: 'PRACTICE', href: 'flashcards.html', progress: getFlashcardMastery() },
    { id: 'projects', label: 'PROJECTS', href: 'projects.html', progress: null },
    { id: 'jobs', label: 'APPLICATIONS', href: 'jobs.html', progress: getJobAppCount() },
    { id: 'cheatsheet', label: 'SNIPPETS', href: 'cheatsheet.html', progress: null },
  ];

  function formatReadout(node) {
    if (node.id === 'log' && node.progress) return `${node.progress}D_STREAK`;
    if (node.id === 'roadmap' && node.progress) return `${node.progress}%_COMPLETED`;
    if (node.id === 'flashcards' && node.progress) return `${node.progress}%_MASTERY`;
    if (node.id === 'jobs' && node.progress) return `${node.progress}_APPLICATIONS`;
    return 'ONLINE';
  }

  let libsFailed = false;
  function onLibFailed(src) {
    if (libsFailed) return;
    libsFailed = true;
    console.error("NEXUS 3D: Critical engine library failed to load: " + src);
    const flash = document.getElementById('nexus-transition-overlay');
    if (flash) {
      flash.style.opacity = '0';
      flash.style.pointerEvents = 'none';
    }
    document.body.classList.remove('portal-open');
    document.body.classList.add('reduced-3d');
  }

  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = () => onLibFailed(src);
    document.head.appendChild(s);
  }

  function start3D() {
    console.log("NEXUS 3D: Starting 3D scene build...");
    try {
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

    // Orbital Ring 1 (Cyan Latitude Ring)
    const ringGeo1 = new THREE.TorusGeometry(2.3, 0.007, 16, 100);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.22 });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = Math.PI * 0.35;
    scene.add(ringMesh1);

    // Orbital Ring 2 (Magenta Counter Ring)
    const ringGeo2 = new THREE.TorusGeometry(2.7, 0.005, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xff2d7a, transparent: true, opacity: 0.15 });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.rotation.x = -Math.PI * 0.25;
    scene.add(ringMesh2);

    // 3D Ambient Dust Particles
    const particleCount = 140;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 3.5 + Math.random() * 4.0;
      particlePositions[i] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i + 2] = r * Math.cos(phi);
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.035,
      transparent: true,
      opacity: 0.35
    });
    const particleCloud = new THREE.Points(particleGeo, particleMat);
    scene.add(particleCloud);

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
    const _worldPos = new THREE.Vector3();
    const _vec = new THREE.Vector3();
    const _nodeDir = new THREE.Vector3();
    const _camPosDir = new THREE.Vector3();

    function updateNodeScreenPositions() {
      if (!portalActive) return;
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.getWorldPosition(_camPosDir).normalize();

      NODES.forEach(node => {
        if (!node.mesh || !node.el) return;

        node.mesh.getWorldPosition(_worldPos);
        _vec.copy(_worldPos).project(camera);
        _nodeDir.copy(_worldPos).normalize();

        const facing = _camPosDir.dot(_nodeDir);

        const behindGlobe = facing < 0.15;
        node.el.classList.toggle('occluded', behindGlobe);

        const x = (_vec.x * 0.5 + 0.5) * width;
        const y = (-_vec.y * 0.5 + 0.5) * height;

        const scale = Math.max(0.6, Math.min(1.3, 1.3 - _vec.z * 0.5));
        node.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
      });
    }

    // ── UNIFIED PAGE LOAD TRANSITION ENGINE ─────────────────
    function handlePageLoadTransition() {
      const transitionInNode = sessionStorage.getItem('nexus-transition-in');
      
      const isIndexPage = location.pathname.endsWith('index.html') || 
                          location.pathname.endsWith('/') || 
                          location.pathname === '' || 
                          !location.pathname.includes('.html');

      if (transitionInNode) {
        sessionStorage.removeItem('nexus-transition-in');

        // Start with portal open during entry zoom
        togglePortalMode(true);

        flash.style.opacity = 1;
        const labels = document.querySelectorAll('.cyber-node-label');
        labels.forEach(l => l.style.opacity = 0);

        // Camera starts close inside the node
        camera.position.set(0, 0, 0.4);

        const tl = gsap.timeline({
          onComplete: () => {
            // Keep portal open on index landing, otherwise auto-close
            if (!isIndexPage) {
              setTimeout(() => {
                togglePortalMode(false);
              }, 250);
            } else {
              gsap.to(labels, { opacity: 1, duration: 0.3 });
            }
          }
        });
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
      } else {
        // Cold load (direct visit or refresh)
        const labels = document.querySelectorAll('.cyber-node-label');
        if (isIndexPage) {
          togglePortalMode(true);
          camera.position.z = 4.2;
          gsap.to(flash, {
            opacity: 0,
            duration: 0.5,
            ease: 'power2.out'
          });
        } else {
          togglePortalMode(false);
          labels.forEach(l => l.style.opacity = 0);
          gsap.to(flash, {
            opacity: 0,
            duration: 0.4,
            ease: 'power2.out'
          });
        }
      }
    }

    // ── PORTAL TOGGLE STATE MACHINE ───────────────────────
    let portalActive = false;
    function togglePortalMode(forceState) {
      const body = document.body;
      const toggle = document.getElementById('portal-toggle-btn');
      
      portalActive = (typeof forceState === 'boolean') ? forceState : !portalActive;

      if (portalActive) {
        body.classList.add('portal-open');
        const labels = document.querySelectorAll('.cyber-node-label');
        labels.forEach(l => l.style.opacity = 1);
        if (toggle) {
          toggle.innerHTML = '✕ CLOSE HUD';
          toggle.style.borderColor = 'var(--magenta)';
          toggle.style.color = 'var(--magenta)';
        }
        gsap.to(camera.position, {
          z: 4.2,
          duration: 0.6,
          ease: 'power2.out'
        });
      } else {
        body.classList.remove('portal-open');
        const labels = document.querySelectorAll('.cyber-node-label');
        labels.forEach(l => l.style.opacity = 0);
        if (toggle) {
          toggle.innerHTML = '🌐 3D NAVIGATION';
          toggle.style.borderColor = '';
          toggle.style.color = '';
        }
        gsap.to(camera.position, {
          z: 5.0,
          duration: 0.6,
          ease: 'power2.out'
        });
      }
    }

    // Inject toggle button dynamically into navbar
    const navRight = document.querySelector('.nav-right');
    if (navRight) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn btn-primary btn-sm';
      toggleBtn.id = 'portal-toggle-btn';
      toggleBtn.innerHTML = '🌐 3D NAVIGATION';
      toggleBtn.style.marginRight = '8px';
      toggleBtn.onclick = () => togglePortalMode();
      navRight.insertBefore(toggleBtn, navRight.firstChild);
    }

    handlePageLoadTransition();

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



    // ── DRAG-TO-SPIN CONTROL SYSTEM ──────────────────────────
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let dragVelocityX = 0;
    let dragVelocityY = 0;
    let scrollSpeed = 0;
    let targetScrollSpeed = 0;

    const dragContainer = overlay; // absolute overlays cover click areas

    function onPointerDown(e) {
      if (e.target.closest('.node-btn')) return;
      isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      previousMousePosition = { x: clientX, y: clientY };
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - previousMousePosition.x;
      const deltaY = clientY - previousMousePosition.y;

      // Update rotational velocity based on delta drag coordinates
      dragVelocityY = deltaX * 0.005;
      dragVelocityX = deltaY * 0.005;

      previousMousePosition = { x: clientX, y: clientY };
    }

    function onPointerUp() {
      isDragging = false;
    }

    // Drag-to-spin Event Listeners
    dragContainer.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    dragContainer.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp, { passive: true });

    // Scroll rotation speed transfer (coalesced via rAF)
    let lastScrollY = window.scrollY;
    let scrollPending = false;
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      targetScrollSpeed = Math.abs(currentScroll - lastScrollY) * 0.015;
      lastScrollY = currentScroll;
      if (!scrollPending) {
        scrollPending = true;
        requestAnimationFrame(() => { scrollPending = false; });
      }
    }, { passive: true });

    // Handle Resize (coalesced via rAF)
    let resizePending = false;
    window.addEventListener('resize', () => {
      if (resizePending) return;
      resizePending = true;
      requestAnimationFrame(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        resizePending = false;
      });
    });

    // Render loop
    const clock = new THREE.Clock();
    function tick() {
      const rawDelta = clock.getDelta();
      const delta = Math.min(rawDelta, 0.1);

      scrollSpeed += (targetScrollSpeed - scrollSpeed) * 0.05;
      targetScrollSpeed *= 0.95;

      // Friction decay for drag velocity
      if (!isDragging) {
        dragVelocityY *= 0.95;
        dragVelocityX *= 0.95;
      }

      // Base lazy auto-spin velocity
      const autoSpinY = 0.05 * delta;

      // Apply drag coordinates + base spin to meshes
      outerMesh.rotation.y += dragVelocityY + autoSpinY;
      outerMesh.rotation.x += dragVelocityX;

      nodesGroup.rotation.y += dragVelocityY + autoSpinY;
      nodesGroup.rotation.x += dragVelocityX;

      // Inner core counter-spins
      innerMesh.rotation.y -= (0.02 + scrollSpeed * 0.5) * delta;
      innerMesh.rotation.x -= 0.008 * delta;

      // Orbital Rings Rotation
      if (typeof ringMesh1 !== 'undefined') {
        ringMesh1.rotation.z += 0.08 * delta;
        ringMesh2.rotation.z -= 0.05 * delta;
      }

      // Particle Cloud Ambient Motion
      if (typeof particleCloud !== 'undefined') {
        particleCloud.rotation.y += 0.015 * delta;
      }

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
    if (libsFailed) return;
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
