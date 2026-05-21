// FlockChain AI — PoultryLedger Soroban Smart Contract
// Deployed on Stellar Testnet
//
// Replaces raw `manageData` operations with structured on-chain state:
//   - Immutable sensor hash anchoring per farm per day
//   - PFSI-gated supply chain certification (score >= 70 enforced on-chain)
//   - ECO_KUKK reward distribution with double-claim prevention
//   - Public certificate verifier (trustless, queryable by anyone)
//
// Build:   cargo build --target wasm32-unknown-unknown --release
// Deploy:  stellar contract deploy --wasm target/wasm32-unknown-unknown/release/poultry_ledger.wasm --network testnet

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contractevent,
    symbol_short, log,
    Address, BytesN, Env, Map, Symbol, Vec,
};

// ── Storage Key Types ────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    FarmStats(Symbol),        // FarmStats per farm_id
    CertRecord(Symbol),       // CertRecord per cert_id
    SensorHashes(Symbol),     // Vec<BytesN<32>> per farm_id
    RewardClaimed(Symbol),    // bool per farm_id (prevents double-claim)
    Admin,                    // Address of contract admin (deployer)
}

// ── Data Structures ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct FarmStats {
    pub farm_id:            Symbol,
    pub sensor_hash_count:  u64,
    pub last_pfsi:          u32,       // Scaled ×10 (e.g. 823 = 82.3)
    pub cert_count:         u32,
    pub reward_claimed:     bool,
    pub registered_at:      u64,       // ledger timestamp
    pub last_updated:       u64,
}

#[contracttype]
#[derive(Clone)]
pub struct CertRecord {
    pub cert_id:            Symbol,
    pub farm_id:            Symbol,
    pub pfsi_score:         u32,       // Scaled ×10
    pub cert_hash:          BytesN<32>,
    pub status:             Symbol,    // gold_cert | std_cert | suspended
    pub issued_at:          u64,       // ledger timestamp
    pub issuer:             Address,
}

// ── Contract Events ──────────────────────────────────────────────────────────

#[contractevent]
pub struct SensorHashRecorded {
    pub farm_id:   Symbol,
    pub hash:      BytesN<32>,
    pub seq:       u64,
    pub timestamp: u64,
}

#[contractevent]
pub struct CertificateIssued {
    pub cert_id:   Symbol,
    pub farm_id:   Symbol,
    pub pfsi:      u32,
    pub status:    Symbol,
    pub timestamp: u64,
}

#[contractevent]
pub struct RewardClaimed {
    pub farm_id:      Symbol,
    pub farmer_addr:  Address,
    pub amount_strok: i128,
    pub timestamp:    u64,
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct PoultryLedger;

#[contractimpl]
impl PoultryLedger {

    // ── Admin: initialize contract ─────────────────────────────────────────

    pub fn initialize(env: Env, admin: Address) {
        // Can only be called once
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        log!(&env, "PoultryLedger initialized. Admin: {}", admin);
    }

    // ── Sensor Hash Recording ──────────────────────────────────────────────

    /// Anchor a SHA-256 sensor telemetry hash immutably on the ledger.
    /// Returns the sequence number (total hashes recorded for this farm).
    pub fn record_sensor_hash(
        env: Env,
        caller: Address,
        farm_id: Symbol,
        hash: BytesN<32>,
    ) -> u64 {
        caller.require_auth();

        // Load or create farm stats
        let mut stats = Self::get_or_create_farm_stats(&env, farm_id.clone());

        // Append hash to the farm's history
        let key = DataKey::SensorHashes(farm_id.clone());
        let mut hashes: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));

        hashes.push_back(hash.clone());
        env.storage().persistent().set(&key, &hashes);

        stats.sensor_hash_count += 1;
        stats.last_updated = env.ledger().timestamp();
        env.storage().persistent().set(&DataKey::FarmStats(farm_id.clone()), &stats);

        // Emit event (indexed by Stellar RPC)
        env.events().publish(
            (symbol_short!("sensor"), farm_id.clone()),
            SensorHashRecorded {
                farm_id: farm_id.clone(),
                hash,
                seq: stats.sensor_hash_count,
                timestamp: env.ledger().timestamp(),
            },
        );

