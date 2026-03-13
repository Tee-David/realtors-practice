# AI Intelligence Setup Guide — Step by Step

> A simple, beginner-friendly walkthrough to set up the AI Intelligence layer (**Ollama + BitNet + ZeroClaw + Oracle Free Tier**) for the Realtors' Practice platform.

---

## Overview — What You're Setting Up

| Component | What It Does | Cost |
|---|---|---|
| **Oracle Free VM** | A free cloud server (4 ARM cores, 24GB RAM) that runs your AI models 24/7 | $0 |
| **BitNet b1.58** | ⚡ The **fast** AI model (~400MB, 2B params) — handles quick tasks like parsing, tagging, scoring | $0 |
| **Ollama (Llama 3 8B)** | 🧠 The **smart** AI model (~4.5GB, 8B params) — handles reasoning, reports, chat, analysis | $0 |
| **ZeroClaw** | A lightweight agent runtime that gives the AI memory, tools, and scheduled tasks | $0 |
| **Backend AI Service** | New routes in your Node.js backend that call the AI | $0 |
| **Frontend AI Chat** | A floating chat widget + insight cards that use the AI | $0 |

**Why two models?** BitNet is 3x faster but only 2B parameters (not very smart). Ollama runs Llama 3 at 8B parameters — it actually *reasons* well. The AI router picks the right one:
- ⚡ **BitNet** → query parsing, classification, scoring (speed matters)
- 🧠 **Ollama** → chat, reports, fraud detection, investment analysis (brains matter)
- 🟢 **Gemini Flash** → optional cloud fallback (free tier — you already have a key)

**Total: $0/month** — everything runs locally on the free Oracle VM

---

## ⚠️ Quick Legend

| Icon | Meaning |
|---|---|
| 🟢 | **I (Antigravity) can do this for you** — code changes, file creation |
| 🔵 | **You need to do this** — account creation, server access, deployments |
| 🟡 | **We do this together** — I write the code, you run it on the server |

---

## PHASE 1: Oracle Cloud Free VM Setup

> **Estimated Time:** 30–45 minutes  
> **Who:** 🔵 You do this

### Step 1: Create an Oracle Cloud Account

