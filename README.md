# FlockChain AI

Smart poultry health monitoring, farm-specific decision support, and verifiable supply-chain compliance for Indian poultry farms.

FlockChain AI gives small and mid-sized poultry farmers the kind of disease early warning, telemetry-driven management, and compliance proof that is usually available only to large integrators. The blockchain layer is not the main feature; it is the trust infrastructure that makes farm data useful to buyers, banks, insurers, and inspectors.

## The Real Problem

India is one of the world's largest poultry producers, but many farms still operate without real-time environmental monitoring. That creates four practical problems:

| Problem | What Happens Today | FlockChain AI Response |
|---|---|---|
| Disease outbreaks | Ranikhet/Newcastle Disease, avian influenza, respiratory stress, and heat stress can spread before symptoms are obvious | Sensors track NH3, CO2, temperature, humidity, and water TDS; ML and ICAR-CARI/DADF rules warn 24-48 hours earlier |
| No trusted compliance proof | Farmers cannot prove biosecurity or disease-free operation to buyers and inspectors | Sensor batches and certificates are hashed and anchored on Stellar |
| No incentive for better biosecurity | Ventilation, water quality, and litter management cost money without immediate reward | PFSI score >= 70 can trigger ECO_KUKK sustainability rewards |
| Generic advice | Farmers receive broad guidance like "increase ventilation" without shed-specific commands | PPO RL and heuristic fallbacks produce actionable operating recommendations |

## What It Does

- Collects poultry shed telemetry through MQTT or demo sensor simulation.
- Stores recent telemetry in Upstash Redis when configured.
- Fetches outdoor weather from OpenWeatherMap, with a safe fallback.
- Predicts disease and environmental risk using a local Python ML service when available.
- Falls back to an in-process ICAR-CARI / DADF / BIS 10500 rule engine when ML is unavailable.
- Calculates PFSI, the Poultry Farm Sustainability Index.
- Anchors sensor hashes and certificates on Stellar using Soroban when configured.
- Falls back to Classic Horizon `manageData` when no Soroban contract is deployed.
- Supports Freighter wallet, ECO_KUKK trustlines, rewards, and explicit testnet fallback flows.
- Exposes admin and farmer dashboards plus public certificate verification APIs.

## Architecture

```text
IoT sensors / demo scenarios
          |
          v
MQTT over WebSocket -> Next.js farmer dashboard
          |
          v
Upstash Redis telemetry history
          |
          v
Python ML server: XGBoost + LSTM + PPO RL
          |
          | fallback
          v
Local ICAR-CARI / DADF / BIS 10500 rule engine
          |
          v
PFSI score + farm-specific recommendations
          |
          v
Stellar Testnet: Soroban contract or Classic manageData fallback
```

## Tech Stack

| Layer | Technology |
|---|---|
| Web app | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS, Recharts, lucide-react |
| Telemetry | MQTT over WebSocket, HiveMQ-compatible connection, demo sensor rotation |
| Data cache | Upstash Redis REST |
| Weather | OpenWeatherMap |
| Prediction | Local FastAPI ML service with XGBoost, LSTM, PPO RL |
| Fallback prediction | Local ICAR-CARI / DADF / BIS 10500 rule engine |
| Blockchain | Stellar SDK, Freighter Wallet, Classic Horizon, Soroban RPC |
| Payments | ECO_KUKK token reward flow, optional MPP gate for `/api/predict` |
| Deployment | Vercel |

## Current Pages

| Page | Route | Status |
|---|---|---|
| Landing page | `/` | Complete: current ML, Soroban, MPP, and farm-trust positioning |
| Farmer dashboard | `/farmer` | Complete: sensors, prediction, weather, PFSI, recommendations, trends, Stellar flow |
| Admin dashboard | `/admin` | Complete: consumes `/api/dashboard/admin` with fallback data if the API is unavailable |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/sensor` | Store telemetry history in Redis |
| `GET` | `/api/weather` | Fetch outdoor weather |
| `POST` | `/api/predict` | ML prediction with rule-based fallback and optional MPP gate |
| `POST`, `GET` | `/api/rl/recommend` | PPO recommendation with heuristic fallback |
| `POST`, `GET` | `/api/pfsi` | Calculate PFSI score |
| `GET` | `/api/dashboard/farmer` | Farmer dashboard aggregate data |
| `GET` | `/api/dashboard/admin` | Admin analytics data |
| `GET` | `/api/mpp/status` | MPP configuration and paid endpoint map |
| `GET` | `/api/stellar/balance` | ECO_KUKK balance and trustline status |
| `POST` | `/api/stellar/hash` | Anchor sensor hash on Soroban or Classic Horizon |
| `POST` | `/api/stellar/trustline` | Create and submit trustline XDR |
| `POST` | `/api/stellar/reward` | Send ECO_KUKK reward when eligible |
| `GET`, `POST` | `/api/stellar/certificate` | Preview or issue farm certificate |
| `GET` | `/api/stellar/verify` | Public certificate verifier |

## PFSI Formula

PFSI is calculated from air quality, water quality, temperature control, humidity control, and weather adaptation.

```text
PFSI = airQuality * 0.30
     + waterQuality * 0.20
     + temperature * 0.15
     + humidity * 0.15
     + weatherAdaptation * 0.20