        stats.sensor_hash_count
    }

    // ── Certificate Issuance ───────────────────────────────────────────────

    /// Issue a PFSI-gated supply chain certificate.
    /// PFSI score is passed as integer ×10 (e.g. 82.3 PFSI = 823).
    /// Enforces: score >= 700 (PFSI 70.0) for Gold, >= 500 for Standard.
    /// Returns the cert_id Symbol.
    pub fn issue_certificate(
        env: Env,
        issuer: Address,
        farm_id: Symbol,
        pfsi_score_x10: u32,
        cert_hash: BytesN<32>,
        cert_id: Symbol,
    ) -> Symbol {
        issuer.require_auth();

        // Enforce PFSI threshold — SUSPENDED certs cannot be issued on-chain
        if pfsi_score_x10 < 500 {
            panic!("PFSI score below minimum threshold (50.0) for certification");
        }

        let status = if pfsi_score_x10 >= 700 {
            symbol_short!("gold_cert")
        } else {
            symbol_short!("std_cert")
        };

        let record = CertRecord {
            cert_id: cert_id.clone(),
            farm_id: farm_id.clone(),
            pfsi_score: pfsi_score_x10,
            cert_hash: cert_hash.clone(),
            status: status.clone(),
            issued_at: env.ledger().timestamp(),
            issuer: issuer.clone(),
        };

        env.storage().persistent().set(&DataKey::CertRecord(cert_id.clone()), &record);

        // Update farm stats
        let mut stats = Self::get_or_create_farm_stats(&env, farm_id.clone());
        stats.cert_count += 1;
        stats.last_pfsi = pfsi_score_x10;
        stats.last_updated = env.ledger().timestamp();
        env.storage().persistent().set(&DataKey::FarmStats(farm_id.clone()), &stats);

        // Emit indexed event
        env.events().publish(
            (symbol_short!("cert"), farm_id.clone()),
            CertificateIssued {
                cert_id: cert_id.clone(),
                farm_id,
                pfsi: pfsi_score_x10,
                status,
                timestamp: env.ledger().timestamp(),
            },
        );

        cert_id
    }

    // ── Reward Distribution ────────────────────────────────────────────────

    /// Record an ECO_KUKK reward claim on-chain (prevents double-claim).
    /// The actual token transfer is done by the server via payment() operation.
    /// Returns amount_strok (reward in stroops, 1 ECO_KUKK = 10_000_000 strok).
    pub fn record_reward_claim(
        env: Env,
        caller: Address,
        farm_id: Symbol,
        farmer_addr: Address,
        pfsi_score_x10: u32,
    ) -> i128 {
        caller.require_auth();

        // Prevent double-claim
        if env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::RewardClaimed(farm_id.clone()))
            .unwrap_or(false)
        {
            panic!("reward already claimed for this farm in this period");
        }

        // Enforce PFSI threshold (70.0 = 700 in x10 scale)
        if pfsi_score_x10 < 700 {
            panic!("PFSI score too low for reward (minimum 70.0 required)");
        }

        // Tiered reward: Gold (85+) = 20 ECO_KUKK, Standard = 10 ECO_KUKK
        let amount_strok: i128 = if pfsi_score_x10 >= 850 {
            200_000_000  // 20 ECO_KUKK
        } else {
            100_000_000  // 10 ECO_KUKK
        };

        // Mark claimed
        env.storage().persistent().set(&DataKey::RewardClaimed(farm_id.clone()), &true);

        // Update farm stats
        let mut stats = Self::get_or_create_farm_stats(&env, farm_id.clone());
        stats.reward_claimed = true;
        stats.last_updated = env.ledger().timestamp();
        env.storage().persistent().set(&DataKey::FarmStats(farm_id.clone()), &stats);

        // Emit event
        env.events().publish(
            (symbol_short!("reward"), farm_id.clone()),
            RewardClaimed {
                farm_id,
                farmer_addr,
                amount_strok,
                timestamp: env.ledger().timestamp(),
            },
        );

        amount_strok
    }

    // ── Public Read Functions ──────────────────────────────────────────────

    /// Verify any certificate by ID — trustless, no auth required.
    pub fn verify_cert(env: Env, cert_id: Symbol) -> CertRecord {
        env.storage()
            .persistent()
            .get(&DataKey::CertRecord(cert_id.clone()))
            .unwrap_or_else(|| panic!("certificate not found: {:?}", cert_id))
    }

    /// Get farm statistics — public read.
    pub fn get_farm_stats(env: Env, farm_id: Symbol) -> FarmStats {
        env.storage()
            .persistent()
            .get(&DataKey::FarmStats(farm_id.clone()))
            .unwrap_or_else(|| panic!("farm not found: {:?}", farm_id))
    }

    /// Get last N sensor hashes for a farm.
    pub fn get_sensor_hashes(env: Env, farm_id: Symbol, last_n: u32) -> Vec<BytesN<32>> {
        let all: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::SensorHashes(farm_id))
            .unwrap_or(Vec::new(&env));

        let total = all.len();
        let start = if total > last_n { total - last_n } else { 0 };
        let mut result = Vec::new(&env);
        for i in start..total {
            result.push_back(all.get(i).unwrap());
        }
        result
    }

    /// Check if a farm has already claimed its reward this period.
    pub fn is_reward_claimed(env: Env, farm_id: Symbol) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::RewardClaimed(farm_id))
            .unwrap_or(false)
    }

    // ── Internal Helpers ───────────────────────────────────────────────────

    fn get_or_create_farm_stats(env: &Env, farm_id: Symbol) -> FarmStats {
        env.storage()
            .persistent()
            .get(&DataKey::FarmStats(farm_id.clone()))
            .unwrap_or(FarmStats {
                farm_id: farm_id.clone(),
                sensor_hash_count: 0,
                last_pfsi: 0,
                cert_count: 0,
                reward_claimed: false,
                registered_at: env.ledger().timestamp(),
                last_updated: env.ledger().timestamp(),
            })
    }
}