1. Go to [oracle.com/cloud/free](https://oracle.com/cloud/free)
2. Click **"Start for free"**
3. Fill in your details (name, email, country)
4. You'll need a **credit card for verification** — but you will NOT be charged. Oracle's "Always Free" tier is permanently free, not a trial
5. Choose your **home region** — pick one closest to your users (e.g., `UK South (London)` or `Germany Central (Frankfurt)` for EU, or `US East` for US)
6. Complete signup and verify your email

### Step 2: Create an ARM VM Instance

1. Log into [cloud.oracle.com](https://cloud.oracle.com)
2. Go to **Compute → Instances → Create Instance**
3. Configure:

   | Setting | Value |
|---|---|
| **Name** | `realtors-ai` |
| **Image** | Ubuntu 22.04 (Canonical) |
| **Shape** | Click "Change Shape" → **Ampere** → `VM.Standard.A1.Flex` |
| **OCPUs** | 2 (to save 2 for other projects) or 4 |
| **Memory** | 12 GB (to save 12 for other projects) or 24 GB |
| **Boot Volume** | 100 GB (default, can go up to 200GB free) |

4. Under **"Add SSH keys"**:
   - Select **"Generate a key pair"**
   - Click **"Save Private Key"** — download the `.key` file
   - **KEEP THIS FILE SAFE** — you'll need it to connect to your server
5. Click **"Create"**

### Step 3: Connect to Your VM

Once the instance shows **"Running"** (may take 2–5 minutes):

1. Find the **Public IP Address** on the instance details page (e.g., `129.146.xx.xx`)
2. Open your terminal and connect:

```bash
# Make the key file secure
chmod 400 ~/Downloads/ssh-key-*.key

# Connect to your VM
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
```

3. You should now be logged into your Oracle VM! You'll see a prompt like `ubuntu@realtors-ai:~$`

### Step 4: Secure the VM (Basic Setup)

Run these commands on the VM:

```bash
# Update everything
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y python3 python3-pip python3-venv git cmake build-essential wget curl ufw

# Set up firewall — allow SSH + both AI API ports
sudo ufw allow 22/tcp
sudo ufw allow 8080/tcp    # BitNet API
sudo ufw allow 11434/tcp   # Ollama API
sudo ufw enable

# Confirm firewall is active
sudo ufw status
```

---

## PHASE 2: Install & Run BitNet

> **Estimated Time:** 20–30 minutes  
> **Who:** 🟡 I'll write the commands, you run them on the VM

### Step 5: Clone and Build BitNet

Run on your Oracle VM:

```bash
# Clone the BitNet repository
cd ~
git clone --recursive https://github.com/microsoft/BitNet.git
cd BitNet

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Download the model and build optimized inference engine
# This downloads ~400MB and compiles for ARM. Takes 5-10 minutes.
python setup_env.py -md microsoft/bitnet-b1.58-2B-4T -q i2_s
```

### Step 6: Test That It Works

```bash
# Still in ~/BitNet with venv activated
python run_inference.py -m models/bitnet-b1.58-2B-4T/ggml-model-i2_s.gguf \
  -p "Analyze this Nigerian property: 3 bedroom flat in Lekki Phase 1, ₦35 million. Is this a fair price?" \
  -n 128

# You should see the model respond in 10-20 seconds
# Output speed should be ~5-7 tokens/second on ARM
```

If you see a response, **BitNet is working!** 🎉

### Step 7: Create the REST API Wrapper

This wraps BitNet in an HTTP server so your backend can call it like any AI API.

Run on the VM:

```bash
# Install FastAPI + server
pip install fastapi uvicorn pydantic

# Create the API server file
mkdir -p ~/ai-server
cat > ~/ai-server/server.py << 'PYEOF'
"""
BitNet REST API Server
Exposes an OpenAI-compatible /v1/chat/completions endpoint
"""
import subprocess
import json
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="BitNet API Server")

# Path to the BitNet inference binary and model
BITNET_DIR = os.path.expanduser("~/BitNet")
MODEL_PATH = os.path.join(BITNET_DIR, "models/bitnet-b1.58-2B-4T/ggml-model-i2_s.gguf")
INFERENCE_SCRIPT = os.path.join(BITNET_DIR, "run_inference.py")

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str = "bitnet-b1.58"
    messages: List[Message]
    max_tokens: int = 512
    temperature: float = 0.7

class ChatResponse(BaseModel):
    id: str = "chatcmpl-bitnet"
    object: str = "chat.completion"
    choices: list

@app.get("/health")
async def health():
    return {"status": "ok", "model": "bitnet-b1.58-2B-4T"}

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatRequest):
    """OpenAI-compatible chat completions endpoint"""
    try:
        # Combine messages into a single prompt
        prompt = "\n".join([f"{m.role}: {m.content}" for m in request.messages])
        
        # Call BitNet inference
        result = subprocess.run(
            [
                os.path.join(BITNET_DIR, "venv/bin/python"),
                INFERENCE_SCRIPT,
                "-m", MODEL_PATH,
                "-p", prompt,
                "-n", str(request.max_tokens),
                "-t", str(request.temperature)
            ],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=BITNET_DIR
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Inference error: {result.stderr}")
        
        response_text = result.stdout.strip()
        
        return {
            "id": "chatcmpl-bitnet",
            "object": "chat.completion",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            "model": "bitnet-b1.58-2B-4T"
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Inference timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
PYEOF
```

### Step 8: Run the API Server

```bash
# Test run (foreground — to check for errors)
cd ~/ai-server
~/BitNet/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8080

# In a NEW terminal tab, test it:
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is Lekki Phase 1 like for property investment?"}]}'

# If this works, you should see a JSON response with the AI's answer
```

### Step 9: Make It Run Forever (systemd service)

```bash
# Create a systemd service so the API auto-starts on reboot
sudo tee /etc/systemd/system/bitnet-api.service << 'EOF'
[Unit]
Description=BitNet AI API Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ai-server
ExecStart=/home/ubuntu/BitNet/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=10
Environment=PATH=/home/ubuntu/BitNet/venv/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
EOF

# Enable and start it
sudo systemctl daemon-reload
sudo systemctl enable bitnet-api
sudo systemctl start bitnet-api

# Check it's running
sudo systemctl status bitnet-api
```

You should see **"active (running)"** — the API is now live and will auto-restart if it crashes or the VM reboots.

---

## PHASE 2.5: Install & Run Ollama (The Smart Brain)

> **Estimated Time:** 10–15 minutes  
> **Who:** 🟡 I'll write the commands, you run them on the VM

Ollama is dead simple to install — one command. It manages model downloads, serves an API, and just works.

### Step 9.5: Install Ollama

```bash
# Install Ollama (works on ARM natively)
curl -fsSL https://ollama.com/install.sh | sh

# Verify it's installed
ollama --version
```

### Step 9.6: Download a Smart Model

```bash
# Pull Llama 3 8B (recommended — best balance of size vs smarts)
# This downloads ~4.5GB. Takes 5-10 minutes depending on internet speed.
ollama pull llama3:8b

# Test it works
ollama run llama3:8b "Analyze this Nigerian property listing: 4 bedroom duplex in Magodo GRA, ₦80 million. Is this a good investment? Be brief."

# You should see a thoughtful, well-reasoned response
# Type /bye to exit
```

> **Alternative models** (if Llama 3 8B feels slow):
> - `mistral:7b` — slightly faster, still very good
> - `phi3:3.8b` — much smaller/faster, decent for simple reasoning
> - `llama3:8b` is recommended as the best all-rounder

### Step 9.7: Configure Ollama to Accept External Connections

By default Ollama only listens on localhost. To let your backend reach it:

```bash
# Edit the Ollama service to allow external access
sudo systemctl edit ollama.service

# Add these lines in the editor that opens:
[Service]
Environment="OLLAMA_HOST=0.0.0.0"

# Save and exit, then restart
sudo systemctl restart ollama

# Verify it's listening on all interfaces
curl http://localhost:11434/api/tags
# Should return JSON with your installed models
```

### Step 9.8: Test Ollama's API

```bash
# Test the chat API (OpenAI-compatible format)
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3:8b",
    "messages": [{"role": "user", "content": "What is the rental yield for a 3-bed flat in Lekki Phase 1 priced at 35 million naira?"}],
    "stream": false
  }'

# You should get a JSON response with a thoughtful answer
```

Ollama is now running alongside BitNet. **Two brains, one server, $0.** 🧠⚡

---

## PHASE 3: Install ZeroClaw Agent Runtime

> **Estimated Time:** 15–20 minutes  
> **Who:** 🟡 I'll write the commands, you run them on the VM

### Step 10: Install ZeroClaw

```bash
# Install ZeroClaw from its official installer
curl -fsSL https://zeroclaw.org/install.sh | sh

# Verify installation
zeroclaw --version
```

> **If the install script doesn't work** (ZeroClaw is new and may change), try building from source:
> ```bash
> # Install Rust first
> curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
> source $HOME/.cargo/env
> 
> # Clone and build
> git clone https://github.com/zeroclaw-labs/zeroclaw.git
> cd zeroclaw
> cargo build --release
> sudo cp target/release/zeroclaw /usr/local/bin/
> ```

### Step 11: Configure the ZeroClaw Agent

ZeroClaw uses **Ollama as its primary brain** (for complex multi-step reasoning) and can fall back to BitNet for quick tasks.

```bash
mkdir -p ~/zeroclaw-agent
cat > ~/zeroclaw-agent/agent.toml << 'EOF'
[llm]
provider = "ollama"
model = "llama3:8b"
base_url = "http://localhost:11434"
api_key = "not-needed"

[tools]
shell = true
file = true
memory = true

[memory]
backend = "sqlite"
path = "./agent_memory.db"

[server]
host = "0.0.0.0"
port = 9090
EOF
```

### Step 12: Start ZeroClaw

```bash
cd ~/zeroclaw-agent
zeroclaw agent start --config agent.toml

# Or make it a systemd service too:
sudo tee /etc/systemd/system/zeroclaw.service << 'EOF'
[Unit]
Description=ZeroClaw AI Agent
After=bitnet-api.service
Requires=bitnet-api.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/zeroclaw-agent
ExecStart=/usr/local/bin/zeroclaw agent start --config agent.toml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable zeroclaw
sudo systemctl start zeroclaw
```

---

## PHASE 4: Backend AI Service (Code Changes)

> **Estimated Time:** 30 minutes  
> **Who:** 🟢 I can do all of this for you

These are the code changes needed in your Node.js backend. **Tell me to proceed and I'll create all these files:**

### Step 13: Add Environment Variables

Add to your `.env`:

```env
# AI Intelligence Layer — Dual Model
BITNET_URL=http://YOUR_ORACLE_VM_IP:8080
OLLAMA_URL=http://YOUR_ORACLE_VM_IP:11434
OLLAMA_MODEL=llama3:8b
ZEROCLAW_URL=http://YOUR_ORACLE_VM_IP:9090
AI_ENABLED=true
```

### Step 14: Create `backend/src/services/ai.service.ts`

This service handles all AI calls with **smart dual-model routing**:
- ⚡ **Simple tasks** (query parsing, scoring, tagging) → BitNet (fast)
- 🧠 **Complex tasks** (reports, chat, fraud, analysis) → Ollama / Llama 3 (smart)
- 🟢 **Optional fallback** → Gemini Flash free tier (only if both local models are down)

### Step 15: Create AI API Routes

New routes to add to your backend:

```
POST /api/ai/query-parse        → Natural language → structured search filters
POST /api/ai/listing-analysis   → Property → quality score + fraud flags  
GET  /api/ai/market-report/:area → Weekly area market summary
POST /api/ai/chat               → General AI assistant
GET  /api/ai/health             → Check if AI services are running
```

### Step 16: Register Routes in the Backend

Wire up the new routes in your Express app.

---

## PHASE 5: Frontend AI Components (Code Changes)

> **Estimated Time:** 1–2 hours  
> **Who:** 🟢 I can do all of this for you

### Step 17: Floating AI Chat Button

A chat widget available on every page — click to open, type questions like:
- "How many properties were added this week?"
- "Show me all 3-bed flats in Lekki under ₦30M"
- "What's the average price in Ikeja?"

### Step 18: Insight Cards on Dashboard

Auto-generated market insight cards using Ollama-powered summaries.

### Step 19: AI Analyze Button on Property Pages

One-click analysis: "Is this a good investment?" with yield estimates and comparables.

### Step 20: Smart Search Enhancement

When a user types a natural language query, show what the AI interpreted:
> *"Interpreted as: 3 bedroom flat in Lekki, max price ₦30,000,000"*

---

## PHASE 6: Security (Oracle VM)

> **Who:** 🔵 You do this

### Step 21: Set Up Oracle Security List (Firewall)

1. In Oracle Cloud Console → **Networking → Virtual Cloud Networks**
2. Click your VCN → **Security Lists** → **Default Security List**
3. **Add Ingress Rule**:

   | Setting | Value |
   |---|---|
   | Source CIDR | `0.0.0.0/0` (or restrict to your Render server IP) |
   | Protocol | TCP |
   | Destination Port | `8080` |

4. Add another rule for port `11434` (Ollama)
5. Add another rule for port `9090` (ZeroClaw)

> 💡 **Best practice:** Instead of `0.0.0.0/0`, restrict to your Render backend's IP address for production.

### Step 22: (Optional) Set Up a Reverse Proxy with HTTPS

For production, put Nginx + Let's Encrypt in front:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Configure Nginx
sudo tee /etc/nginx/sites-available/ai-api << 'EOF'
server {
    listen 80;
    server_name ai.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/ai-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d ai.yourdomain.com
```

---

## Summary: Who Does What?

| Step | Phase | Who |
|---|---|---|
| 1–4 | Oracle Cloud account + VM creation | 🔵 **You** |
| 5–9 | Install & test BitNet on VM + API wrapper | 🟡 **You run commands I provide** |
| 9.5–9.8 | Install & test Ollama (smart brain) | 🟡 **You run commands I provide** |
| 10–12 | Install & configure ZeroClaw | 🟡 **You run commands I provide** |
| 13–16 | Backend AI service + routes | 🟢 **I do this** — just say the word |
| 17–20 | Frontend AI components | 🟢 **I do this** — just say the word |
| 21–22 | Oracle networking + security | 🔵 **You** |

---

## What to Do Right Now

1. **Start with Phase 1** — create your Oracle Cloud account and VM
2. Once you have the VM running and can SSH in, come back and tell me
3. I'll then walk you through Phases 2–2.5–3 (installing BitNet + Ollama + ZeroClaw)
4. While you do that, I can start on **Phases 4–5** (backend + frontend code) — just give the go-ahead

---

## Troubleshooting Common Issues

### "Cannot create ARM instance" on Oracle
Oracle Free Tier ARM instances are in very high demand. If you get an "Out of capacity" error:
- Try a **different Availability Domain** (AD-1, AD-2, AD-3)
- Try at **off-peak hours** (early morning/late night)
- Use the [OCI Instance Creation Script](https://github.com/hitrov/oci-arm-host-capacity) to auto-retry

### BitNet build fails
- Make sure you have `cmake`, `build-essential`, and `python3-dev` installed
- Run: `sudo apt install -y cmake build-essential python3-dev`

### Ollama install fails
- If the install script doesn't work on ARM, download the binary directly from [ollama.com/download](https://ollama.com/download)
- Check if the service is running: `sudo systemctl status ollama`
- Restart it: `sudo systemctl restart ollama`

### Ollama model download is slow
- The Llama 3 8B Q4 model is ~4.5GB — over a slow connection, try `phi3:3.8b` instead (~2.3GB)
- You can always pull a bigger model later: `ollama pull llama3:8b`

### Can't connect to API from outside
- Check Oracle Security List (Step 21) — ports 8080, 11434 must be open
- Check Ubuntu firewall: `sudo ufw status` — both ports must be allowed
- Test locally first: `curl http://localhost:8080/health` and `curl http://localhost:11434/api/tags` on the VM

### BitNet runs slow
- Verify you're using the `i2_s` quantization (fastest on ARM)
- Check RAM usage: `free -h` — should have plenty of free RAM
- Ensure no other heavy processes: `htop`

### Ollama runs slow
- On ARM, expect 2–4 tokens/second for 8B models — this is normal
- If too slow, switch to a smaller model: `ollama pull phi3:3.8b`
- Make sure BitNet isn't running inference at the same time (they share CPU)

### Memory issues (unlikely with 24GB)
- Check with `free -h` — BitNet (~400MB) + Ollama (~5GB) = ~5.5GB total
- You have 18GB+ headroom, but if something else is eating RAM, check `htop`