```

Weights are loaded from [data/pfsi_config.json](data/pfsi_config.json).

| Score | Label | Meaning |
|---|---|---|
| 86-100 | Excellent | Reward eligible |
| 66-85 | Good | Reward eligible |
| 41-65 | Moderate | Needs improvement |
| 0-40 | Poor | Action required |

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The app works without paid services by using demo sensors, fallback weather, local rule prediction, and Stellar fallback behavior.

## Environment Variables

Copy [.env.example](.env.example) to `.env.local` and fill only the services you want to enable.

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

No Anthropic or Claude API key is required. Earlier docs referenced Claude, but the current implementation uses the local Python ML service and the rule-based fallback.

## Running the ML Service

The Next.js app works without the Python ML server — `/api/predict` falls back to the ICAR-CARI/DADF/BIS rule engine. To activate the full XGBoost + LSTM + PPO RL path, run the ML server using one of the options below.

### Option A — Local (development)

```bash
cd ml
pip install -r requirements.txt
python train_indian_dataset_pipeline.py   # train models (first time only, ~5 min)
python app.py                             # starts FastAPI on http://127.0.0.1:8000
```

Set in `.env.local`:
```env
ML_SERVER_URL=http://127.0.0.1:8000/predict
```

### Option B — Google Colab + ngrok (demo / hackathon)

Use this to run the GPU-accelerated model in Colab and expose it to your Vercel deployment.

**Step 1**: Upload `ml/models/` to Google Drive at:
```
MyDrive/flockchain_ai/models/
```

**Step 2**: Get a free ngrok auth token from [dashboard.ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken)

**Step 3**: Open `ml/colab_server.py` and paste each `CELL_N` block into a new Colab cell.

- **Cell 1** — Install deps (fastapi, torch, xgboost, stable-baselines3, pyngrok)
- **Cell 2** — Mount Google Drive
- **Cell 3** — Copy model files from Drive to Colab runtime
- **Cell 4** — Model sanity check (loads all 4 models, confirms they work)
- **Cell 5** — Start FastAPI server + ngrok tunnel

When Cell 5 runs, you will see:
```
╔══════════════════════════════════════════════════╗
║  🚀  FlockChain AI ML Server is LIVE            ║
║  Public URL:  https://abcd-1234.ngrok-free.app  ║
║  ML_SERVER_URL = https://abcd-1234.ngrok-free.app/predict ║
╚══════════════════════════════════════════════════╝
```

**Step 4**: Copy that URL into Vercel:
```
Vercel → Project → Settings → Environment Variables
ML_SERVER_URL = https://abcd-1234.ngrok-free.app/predict
```

Redeploy. Your live Vercel app will now use the Colab-hosted XGBoost + LSTM + PPO models.

> **Note**: Colab sessions disconnect after ~12 hours of inactivity. The ngrok URL changes each restart. For persistent demo uptime, use Option C.

### Option C — Production (Render / Railway)

Deploy `ml/app.py` as a persistent web service:

1. Push your repo to GitHub
2. Create a new Web Service on [Render](https://render.com) or [Railway](https://railway.app)
3. Set root directory to `ml/`
4. Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Set env var: `MODELS_DIR=/opt/render/project/src/models`
6. Copy the service URL to Vercel as `ML_SERVER_URL`


## Stellar and Soroban

Out of the box, the app can anchor hashes using Classic Horizon `manageData`. To enable Soroban contract state and on-chain business logic:

```bash
cd contracts
bash deploy.sh
```

Then copy the deployed contract ID into `.env.local`:

```env
SOROBAN_CONTRACT_ID=C...
```

When `SOROBAN_CONTRACT_ID` is missing or Soroban fails, the app falls back to Classic Horizon. If Stellar itself is unreachable during a demo, selected routes can still return clearly marked mock references so the UI remains usable.

## Demo Flow

1. Open `/`.
2. Go to `/farmer`.
3. Watch MQTT or simulated telemetry update every 10 seconds.
4. Click refresh on the risk panel to run ML or fallback prediction.
5. Review PFSI, weather impact, and recommendations.
6. Connect Freighter on Stellar Testnet.
7. Anchor sensor data and inspect the returned Stellar link.
8. Open `/admin`.
9. Generate a certificate and verify it with `/api/stellar/verify?certId=...`.

## Known Gaps

| Gap | Impact | Next Fix |
|---|---|---|
| Soroban contract may not be deployed | Hash and certificate routes use Classic Horizon fallback | Install Rust/Stellar CLI and run `contracts/deploy.sh` |
| ML model binaries are local-only | Vercel deploys should use the rule fallback or an external ML service URL | Host the FastAPI ML service separately and set `ML_SERVER_URL` |
| Python ML server may not be running | Next.js prediction route uses ICAR-CARI/DADF fallback | Run `cd ml && python app.py` after installing `ml/requirements.txt` |
| Full blockchain deployment requires testnet credentials | Rewards/trustlines need a funded issuer and Freighter wallet | Set `STELLAR_SECRET_KEY` and use Freighter Testnet |

## Verification Notes

Known local checks:

```bash
npm run lint
```

The lint script currently runs TypeScript's no-emit check. `next lint` is not used because it is no longer valid for the installed Next.js version in this workspace.

`npm run build` may fail if stale `.next` artifacts are locked by a running dev server or by the local filesystem. Stop the dev server and remove `.next` if needed, then rerun the build.

## License

MIT. Built for hackathon demonstration and field-oriented poultry farm monitoring experiments.
#   f l o c k c h a i n - a i  
 