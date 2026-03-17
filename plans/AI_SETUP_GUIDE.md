# AI Intelligence Setup Guide: Step-by-Step

> Everything you need to set up the intelligence layer (ZeroClaw + mem0 + Free API keys) for Realtors' Practice on your Oracle Free Tier VM.
> See `AI_INTELLIGENCE.md` for the full architecture. This guide covers the Oracle VM setup steps.
> Written for someone who has never deployed AI models before. Every command is explained.

---

## Prerequisites

Before you start, you need:

- [x] Oracle Cloud account with Always Free tier
- [x] ARM VM created (VM.Standard.A1.Flex — **2 OCPU, 12 GB RAM**, Ubuntu 22.04/24.04)
- [ ] SSH access to your VM (you should have the private key from Oracle)
- [ ] Your VM's public IP address (find it in Oracle Cloud Console > Compute > Instances)

---

## Step 1: Connect to Your VM

Open a terminal on your computer and SSH in:

```bash
# Replace with your actual key path and VM IP
ssh -i ~/path/to/your-private-key.pem ubuntu@YOUR_VM_IP
```

> **What this does:** Connects you to your Oracle VM via secure shell. You'll run all remaining commands on the VM, not your laptop.

If you get a permissions error on the key:

```bash
chmod 600 ~/path/to/your-private-key.pem
```

---

## Step 2: Initial Server Setup

```bash
# Update the system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git htop tmux ufw python3 python3-pip python3-venv

# Set up firewall (only allow SSH + your AI API port)
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 8000/tcp    # AI API (ZeroClaw gateway) — restrict to your backend IP later
sudo ufw enable

# Check your resources
free -h   # Should show ~12 GB total
nproc     # Should show 2
```

> **What this does:** Updates the OS, installs tools you'll need, and sets up a firewall so only SSH and your AI API port are open.

---

## Step 3: Install Ollama

```bash
# One-line Ollama installer (works on ARM)
curl -fsSL https://ollama.com/install.sh | sh

# Verify it's running
ollama --version
systemctl status ollama
```

> **What this does:** Installs Ollama, which is the engine that runs AI models on your server. It starts automatically as a system service on port 11434.

### Configure Ollama for Resource Optimization

```bash
# Create Ollama environment overrides
sudo mkdir -p /etc/systemd/system/ollama.service.d/
sudo tee /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
# Only load 1 model at a time (saves RAM)
Environment="OLLAMA_MAX_LOADED_MODELS=1"
# No GPU (we're CPU-only on ARM)
Environment="OLLAMA_MAX_VRAM=0"
# Listen on all interfaces (so your backend can reach it)
Environment="OLLAMA_HOST=0.0.0.0"
# Limit RAM usage to 10GB (leaves 2GB for OS + other services)
MemoryMax=10G
# If system is under memory pressure, kill Ollama last
OOMScoreAdjust=-500
EOF

# Reload and restart Ollama with new settings
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

> **What this does:** Tells Ollama to only keep 1 model in RAM at a time, use CPU only, and caps its total memory usage at 10GB. This prevents it from eating all your RAM.

---

## Step 4: Download Qwen 3 8B

```bash
# Download the model (~5GB, takes a few minutes)
ollama pull qwen3:8b

# Test it works
ollama run qwen3:8b "What is the capital of Nigeria? /no_think"
```

> **What this does:** Downloads the Qwen 3 8B model (Q4_K_M quantized by default in Ollama). The test prompt should return "Abuja" almost immediately.
>
> **The `/no_think` flag:** Tells Qwen to skip chain-of-thought reasoning and answer directly. Use this for simple tasks (fast). Omit it or use `/think` for complex tasks (slower but smarter).

### Test inference speed

```bash
# Run a quick benchmark
time ollama run qwen3:8b "Write a 3-paragraph market report about property prices in Lekki, Lagos. /think" --verbose
```

You should see output at ~3-7 tokens/second. This is normal for 2 ARM cores. The `eval rate` in the verbose output tells you the exact speed.

---

## Step 5: Download the Embedding Model

```bash
# Download nomic-embed-text (~274MB, quick download)
ollama pull nomic-embed-text

# Test it works
curl http://localhost:11434/api/embed -d '{"model": "nomic-embed-text", "input": "3 bedroom flat in Lekki"}'
```

> **What this does:** Downloads a small embedding model that converts text into numerical vectors. mem0 uses this to store and search memories. Because we set `OLLAMA_MAX_LOADED_MODELS=1`, Ollama will swap between Qwen and nomic-embed-text as needed (takes ~5-10 seconds per swap).

---

## Step 6: Install Qdrant (Vector Database)

```bash
# Download Qdrant binary (ARM-compatible)
curl -L https://github.com/qdrant/qdrant/releases/latest/download/qdrant-aarch64-unknown-linux-musl.tar.gz -o qdrant.tar.gz
tar -xzf qdrant.tar.gz
sudo mv qdrant /usr/local/bin/
rm qdrant.tar.gz

# Create data directory
sudo mkdir -p /var/lib/qdrant
sudo chown ubuntu:ubuntu /var/lib/qdrant

