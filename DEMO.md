# 🎬 FlockChain AI — Demo Script for Judges

**Total demo time: Under 3 minutes**

---

## Act 1 — Introduction (30 seconds)

1. Open the **landing page**
2. Say: *"FlockChain AI monitors poultry farm health in real time using IoT sensors, predicts outbreak risk with local ML and ICAR-CARI fallback rules, calculates sustainability scores, and rewards sustainable farmers with Stellar-backed ECO_KUKK credits."*
3. Point out the 3 feature cards: AI Prediction, IoT Monitoring, Blockchain Rewards

---

## Act 2 — Live Sensor Dashboard (30 seconds)

4. Click **"Farmer Dashboard"**
5. Point out the **MQTT status** (Demo Mode or Live)
6. Show the **5 live sensor readings** updating in real-time:
   - NH₃, CO₂, Temperature, Humidity, Water TDS
7. Show color-coded bars changing from green → yellow → red as scenarios cycle

---

## Act 3 — AI Disease Prediction (45 seconds)

8. Click **"Refresh AI Analysis"** button
9. Watch the prediction engine return a **real JSON response** with:
   - Risk Score (0-100) with gauge animation
   - Risk Category badge (Low/Medium/High/Critical)
   - Disease predictions for 12h/24h/48h
10. Scroll to **AI Recommendations** — show priority-coded action items
11. Say: *"This is the live prediction route analyzing sensor data and weather together. It uses the Python ML server when available and falls back to the local ICAR-CARI/DADF rule engine instantly."*

---

## Act 4 — Weather Correlation (15 seconds)

12. Show the **Weather Panel** with indoor vs outdoor comparison
13. Point out the AI weather impact statement
14. Say: *"The AI correlates external weather with internal conditions to predict disease vectors."*

---

## Act 5 — PFSI Sustainability Score (15 seconds)

15. Show the **PFSI gauge** with the current score
16. Point out the **breakdown bars** (air quality, water, temp, humidity, weather adaptation)
17. If PFSI ≥ 70: *"This farm qualifies for carbon credit rewards"*

---

## Act 6 — Stellar Blockchain (30 seconds)

18. Click **"Connect Freighter Wallet"** (or show demo wallet)
19. Click **"Record Sensor Hash on Stellar"**
20. Show the **transaction hash** appearing with Stellar Explorer link
21. Click the link → opens Stellar Expert showing the real testnet transaction
22. Show the **Reward Eligible** badge if PFSI ≥ 70
23. Say: *"Every sensor reading is hashed and recorded on Stellar — immutable proof of farm health data."*

---

## Act 7 — Admin Portal (30 seconds)

24. Navigate to **Admin Portal**
25. Show:
    - Multi-farm risk comparison bar chart
    - PFSI distribution pie chart
    - Stellar audit trail table with verification status
26. Select a farm → Click **"Generate Certificate"**
27. Show the generated health & sustainability certificate with Stellar verification link

---

## Closing (15 seconds)

28. Say: *"FlockChain AI creates a complete loop — from sensors to AI prediction to sustainability scoring to blockchain rewards — all deployed on Vercel with zero infrastructure."*

---

## Key Talking Points for Q&A

- **Prediction is real** — the app analyzes actual sensor data through ML or deterministic poultry-health rules, not hardcoded responses
- **Demo mode** — Works even without hardware; cycles through realistic scenarios
- **Scalable** — Vercel serverless handles any load; Upstash Redis for data
- **Farmer-first** — Zero-friction wallet, automatic rewards for good practices
- **Verifiable** — Every data point is hashed on Stellar's public blockchain
