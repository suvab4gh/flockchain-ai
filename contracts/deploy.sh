#!/usr/bin/env bash
# FlockChain AI — Soroban Contract Deploy Script
# Requires: Rust + cargo + stellar-cli
#
# Quick setup (run once):
#   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
#   rustup target add wasm32-unknown-unknown
#   cargo install --locked stellar-cli --features opt
#   stellar network add testnet --rpc-url https://soroban-testnet.stellar.org --network-passphrase "Test SDF Network ; September 2015"
#   stellar keys generate deployer --network testnet --fund

set -e

NETWORK="testnet"
CONTRACT_DIR="$(dirname "$0")"
WASM_PATH="$CONTRACT_DIR/target/wasm32-unknown-unknown/release/poultry_ledger.wasm"

echo "🦀 Building PoultryLedger contract..."
cd "$CONTRACT_DIR"
cargo build --target wasm32-unknown-unknown --release --manifest-path Cargo.toml

echo "⚡ Optimizing WASM..."
stellar contract optimize --wasm "$WASM_PATH" || echo "stellar-cli optimize not found, skipping"

echo "🚀 Deploying to Stellar Testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --network "$NETWORK" \
  --source deployer \
  2>&1 | tail -1)

echo "✅ Contract deployed: $CONTRACT_ID"

echo "🔧 Initializing contract..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network "$NETWORK" \
  --source deployer \
  -- initialize \
  --admin "$(stellar keys address deployer)"

echo ""
echo "📋 Next steps:"
echo "  1. Add to .env.local:"
echo "     SOROBAN_CONTRACT_ID=$CONTRACT_ID"
echo ""
echo "  2. Verify on Stellar Explorer:"
echo "     https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo ""
echo "  3. Run a test invocation:"
echo "     stellar contract invoke --id $CONTRACT_ID --network testnet --source deployer -- get_farm_stats --farm_id FARM001"