# Create Qdrant config (optimized for low RAM)
mkdir -p ~/.qdrant
cat > ~/.qdrant/config.yaml << 'EOF'
storage:
  storage_path: /var/lib/qdrant/storage
  # Use memory-mapped files instead of loading all data into RAM
  # This keeps RAM usage low even with many vectors
  optimizers:
    memmap_threshold_kb: 20000
  performance:
    max_search_threads: 1  # Only 2 cores, keep 1 for inference

service:
  host: 127.0.0.1  # Only listen locally (security)
  grpc_port: 6334
  http_port: 6333
EOF

# Create systemd service
sudo tee /etc/systemd/system/qdrant.service << 'EOF'
[Unit]
Description=Qdrant Vector Database
After=network.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/local/bin/qdrant --config-path /home/ubuntu/.qdrant/config.yaml
Restart=always
RestartSec=5
MemoryMax=512M
OOMScoreAdjust=500

[Install]
WantedBy=multi-user.target
EOF

# Start Qdrant
sudo systemctl daemon-reload
sudo systemctl enable qdrant
sudo systemctl start qdrant

# Verify
curl http://localhost:6333/healthz
```

> **What this does:** Installs Qdrant, a lightweight vector database that mem0 uses to store AI memories. It's configured to use memory-mapped files (low RAM usage) and capped at 512MB.

---

## Step 7: Install mem0

```bash
# Create a Python virtual environment for the AI services
python3 -m venv ~/ai-env
source ~/ai-env/bin/activate

# Install mem0
pip install mem0ai

# Test mem0 can connect to Ollama and Qdrant
python3 << 'PYEOF'
from mem0 import Memory

config = {
    "llm": {
        "provider": "ollama",
        "config": {
            "model": "qwen3:8b",
            "ollama_base_url": "http://localhost:11434",
        }
    },
    "embedder": {
        "provider": "ollama",
        "config": {
            "model": "nomic-embed-text",
            "ollama_base_url": "http://localhost:11434",
        }
    },
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "host": "localhost",
            "port": 6333,
            "collection_name": "rp_memories",
        }
    }
}

m = Memory.from_config(config)

# Store a test memory
m.add("The user is interested in properties in Lekki Phase 1", user_id="test")

# Search memories
results = m.search("Lekki properties", user_id="test")
print("Memory search results:", results)

# Clean up test
m.delete_all(user_id="test")
print("mem0 is working!")
PYEOF
```

> **What this does:** Creates an isolated Python environment and installs mem0. The test script stores a memory, searches for it, and cleans up. If it prints "mem0 is working!" then everything is connected.

---

## Step 8: Install Docker & Agent Zero

Agent Zero is an open-source autonomous AI agent framework. It can write code, execute terminal commands, self-correct errors, and orchestrate multi-step workflows — all inside a secure Docker container. It connects to Ollama for local inference.

```bash
# Install Docker (ARM-compatible)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# Verify Docker
docker --version
docker run hello-world
```

> **What this does:** Installs Docker, which Agent Zero uses to run code in a sandboxed container. The `hello-world` test confirms Docker is working.

### Clone & Configure Agent Zero

```bash
# Clone Agent Zero
cd ~
git clone https://github.com/agent0ai/agent-zero.git
cd agent-zero

# Copy the example env file
cp .env.example .env
```

Edit `~/agent-zero/.env` to connect to local Ollama:

```env
# LLM Provider — use local Ollama (Qwen 3 8B)
CHAT_MODEL_PROVIDER=ollama
CHAT_MODEL_NAME=qwen3:8b
CHAT_MODEL_BASE_URL=http://host.docker.internal:11434/v1

# Embedding — use local Ollama (nomic-embed-text)
EMBEDDING_MODEL_PROVIDER=ollama
EMBEDDING_MODEL_NAME=nomic-embed-text
EMBEDDING_MODEL_BASE_URL=http://host.docker.internal:11434/v1

# Fallback to Gemini for real-time chat
FALLBACK_MODEL_PROVIDER=google
FALLBACK_MODEL_NAME=gemini-2.0-flash
GOOGLE_API_KEY=YOUR_GEMINI_KEY_HERE
```

> **What this does:** Tells Agent Zero to use your local Ollama (Qwen 3 8B) for all AI tasks, and fall back to Gemini Flash for real-time user-facing chat. `host.docker.internal` lets the Docker container reach Ollama running on the host.

### Test Agent Zero

```bash
cd ~/agent-zero

# Start Agent Zero
docker compose up -d

# Check it's running
docker compose ps

# Test via the web UI (open http://YOUR_VM_IP:50001 in a browser)
# Or test via API:
curl http://localhost:50001/api/health
```

> **What this does:** Starts Agent Zero in Docker. The web UI on port 50001 lets you chat with the agent and test tasks. The API health endpoint confirms it's connected to Ollama.

---

## Step 9: Create systemd Service for Agent Zero

```bash
sudo tee /etc/systemd/system/agent-zero.service << 'EOF'
[Unit]
Description=Agent Zero AI Framework (Realtors Practice)
After=network.target docker.service ollama.service qdrant.service
Requires=docker.service ollama.service qdrant.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/agent-zero
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=always
RestartSec=10
# Agent Zero uses ~300-500 MB RAM — generous limit for safety
MemoryMax=1G
# Under memory pressure, kill Agent Zero before Ollama
OOMScoreAdjust=200

