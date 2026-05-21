#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Symbol, symbol_short, log
};

// Data keys for persistent storage
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,                      // Contract admin (verifying AI engine)
    Certificate(String),        // Maps a SHA256 cert hash to FlockCertificate
    FarmerReward(Address),     // Maps a farmer to their unclaimed carbon token balance
    TotalMinted,                // Total ECO_KUKK tokens minted by this contract
}

// Certificate structure containing verified flock data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FlockCertificate {
    pub farmer: Address,
    pub cert_hash: String,
    pub avg_pfsi: u32,          // Average Poultry Farm Sustainability Index (0 - 100)
    pub timestamp: u64,         // Block timestamp or submission time
    pub active_birds: u32,      // Number of birds in this batch
    pub is_valid: bool,         // Audit status
}

#[contract]
pub struct FlockChainContract;

#[contractimpl]
impl FlockChainContract {
    /// Initializes the contract, designating the admin key (typically the FlockChain AI admin service)
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract is already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalMinted, &0u128);
        
        log!(&env, "FlockChain Contract initialized by Admin: {}", admin);
    }

    /// Registers a new Flock Digital Health Certificate on the Stellar ledger.
    /// This represents a batch of poultry telemetry that has been audited and signed.
    /// Only the authorized admin can register new validated certificates.
    pub fn register_flock(
        env: Env,
        farmer: Address,
        cert_hash: String,
        avg_pfsi: u32,
        timestamp: u64,
        active_birds: u32,
    ) {
        // Authenticate admin
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        // Check if certificate already exists to prevent duplicate registry
        let key = DataKey::Certificate(cert_hash.clone());
        if env.storage().persistent().has(&key) {
            panic!("Certificate already registered");
        }

        // Validate PFSI boundaries
        if avg_pfsi > 100 {
            panic!("PFSI score must be between 0 and 100");
        }

        // Build the immutable certificate
        let cert = FlockCertificate {
            farmer: farmer.clone(),
            cert_hash: cert_hash.clone(),
            avg_pfsi,
            timestamp,
            active_birds,
            is_valid: true,
        };

        // Write certificate to persistent storage
        env.storage().persistent().set(&key, &cert);

        // --- AUTOMATIC CARBON REWARD CALCULATION ---
        // Farmers are awarded ECO_KUKK (carbon credits) based on their sustainability scores:
        // - PFSI >= 85 (High efficiency, low emissions): 100 credits
        // - PFSI >= 70 (Eco-friendly baseline): 40 credits
        // - PFSI < 70 (Standard): 0 credits (requires improvement)
        let reward_amount: u128 = if avg_pfsi >= 85 {
            100
        } else if avg_pfsi >= 70 {
            40
        } else {
            0
        };

        if reward_amount > 0 {
            let farmer_key = DataKey::FarmerReward(farmer.clone());
            let current_balance: u128 = env.storage().persistent().get(&farmer_key).unwrap_or(0);
            env.storage().persistent().set(&farmer_key, &(current_balance + reward_amount));
            
            log!(
                &env,
                "Farmer {} earned {} ECO_KUKK credits for PFSI: {}",
                farmer,
                reward_amount,
                avg_pfsi
            );
        }

        // Publish registration event for indexers
        env.events().publish(
            (symbol_short!("reg_cert"), farmer),
            (cert_hash, avg_pfsi, reward_amount),
        );
    }

    /// Allows a farmer to claim their accrued carbon token rewards.
    /// This mints and transfers the active reward balance directly to the farmer.
    pub fn claim_rewards(env: Env, farmer: Address) -> u128 {
        // Authenticate the farmer claiming their own tokens
        farmer.require_auth();

        let farmer_key = DataKey::FarmerReward(farmer.clone());
        let unclaimed_balance: u128 = env.storage().persistent().get(&farmer_key).unwrap_or(0);

        if unclaimed_balance == 0 {
            panic!("No pending rewards to claim");
        }

        // Reset farmer's unclaimed balance to 0
        env.storage().persistent().set(&farmer_key, &0u128);

        // Update total tokens minted
        let total_minted_key = DataKey::TotalMinted;
        let total_minted: u128 = env.storage().instance().get(&total_minted_key).unwrap_or(0);
        env.storage().instance().set(&total_minted_key, &(total_minted + unclaimed_balance));

        // Publish claim event to trigger off-chain token transfers or mints
        env.events().publish(
            (symbol_short!("claim"), farmer.clone()),
            unclaimed_balance,
        );

        log!(
            &env,
            "Farmer {} successfully claimed {} ECO_KUKK tokens",
            farmer,
            unclaimed_balance
        );

        unclaimed_balance
    }

    /// Verifies the authenticity of a digital health certificate hash.
    /// Returns the complete certificate details if found, or None.
    pub fn get_certificate(env: Env, cert_hash: String) -> Option<FlockCertificate> {
        let key = DataKey::Certificate(cert_hash);
        if env.storage().persistent().has(&key) {
            Some(env.storage().persistent().get(&key).unwrap())
        } else {
            None
        }
    }

    /// Quick boolean audit check to verify if a telemetry hash is active and authentic.
    pub fn verify_hash(env: Env, cert_hash: String) -> bool {
        let key = DataKey::Certificate(cert_hash);
        if env.storage().persistent().has(&key) {
            let cert: FlockCertificate = env.storage().persistent().get(&key).unwrap();
            cert.is_valid
        } else {
            false
        }
    }

    /// Allows the current admin to transfer control to a new admin address.
    pub fn transfer_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        log!(&env, "FlockChain Contract admin transferred to: {}", new_admin);
    }

    /// Fetches the unclaimed reward balance of a specific farmer.
    pub fn get_unclaimed_reward(env: Env, farmer: Address) -> u128 {
        let farmer_key = DataKey::FarmerReward(farmer);
        env.storage().persistent().get(&farmer_key).unwrap_or(0)
    }

    /// Fetches the total amount of ECO_KUKK carbon credits minted.
    pub fn get_total_minted(env: Env) -> u128 {
        env.storage().instance().get(&DataKey::TotalMinted).unwrap_or(0)
    }
}