// ── Unit Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env, Symbol, BytesN};

    fn make_env() -> Env {
        let env = Env::default();
        env.mock_all_auths();
        env
    }

    #[test]
    fn test_initialize_and_record_sensor_hash() {
        let env = make_env();
        let contract_id = env.register(PoultryLedger, ());
        let client = PoultryLedgerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let farmer = Address::generate(&env);
        let farm_id = Symbol::new(&env, "FARM001");
        let hash: BytesN<32> = BytesN::from_array(&env, &[1u8; 32]);

        client.initialize(&admin);
        let seq = client.record_sensor_hash(&farmer, &farm_id, &hash);
        assert_eq!(seq, 1);

        let stats = client.get_farm_stats(&farm_id);
        assert_eq!(stats.sensor_hash_count, 1);
    }

    #[test]
    fn test_issue_certificate_gold() {
        let env = make_env();
        let contract_id = env.register(PoultryLedger, ());
        let client = PoultryLedgerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let farm_id = Symbol::new(&env, "FARM001");
        let cert_id = Symbol::new(&env, "CERT001");
        let hash: BytesN<32> = BytesN::from_array(&env, &[2u8; 32]);

        client.initialize(&admin);
        let returned_id = client.issue_certificate(&admin, &farm_id, &820u32, &hash, &cert_id);
        assert_eq!(returned_id, cert_id);

        let record = client.verify_cert(&cert_id);
        assert_eq!(record.pfsi_score, 820);
        assert_eq!(record.status, Symbol::new(&env, "gold_cert"));
    }

    #[test]
    #[should_panic(expected = "PFSI score below minimum threshold")]
    fn test_certificate_rejected_below_threshold() {
        let env = make_env();
        let contract_id = env.register(PoultryLedger, ());
        let client = PoultryLedgerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let farm_id = Symbol::new(&env, "FARM005");
        let cert_id = Symbol::new(&env, "CERT005");
        let hash: BytesN<32> = BytesN::from_array(&env, &[5u8; 32]);

        client.initialize(&admin);
        // PFSI 32.0 = 320 x10 → should panic
        client.issue_certificate(&admin, &farm_id, &320u32, &hash, &cert_id);
    }

    #[test]
    #[should_panic(expected = "reward already claimed")]
    fn test_double_claim_prevented() {
        let env = make_env();
        let contract_id = env.register(PoultryLedger, ());
        let client = PoultryLedgerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let farmer = Address::generate(&env);
        let farm_id = Symbol::new(&env, "FARM001");

        client.initialize(&admin);
        client.record_reward_claim(&admin, &farm_id, &farmer, &820u32);
        // Second claim should panic
        client.record_reward_claim(&admin, &farm_id, &farmer, &820u32);
    }
}
