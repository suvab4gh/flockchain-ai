# FlockChain AI

AI-powered poultry health monitoring, farm-specific decision support, and verifiable supply-chain compliance for Indian poultry farms. 

FlockChain AI helps small and mid-sized poultry farms detect disease risks early, improve environmental conditions, and generate trusted compliance records using IoT telemetry, machine learning, and the Stellar blockchain ecosystem.

The blockchain layer is not the core product — it acts as a trust infrastructure that makes farm data verifiable for buyers, insurers, banks, and inspectors.

---

## Overview

India is one of the world's largest poultry producers, yet many farms still operate without continuous environmental monitoring or verifiable compliance systems.

FlockChain AI addresses this through:

* Real-time telemetry collection
* AI-based disease risk prediction
* Reinforcement-learning-powered recommendations
* Sustainability scoring (PFSI)
* Blockchain-backed certificate verification
* Farmer and admin dashboards
* Offline-safe fallback systems for demos and low-connectivity environments

---

# Key Problems Solved

| Problem                            | Current Situation                                                                                                           | FlockChain AI Solution                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Disease outbreaks                  | Diseases like Newcastle Disease, avian influenza, respiratory stress, and heat stress spread before visible symptoms appear | Sensor monitoring + ML predictions provide early warnings 24–48 hours earlier |
| No trusted compliance proof        | Farmers struggle to prove biosecurity standards to buyers and inspectors                                                    | Sensor data and certificates are hashed and anchored on Stellar               |
| Weak incentives for sustainability | Better ventilation and hygiene increase costs without visible rewards                                                       | Farms with strong PFSI scores become reward eligible                          |
| Generic farming advice             | Farmers receive non-specific recommendations                                                                                | PPO RL models generate shed-specific operational guidance                     |

---

# Core Features

## Smart Telemetry Monitoring

Tracks poultry shed conditions using MQTT-connected sensors or demo simulations:

* Temperature
* Humidity
* Ammonia (NH3)
* Carbon dioxide (CO2)
* Water TDS

---

## AI Disease Prediction

Supports two prediction paths:

### Primary ML Pipeline

* XGBoost
* LSTM
* PPO Reinforcement Learning

### Fallback Prediction Engine

If the ML server is unavailable, the system automatically switches to a rule-based engine built using:

* ICAR-CARI standards
* DADF guidelines
* BIS 10500 references

---

## Poultry Farm Sustainability Index (PFSI)

Calculates sustainability and operational quality using environmental metrics.

### Formula

PFSI = airQuality \times 0.30 + waterQuality \times 0.20 + temperature \times 0.15 + humidity \times 0.15 + weatherAdaptation \times 0.20

### Score Categories

| Score  | Label     | Meaning                   |
| ------ | --------- | ------------------------- |
| 86–100 | Excellent | Reward eligible           |
| 66–85  | Good      | Reward eligible           |
| 41–65  | Moderate  | Needs improvement         |
| 0–40   | Poor      | Immediate action required |

Weights are loaded from:

```text
data/pfsi_config.json
```

---

## Blockchain Verification

Uses Stellar Testnet for:

* Sensor data anchoring
* Compliance certificates
* Trustline creation
* Reward issuance
* Supply-chain verification

### Fallback Strategy

If Soroban contracts are unavailable:

* Falls back to Stellar Classic Horizon `manageData`
* Demo-safe mock references keep UI functional

---

## Dashboard System

### Farmer Dashboard (`/farmer`)

Includes:

* Live telemetry
* Disease prediction
* Weather integration
* PFSI score
* Recommendations
* Blockchain verification

### Admin Dashboard (`/admin`)

Provides:

* Farm analytics
* Aggregate monitoring
* Certificate management
* Verification workflows

---

# System Architecture

```text
IoT Sensors / Demo Simulation
            │
            ▼
 MQTT over WebSocket
            │
            ▼
 Next.js Farmer Dashboard
            │
            ▼
   Upstash Redis Cache
            │
            ▼
 Python ML Service
(XGBoost + LSTM + PPO RL)
            │
            ▼
Fallback Rule Engine
(ICAR-CARI / DADF / BIS)
            │
            ▼
  PFSI + Recommendations
            │
            ▼
 Stellar Testnet
(Soroban or Classic Horizon)
```

---

# Tech Stack

| Layer      | Technology                            |
| ---------- | ------------------------------------- |
| Frontend   | Next.js App Router, React, TypeScript |
| Styling    | Tailwind CSS, Recharts, lucide-react  |
| Telemetry  | MQTT over WebSocket                   |
| Data Cache | Upstash Redis                         |
| Weather    | OpenWeatherMap                        |
| ML Service | FastAPI, XGBoost, LSTM, PPO RL        |
| Blockchain | Stellar SDK, Soroban, Horizon         |
| Wallet     | Freighter Wallet                      |
| Deployment | Vercel                                |

