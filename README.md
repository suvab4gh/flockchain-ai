# 🐓 FlockChain AI

**Edge-AI & Blockchain-powered Predictive Biosecurity for Poultry Farms.**

FlockChain AI transforms poultry biosecurity from reactive to predictive. It uses a **3-Tier AI Engine** to analyze real-time IoT shed telemetry and detect disease outbreaks (like Avian Flu and Newcastle) 3–7 days before visible symptoms appear. When critical risks are detected, the system autonomously triggers **Stellar smart contracts** to dispatch veterinarians and mints immutable health records for transparent insurance payouts.

---

## 🚀 The Problem & Solution

**The Problem:** Current biosecurity is reactive. By the time a farmer sees a sick bird, the entire flock is compromised. This leads to devastating economic losses, rapid disease spread to neighboring farms, and massive friction in insurance claims due to a lack of verifiable proof.

**The Solution:**
1. **Predictive Analytics:** Edge AI and NVIDIA LLMs detect anomalies in NH3, CO2, temperature, and humidity *before* birds get sick.
2. **Autonomous Response:** Stellar Soroban smart contracts automatically pay and dispatch veterinarians the second risk crosses the 70% threshold.
3. **Immutable Trust:** Sensor data is hashed to the Stellar testnet, creating a tamper-proof audit trail for rapid insurance payouts and the minting of "Disease-Free" Health Certificates.

---

## 🧠 3-Tier AI Architecture

Our resilient, offline-capable AI cascade ensures the farm is always monitored, regardless of connectivity:

* **Tier 1 (Edge ML):** Local Python server running **XGBoost** for anomaly detection, **LSTM** for time-series forecasting, and **PPO Reinforcement Learning** for autonomous climate control recommendations.
* **Tier 2 (NVIDIA NIM):** Uses the **MiniMax M2.7 LLM** via the NVIDIA API to analyze environmental data against ICAR-CARI clinical standards, outputting structured disease risks and actionable interventions.
* **Tier 3 (Serverless Fallback):** A hardcoded, lightning-fast Next.js rule-based engine built strictly on Indian Government (DADF/BIS) standards.

---

## ⛓️ Blockchain Layer (Stellar)

The blockchain layer acts as the trust infrastructure. We use the **Stellar Testnet** for:
* **Telemetry Anchoring:** Hashing live sensor data batches to the ledger to prevent data tampering.
* **Soroban Smart Contracts:** Autonomous event triggers (e.g., vet dispatch via XLM micropayments).
* **ECO_KUKK Rewards:** Farmers who maintain a high PFSI (Poultry Farm Sustainability Index) > 70 are minted custom reward tokens.
* **Health Certificates:** Verifiable, on-chain assets proving a flock is disease-free for supply chain buyers.

*(Note: We use Freighter API v2.0 for wallet connections, supporting both real testnet accounts and a built-in Demo Mode).*

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | Next.js (App Router), React, Tailwind CSS |
| **Blockchain** | Stellar SDK, Soroban, Freighter API v2.0, Horizon |
| **AI (Cloud)** | NVIDIA NIM API (MiniMax M2.7 LLM) |
| **AI (Edge)** | Python, FastAPI, XGBoost, PyTorch (LSTM + PPO) |
| **Real-time Data**| MQTT over WebSocket (HiveMQ) |
| **Deployment** | Vercel (Web), Local/Google Colab (ML) |

---

## 🖥️ System Dashboards

* **Farmer Portal (`/farmer`):**
  * Live MQTT Telemetry Gauges
  * 3-Tier AI Disease Predictor & Recommendations
  * PFSI Score & Reward Claims
  * Stellar Auto-Response Logs
* **Admin Command Center (`/admin`):**
  * District-wide Analytics & KPI Rollups
  * Farm Registry & Health Monitoring
  * Ledger Audit Trail & Certificate Generator

---

## ⚙️ Quick Start (Local Development)

### 1. Install Dependencies
The project requires `npm install --legacy-peer-deps` due to the `qrcode` package.
```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env.local
```
Add your **NVIDIA_API_KEY** (from NVIDIA NIM) if you want to use the Tier-2 LLM. Add your **STELLAR_SECRET_KEY** for automated backend transactions.

### 3. Start the Web App
```bash
npm run dev
```
Open `http://localhost:3000`.

### 4. Start the Edge ML Server (Optional)
If you want to use Tier-1 (XGBoost + LSTM), open a second terminal:
```bash
cd ml
python -m venv .venv
.venv\Scripts\activate  # Or source .venv/bin/activate on Mac/Linux
pip install -r requirements.txt
python app.py
```

---

## 🌐 Deployment (Vercel)

The app is fully optimized for Vercel deployment. 
1. Push your code to GitHub.
2. Import the project in Vercel.
3. Under Build Command, ensure it runs `npm run build`.
4. Add all environment variables from `.env.local` to Vercel.
5. **Important:** Vercel cannot reach your local `127.0.0.1` Python ML server. On Vercel, the app will automatically route AI predictions to Tier 2 (NVIDIA) or Tier 3 (ICAR Rules).

*(Note: We have pre-configured `vercel.json` to extend the serverless function timeout to 30s to accommodate complex LLM and Stellar Horizon API calls).*

---

## 🔗 APIs & Endpoints

| Route | Purpose |
| :--- | :--- |
| `POST /api/predict` | Executes the 3-Tier AI cascade based on sensor data. |
| `POST /api/alert` | Autonomously evaluates risk and triggers Stellar vet dispatch. |
| `POST /api/stellar/hash` | Anchors a SHA-256 hash of sensor telemetry to the ledger. |
| `POST /api/stellar/reward` | Mints ECO_KUKK carbon/sustainability tokens. |
| `POST /api/stellar/certificate` | Issues verifiable Health Certificates. |
| `GET /api/weather` | Pulls OpenWeatherMap data for climate context. |

---

## 🏆 Hackathon Context

This project was built to demonstrate how **AI and Web3 can solve physical-world supply chain and biosecurity crises.** 
By combining the predictive reasoning of LLMs/Machine Learning with the trustless, immutable execution of the Stellar network, FlockChain AI proves that the future of farming is proactive, automated, and verifiable.