[Install]
WantedBy=multi-user.target
EOF

# Start the service
sudo systemctl daemon-reload
sudo systemctl enable agent-zero
sudo systemctl start agent-zero

# Verify all services
systemctl status ollama qdrant agent-zero
```

> **What this does:** Creates a systemd service that runs Agent Zero via Docker Compose. Your backend sends HTTP requests to port 50001, Agent Zero processes them using Ollama/Qwen, and returns results. Capped at 1GB RAM with auto-restart.

---

## Step 10: Test Everything

```bash
# 1. Health check — Agent Zero
curl http://localhost:50001/api/health

# 2. Health check — Ollama
curl http://localhost:11434/api/ps

# 3. Health check — Qdrant
curl http://localhost:6333/healthz

# 4. Test inference via Ollama directly
curl http://localhost:11434/api/generate -d '{"model": "qwen3:8b", "prompt": "What is the capital of Nigeria? /no_think", "stream": false}'

# 5. Test Agent Zero via web UI
# Open http://YOUR_VM_IP:50001 in a browser
# Ask: "Parse this Nigerian property query into structured JSON: 3 bedroom self-con in VI under 5m"

# 6. Check resources
free -h && htop
```

---

## Step 11: Secure the VM

```bash
# Only allow your backend server's IP to access Agent Zero's port
sudo ufw delete allow 50001/tcp 2>/dev/null
sudo ufw allow from YOUR_BACKEND_IP to any port 50001 proto tcp
sudo ufw status
```

---

## Step 12: Connect Your Backend

Add to your backend `.env` (or Doppler):

```
AI_SERVICE_URL=http://YOUR_ORACLE_VM_IP:50001
AI_ENABLED=true
```

---

## Step 13: RAM Monitoring (Recommended)

```bash
cat > ~/monitor.sh << 'BASH'
#!/bin/bash
FREE_MB=$(free -m | awk '/^Mem:/ {print $7}')
if [ "$FREE_MB" -lt 1500 ]; then
    echo "WARNING: Only ${FREE_MB}MB free at $(date)" >> /var/log/rp-ram-alert.log
fi
BASH
chmod +x ~/monitor.sh
(crontab -l 2>/dev/null; echo "* * * * * /home/ubuntu/monitor.sh") | crontab -
```

---

## Quick Reference

```bash
# Service management
systemctl status ollama qdrant agent-zero
sudo systemctl restart ollama
sudo systemctl restart agent-zero
journalctl -u agent-zero -f

# Agent Zero logs
cd ~/agent-zero && docker compose logs -f

# Check loaded models
curl http://localhost:11434/api/ps

# Force unload model (free RAM)
curl -X DELETE http://localhost:11434/api/generate -d '{"model": "qwen3:8b", "keep_alive": 0}'

# RAM check
free -h
```

## Troubleshooting

| Problem                        | Solution                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Ollama won't start             | `journalctl -u ollama -n 50`                                                     |
| Agent Zero won't start         | `cd ~/agent-zero && docker compose logs`                                         |
| Agent Zero can't reach Ollama  | Verify `host.docker.internal` resolves: `docker exec -it agent-zero ping host.docker.internal` |
| OOM kills processes            | Reduce context: set `"num_ctx": 2048` in Ollama override                         |
| Slow inference (<2 t/s)        | Check `htop` for CPU contention                                                  |
| Qdrant won't start             | Check disk: `df -h`                                                              |
| Port 50001 unreachable         | Check UFW + Oracle Security List                                                 |
| Docker won't start on ARM      | `sudo systemctl restart docker && journalctl -u docker -n 50`                    |

---

## Architecture Summary

```
Frontend (Vercel) -> Backend (Render) -> Oracle Free VM (2 OCPU, 12 GB)
                                              |
                                              +-- Ollama :11434
                                              |     +-- Qwen 3 8B (~5.5 GB)
                                              |     +-- nomic-embed-text (swapped)
                                              |
                                              +-- Qdrant :6333 (~300 MB)
                                              |     +-- mem0 vector storage
                                              |
                                              +-- Agent Zero :50001 (~300-500 MB)
                                              |     +-- Python + Docker sandbox
                                              |     +-- Code execution & self-correction
                                              |     +-- Multi-agent delegation
                                              |     +-- Web UI for testing
                                              |
                                              +-- mem0 + Python (~200 MB)
                                              |     +-- Persistent AI memory
                                              |
                                              +-- Gemini Flash (cloud fallback)

Total: ~6.5-8 GB of 12 GB used. ~4-5.5 GB headroom.
```

---

_Created 2026-03-16 for Realtors' Practice. Uses Qwen 3 8B + Agent Zero + mem0 on Oracle Free Tier._