---

# Project Structure

```text
/
├── app/
├── api/
├── contracts/
├── data/
├── ml/
├── public/
├── components/
├── styles/
└── README.md
```

---

# API Routes

| Method   | Endpoint                   | Purpose               |
| -------- | -------------------------- | --------------------- |
| POST     | `/api/sensor`              | Store telemetry       |
| GET      | `/api/weather`             | Fetch weather         |
| POST     | `/api/predict`             | Disease prediction    |
| POST/GET | `/api/rl/recommend`        | RL recommendations    |
| POST/GET | `/api/pfsi`                | PFSI calculation      |
| GET      | `/api/dashboard/farmer`    | Farmer dashboard data |
| GET      | `/api/dashboard/admin`     | Admin analytics       |
| GET      | `/api/mpp/status`          | MPP status            |
| GET      | `/api/stellar/balance`     | Wallet balance        |
| POST     | `/api/stellar/hash`        | Anchor sensor hash    |
| POST     | `/api/stellar/trustline`   | Create trustline      |
| POST     | `/api/stellar/reward`      | Send ECO_KUKK reward  |
| GET/POST | `/api/stellar/certificate` | Manage certificates   |
| GET      | `/api/stellar/verify`      | Public verification   |

---

# Quick Start

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Configure Environment

```bash
cp .env.example .env.local
```

---

## 3. Start Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Environment Variables

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

OPENWEATHER_API_KEY=
FARM_LOCATION=Kolkata,IN

NEXT_PUBLIC_HIVEMQ_HOST=
NEXT_PUBLIC_HIVEMQ_PORT=8884
NEXT_PUBLIC_HIVEMQ_USERNAME=
NEXT_PUBLIC_HIVEMQ_PASSWORD=

STELLAR_SECRET_KEY=
NEXT_PUBLIC_STELLAR_NETWORK=testnet
SOROBAN_CONTRACT_ID=

MPP_ENABLED=false
MPP_AMOUNT=0.01

ML_SERVER_URL=http://127.0.0.1:8000/predict
```

---

# Running the ML Service

The app works without the Python ML server because fallback rules are built in.

To enable the full ML pipeline:

---

## Option A — Local Development

```bash
cd ml

pip install -r requirements.txt

python train_indian_dataset_pipeline.py

python app.py
```

Set:

```env
ML_SERVER_URL=http://127.0.0.1:8000/predict
```

---

## Option B — Google Colab + ngrok

Useful for hackathons and demos.

### Steps

1. Upload model files to Google Drive
2. Get an ngrok auth token
3. Run `ml/colab_server.py`
4. Copy generated URL into Vercel environment variables

Example:

```env
ML_SERVER_URL=https://abcd-1234.ngrok-free.app/predict
```

---

## Option C — Production Deployment

Deploy the ML server separately on:

* Render
* Railway

Start command:

```bash
uvicorn app:app --host 0.0.0.0 --port $PORT
```

---

# Stellar + Soroban Setup

Deploy contracts:

```bash
cd contracts

bash deploy.sh
```

Add contract ID:

```env
SOROBAN_CONTRACT_ID=C...
```

If unavailable, the app automatically falls back to Classic Horizon.

---

# Demo Workflow

1. Open `/`
2. Navigate to `/farmer`
3. Watch live telemetry updates
4. Run predictions
5. Review PFSI score and recommendations
6. Connect Freighter wallet
7. Anchor sensor data
8. Open `/admin`
9. Generate and verify certificates

---

# Known Limitations

| Limitation                  | Current Behavior      | Suggested Fix          |
| --------------------------- | --------------------- | ---------------------- |
| Soroban contract missing    | Uses Horizon fallback | Deploy contracts       |
| ML models local-only        | Uses fallback rules   | Host ML service        |
| ML server offline           | Uses rule engine      | Run FastAPI server     |
| Testnet credentials missing | Rewards disabled      | Configure Stellar keys |

---

# Verification

## Type Check

```bash
npm run lint
```

---

## Build Issues

If `.next` artifacts are locked:

```bash
rm -rf .next
```

Then rerun:

```bash
npm run build
```

---

# Deployment

Recommended stack:

* Frontend → Vercel
* ML Service → Render/Railway
* Blockchain → Stellar Testnet
* Redis → Upstash

---

# Future Improvements

* Edge AI prediction on-device
* Mobile farmer app
* Real hardware sensor integration
* Multi-farm analytics
* Automated disease reporting
* Carbon-credit tracking
* Supply-chain marketplace integration

---

# License

MIT License.

Built for hackathon demonstrations, smart agriculture research, and poultry farm monitoring experiments.
