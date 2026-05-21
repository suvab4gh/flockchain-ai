# PoultryLedger — Soroban Smart Contract

FlockChain AI's on-chain verification engine. A Rust/Soroban smart contract deployed to Stellar Testnet that replaces raw `manageData` operations with structured, queryable, logic-enforced on-chain state.

## What It Does

| Function | Description |
|---|---|
| `record_sensor_hash(caller, farm_id, hash)` | Anchor a SHA-256 sensor telemetry batch immutably on-chain |
| `issue_certificate(issuer, farm_id, pfsi_x10, cert_hash, cert_id)` | Mint a PFSI-gated supply chain cert — score ≥ 50.0 required |
| `record_reward_claim(caller, farm_id, farmer_addr, pfsi_x10)` | Register an ECO_KUKK reward claim — double-claim prevented on-chain |
| `verify_cert(cert_id)` | **Public read** — trustless cert verification, no auth needed |
| `get_farm_stats(farm_id)` | **Public read** — full farm stats from on-chain state |
| `get_sensor_hashes(farm_id, last_n)` | **Public read** — retrieve last N recorded sensor hashes |
| `is_reward_claimed(farm_id)` | **Public read** — check if reward was already claimed this period |

## Setup (One-Time)

```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# 2. Install Stellar CLI
cargo install --locked stellar-cli --features opt

# 3. Add Testnet network
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# 4. Generate and fund a deployer keypair
stellar keys generate deployer --network testnet --fund
```

## Deploy

```bash
cd contracts
bash deploy.sh
```

Copy the output `CONTRACT_ID` and add to `.env.local`:

```env
SOROBAN_CONTRACT_ID=CXXXX...
```

Restart the dev server — the app automatically switches from Classic Horizon to Soroban.

## Test

```bash
# Check your Rust install
cargo test

# Verify a certificate (no auth — public read)
stellar contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  --source deployer \
  -- verify_cert \
  --cert_id CERT-FARM-001-20250521

# View contract events in Stellar Expert
open "https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID/events"
```

## Why Soroban vs Classic manageData

| Feature | Classic Horizon `manageData` | Soroban `PoultryLedger` |
|---|---|---|
| On-chain state | Raw 64-byte value only | Typed structs, maps, vecs |
| Business logic | None — bypass possible | PFSI ≥ 50 enforced on-chain |
| Double-claim prevention | Not possible | Native via persistent storage |
| Public verifiability | Must know issuer key | `verify_cert()` by cert ID |
| Contract events | None | Indexed, searchable via RPC |
| DeFi composability | No | Yes (via SAC integration) |

## Architecture Integration

```
SOROBAN_CONTRACT_ID set?
├── YES → lib/stellar.ts: sorobanRecordSensorHash() / sorobanIssueCertificate()
│          → Soroban RPC → PoultryLedger contract → on-chain state
└── NO  → Classic Horizon manageData fallback (always works, zero config)
```

The fallback means **the app works out of the box** without any Rust setup — Soroban is purely additive.
