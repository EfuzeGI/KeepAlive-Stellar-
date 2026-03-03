#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, log, token, Address, Env, String,
};


//  Storage Keys


#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    // Instance storage
    Owner,
    Backup,
    TokenId,
    IntervalSec,
    GracePeriodSec,
    WarningTriggeredAt,
    IsYielding,
    IsEmergency,
    IsCompleted,
    IsInitialized,
    SecurePayload,
    AgentAccount,
    // Persistent storage
    LastPingTimestamp,
    // Balance tracked in-contract (XLM held by this contract)
    VaultBalance,
}


//  Return Types


#[derive(Clone)]
#[contracttype]
pub struct VaultStatus {
    pub owner: Address,
    pub backup: Address,
    pub vault_balance: i128,
    pub interval_sec: u64,
    pub grace_period_sec: u64,
    pub last_ping: u64,
    pub time_remaining_sec: u64,
    pub warning_triggered_at: u64,
    pub warning_grace_remaining_sec: u64,
    pub is_expired: bool,
    pub is_warning_active: bool,
    pub is_execution_ready: bool,
    pub is_yielding: bool,
    pub is_emergency: bool,
    pub is_completed: bool,
    pub has_secure_payload: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct PulseResult {
    pub status: u32, // 0=ALIVE, 1=WARNING_REQUIRED, 2=WARNING_GRACE, 3=YIELD_PENDING, 4=YIELD_INITIATED
    pub is_yielding: bool,
}


//  Constants


const MIN_INTERVAL_SEC: u64 = 60; // 1 minute minimum
const DEFAULT_INTERVAL_SEC: u64 = 30 * 24 * 60 * 60; // 30 days
const MIN_GRACE_PERIOD_SEC: u64 = 60; // 1 minute minimum
const DEFAULT_GRACE_PERIOD_SEC: u64 = 24 * 60 * 60; // 24 hours


//  Contract


#[contract]
pub struct KeepAliveInstance;

#[contractimpl]
impl KeepAliveInstance {

    //  Initialization (called once by Factory after deploy)


    /// Initialize a new KeepAlive vault instance.
    ///
    /// # Arguments
    /// * `owner` - The primary admin who controls this vault
    /// * `backup` - The fallback address that receives control on inactivity
    /// * `token_id` - The XLM SAC contract address for token operations
    /// * `interval_sec` - Heartbeat interval in seconds (0 = default 30 days)
    /// * `grace_period_sec` - Grace period after warning in seconds (0 = default 24h)
    /// * `agent` - Optional authorized agent account for auto-pings
    /// * `secure_payload` - Optional encrypted payload for beneficiary
    pub fn initialize(
        env: Env,
        owner: Address,
        backup: Address,
        token_id: Address,
        interval_sec: u64,
        grace_period_sec: u64,
        agent: Address,
        secure_payload: Option<String>,
    ) {
        // Prevent re-initialization
        if env.storage().instance().has(&DataKey::IsInitialized) {
            panic!("Already initialized");
        }

        // Owner must authorize this initialization
        owner.require_auth();

        let actual_interval = if interval_sec >= MIN_INTERVAL_SEC {
            interval_sec
        } else {
            DEFAULT_INTERVAL_SEC
        };

        let actual_grace = if grace_period_sec >= MIN_GRACE_PERIOD_SEC {
            grace_period_sec
        } else {
            DEFAULT_GRACE_PERIOD_SEC
        };

        let now = env.ledger().timestamp();

        // Instance storage — lives with the contract
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Backup, &backup);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage()
            .instance()
            .set(&DataKey::IntervalSec, &actual_interval);
        env.storage()
            .instance()
            .set(&DataKey::GracePeriodSec, &actual_grace);
        env.storage()
            .instance()
            .set(&DataKey::WarningTriggeredAt, &0u64);
        env.storage()
            .instance()
            .set(&DataKey::IsYielding, &false);
        env.storage()
            .instance()
            .set(&DataKey::IsEmergency, &false);
        env.storage()
            .instance()
            .set(&DataKey::IsCompleted, &false);
        env.storage()
            .instance()
            .set(&DataKey::IsInitialized, &true);
        env.storage()
            .instance()
            .set(&DataKey::AgentAccount, &agent);
        env.storage()
            .instance()
            .set(&DataKey::VaultBalance, &0i128);

        if let Some(payload) = secure_payload {
            env.storage()
                .instance()
                .set(&DataKey::SecurePayload, &payload);
        }

        // Persistent storage — survives archival
        env.storage()
            .persistent()
            .set(&DataKey::LastPingTimestamp, &now);

        log!(
            &env,
            "KeepAlive initialized: owner={}, backup={}, interval={}s, grace={}s",
            owner,
            backup,
            actual_interval,
            actual_grace
        );
    }


    //  Owner Actions


    /// Reset the heartbeat timer. Only the owner can call this.
    /// Also cancels any active warning, yield, or emergency state.
    pub fn ping(env: Env) {
        Self::require_initialized(&env);
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        let is_completed: bool = env.storage().instance().get(&DataKey::IsCompleted).unwrap();
        if is_completed {
            panic!("Vault completed. Create a new vault to start fresh.");
        }

        let now = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::LastPingTimestamp, &now);
        env.storage()
            .instance()
            .set(&DataKey::WarningTriggeredAt, &0u64);

        // Cancel yield/emergency if active
        let is_yielding: bool = env.storage().instance().get(&DataKey::IsYielding).unwrap();
        if is_yielding {
            env.storage()
                .instance()
                .set(&DataKey::IsYielding, &false);
            log!(&env, "Yield cancelled — owner is alive");
        }

        let is_emergency: bool = env.storage().instance().get(&DataKey::IsEmergency).unwrap();
        if is_emergency {
            env.storage()
                .instance()
                .set(&DataKey::IsEmergency, &false);
            log!(&env, "Emergency cancelled");
        }

        log!(&env, "Heartbeat confirmed at {}", now);
    }

    /// Agent auto-extend: authorized agent can ping on behalf of owner.
    pub fn agent_ping(env: Env) {
        Self::require_initialized(&env);
        let agent: Address = env.storage().instance().get(&DataKey::AgentAccount).unwrap();
        agent.require_auth();

        let is_completed: bool = env.storage().instance().get(&DataKey::IsCompleted).unwrap();
        if is_completed {
            panic!("Cannot ping completed vault");
        }
        let is_emergency: bool = env.storage().instance().get(&DataKey::IsEmergency).unwrap();
        if is_emergency {
            panic!("Cannot ping vault in emergency state");
        }
        let is_yielding: bool = env.storage().instance().get(&DataKey::IsYielding).unwrap();
        if is_yielding {
            panic!("Cannot ping vault in yielding state");
        }

        let now = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::LastPingTimestamp, &now);

        // Clear warning if active
        let warning_at: u64 = env
            .storage()
            .instance()
            .get(&DataKey::WarningTriggeredAt)
            .unwrap();
        if warning_at != 0 {
            env.storage()
                .instance()
                .set(&DataKey::WarningTriggeredAt, &0u64);
            log!(&env, "Warning cleared via agent ping");
        }

        log!(&env, "Agent auto-extended vault");
    }

    /// Deposit XLM into the vault. Caller must have approved this contract
    /// on the XLM SAC for at least `amount` stroops.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        Self::require_initialized(&env);
        from.require_auth();

        if amount <= 0 {
            panic!("Deposit amount must be positive");
        }

        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let contract_addr = env.current_contract_address();

        // Transfer XLM from caller to this contract
        token::Client::new(&env, &token_id).transfer(&from, &contract_addr, &amount);

        // Track balance
        let current: i128 = env
            .storage()
            .instance()
            .get(&DataKey::VaultBalance)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::VaultBalance, &(current + amount));

        log!(&env, "Deposit: {} stroops. New balance: {}", amount, current + amount);
    }

    /// Withdraw XLM from the vault. Only the owner can call this.
    /// If `amount` is 0, withdraws the full balance.
    pub fn withdraw(env: Env, amount: i128) {
        Self::require_initialized(&env);
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        let is_emergency: bool = env.storage().instance().get(&DataKey::IsEmergency).unwrap();
        let is_yielding: bool = env.storage().instance().get(&DataKey::IsYielding).unwrap();
        if is_emergency || is_yielding {
            panic!("Vault is locked during emergency/yield state");
        }

        let current: i128 = env
            .storage()
            .instance()
            .get(&DataKey::VaultBalance)
            .unwrap_or(0);

        let withdraw_amount = if amount <= 0 { current } else { amount };

        if withdraw_amount <= 0 {
            panic!("Nothing to withdraw");
        }
        if withdraw_amount > current {
            panic!("Insufficient balance");
        }

        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let contract_addr = env.current_contract_address();

        token::Client::new(&env, &token_id).transfer(&contract_addr, &owner, &withdraw_amount);

        env.storage()
            .instance()
            .set(&DataKey::VaultBalance, &(current - withdraw_amount));

        log!(
            &env,
            "Withdraw: {} stroops to owner. Remaining: {}",
            withdraw_amount,
            current - withdraw_amount
        );
    }

    /// Update the backup (beneficiary) address. Owner-only.
    pub fn update_beneficiary(env: Env, new_backup: Address) {
        Self::require_initialized(&env);
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        env.storage().instance().set(&DataKey::Backup, &new_backup);
        log!(&env, "Beneficiary updated to {}", new_backup);
    }

    /// Update the heartbeat interval. Owner-only.
    pub fn update_interval(env: Env, new_interval_sec: u64) {
        Self::require_initialized(&env);
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        if new_interval_sec < MIN_INTERVAL_SEC {
            panic!("Interval must be >= {} seconds", MIN_INTERVAL_SEC);
        }

        env.storage()
            .instance()
            .set(&DataKey::IntervalSec, &new_interval_sec);
        log!(&env, "Interval updated to {}s", new_interval_sec);
    }

    /// Update the grace period. Owner-only.
    pub fn update_grace_period(env: Env, new_grace_sec: u64) {
        Self::require_initialized(&env);
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        if new_grace_sec < MIN_GRACE_PERIOD_SEC {
            panic!("Grace period must be >= {} seconds", MIN_GRACE_PERIOD_SEC);
        }

        env.storage()
            .instance()
            .set(&DataKey::GracePeriodSec, &new_grace_sec);
        log!(&env, "Grace period updated to {}s", new_grace_sec);
    }

    /// Delete the vault, return all balance to owner.
    pub fn reset_vault(env: Env) {
        Self::require_initialized(&env);
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        let balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::VaultBalance)
            .unwrap_or(0);

        if balance > 0 {
            let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
            let contract_addr = env.current_contract_address();
            token::Client::new(&env, &token_id).transfer(&contract_addr, &owner, &balance);
        }

        // Clear all state
        env.storage().instance().remove(&DataKey::Owner);
        env.storage().instance().remove(&DataKey::Backup);
        env.storage().instance().remove(&DataKey::TokenId);
        env.storage().instance().remove(&DataKey::IntervalSec);
        env.storage().instance().remove(&DataKey::GracePeriodSec);
        env.storage().instance().remove(&DataKey::WarningTriggeredAt);
        env.storage().instance().remove(&DataKey::IsYielding);
        env.storage().instance().remove(&DataKey::IsEmergency);
        env.storage().instance().remove(&DataKey::IsCompleted);
        env.storage().instance().remove(&DataKey::IsInitialized);
        env.storage().instance().remove(&DataKey::AgentAccount);
        env.storage().instance().remove(&DataKey::VaultBalance);
        env.storage().instance().remove(&DataKey::SecurePayload);
        env.storage().persistent().remove(&DataKey::LastPingTimestamp);

        log!(&env, "Vault reset. Returned {} stroops to owner", balance);
    }


    //  Lifecycle: Warning → Grace → Yield → Fallback


    /// Trigger a warning if the heartbeat has expired. Anyone can call.
    /// Returns: 0=NOT_EXPIRED, 1=WARNING_TRIGGERED, 2=WARNING_ALREADY_SENT
    pub fn trigger_warning(env: Env) -> u32 {
        Self::require_initialized(&env);

        let now = env.ledger().timestamp();
        let last_ping: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LastPingTimestamp)
            .unwrap();
        let interval: u64 = env
            .storage()
            .instance()
            .get(&DataKey::IntervalSec)
            .unwrap();
        let deadline = last_ping + interval;

        if now <= deadline {
            return 0; // NOT_EXPIRED
        }

        let warning_at: u64 = env
            .storage()
            .instance()
            .get(&DataKey::WarningTriggeredAt)
            .unwrap();
        if warning_at != 0 {
            return 2; // WARNING_ALREADY_SENT
        }

        env.storage()
            .instance()
            .set(&DataKey::WarningTriggeredAt, &now);

        log!(&env, "WARNING: Heartbeat expired. Grace period started.");
        1 // WARNING_TRIGGERED
    }

    /// Check liveness. Evaluates the full state machine.
    /// Returns PulseResult with status codes:
    /// 0=ALIVE, 1=WARNING_REQUIRED, 2=WARNING_GRACE, 3=YIELD_PENDING, 4=YIELD_INITIATED
    pub fn check_pulse(env: Env) -> PulseResult {
        Self::require_initialized(&env);

        let now = env.ledger().timestamp();
        let last_ping: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LastPingTimestamp)
            .unwrap();
        let interval: u64 = env
            .storage()
            .instance()
            .get(&DataKey::IntervalSec)
            .unwrap();
        let deadline = last_ping + interval;

        if now <= deadline {
            return PulseResult {
                status: 0,
                is_yielding: false,
            };
        }

        let warning_at: u64 = env
            .storage()
            .instance()
            .get(&DataKey::WarningTriggeredAt)
            .unwrap();
        if warning_at == 0 {
            return PulseResult {
                status: 1,
                is_yielding: false,
            };
        }

        let grace: u64 = env
            .storage()
            .instance()
            .get(&DataKey::GracePeriodSec)
            .unwrap();
        let warning_deadline = warning_at + grace;

        if now < warning_deadline {
            return PulseResult {
                status: 2,
                is_yielding: false,
            };
        }

        let is_yielding: bool = env.storage().instance().get(&DataKey::IsYielding).unwrap();
        if is_yielding {
            return PulseResult {
                status: 3,
                is_yielding: true,
            };
        }

        // Initiate yield
        env.storage()
            .instance()
            .set(&DataKey::IsYielding, &true);

        log!(
            &env,
            "YIELD: Grace period expired. Waiting for agent verification."
        );
        PulseResult {
            status: 4,
            is_yielding: true,
        }
    }

    /// Execute the fallback transfer. Transfers ownership + funds to backup.
    /// `confirm_death`: if true, transfers balance to beneficiary; if false, resumes.
    pub fn trigger_fallback(env: Env, confirm_death: bool) -> u32 {
        Self::require_initialized(&env);

        let is_yielding: bool = env.storage().instance().get(&DataKey::IsYielding).unwrap();
        if !is_yielding {
            panic!("Vault not in yield state");
        }

        env.storage()
            .instance()
            .set(&DataKey::IsYielding, &false);

        if !confirm_death {
            // Resume — owner proved alive
            env.storage()
                .instance()
                .set(&DataKey::WarningTriggeredAt, &0u64);
            log!(&env, "RESUME: Owner verified alive. Yield cancelled.");
            return 0; // RESUMED
        }

        // Execute transfer to beneficiary
        env.storage()
            .instance()
            .set(&DataKey::IsEmergency, &true);
        env.storage()
            .instance()
            .set(&DataKey::IsCompleted, &true);

        let balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::VaultBalance)
            .unwrap_or(0);

        if balance > 0 {
            let backup: Address = env.storage().instance().get(&DataKey::Backup).unwrap();
            let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
            let contract_addr = env.current_contract_address();

            token::Client::new(&env, &token_id).transfer(&contract_addr, &backup, &balance);

            env.storage()
                .instance()
                .set(&DataKey::VaultBalance, &0i128);

            log!(
                &env,
                "TRANSFER COMPLETE: {} stroops -> beneficiary",
                balance
            );
        }

        1 // TRANSFER_COMPLETE
    }


    //  Secure Payload (Proxy Contract / Encrypted Data)


    /// Reveal the encrypted payload. Owner always has access.
    /// Beneficiary has access ONLY if the vault is completed.
    pub fn reveal_payload(env: Env, caller: Address) -> Option<String> {
        Self::require_initialized(&env);
        caller.require_auth();

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        let backup: Address = env.storage().instance().get(&DataKey::Backup).unwrap();

        if caller == owner {
            return env.storage().instance().get(&DataKey::SecurePayload);
        }

        if caller == backup {
            let is_completed: bool =
                env.storage().instance().get(&DataKey::IsCompleted).unwrap();
            if is_completed {
                return env.storage().instance().get(&DataKey::SecurePayload);
            }
            panic!("Vault is still active. Access denied.");
        }

        panic!("Unauthorized: Payload access denied");
    }


    //  View Methods (read-only, no auth required)


    /// Get the full vault status. Read-only.
    pub fn get_status(env: Env) -> VaultStatus {
        Self::require_initialized(&env);

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        let backup: Address = env.storage().instance().get(&DataKey::Backup).unwrap();
        let balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::VaultBalance)
            .unwrap_or(0);
        let interval: u64 = env
            .storage()
            .instance()
            .get(&DataKey::IntervalSec)
            .unwrap();
        let grace: u64 = env
            .storage()
            .instance()
            .get(&DataKey::GracePeriodSec)
            .unwrap();
        let last_ping: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LastPingTimestamp)
            .unwrap();
        let warning_at: u64 = env
            .storage()
            .instance()
            .get(&DataKey::WarningTriggeredAt)
            .unwrap();
        let is_yielding: bool = env.storage().instance().get(&DataKey::IsYielding).unwrap();
        let is_emergency: bool = env.storage().instance().get(&DataKey::IsEmergency).unwrap();
        let is_completed: bool = env.storage().instance().get(&DataKey::IsCompleted).unwrap();

        let now = env.ledger().timestamp();
        let deadline = last_ping + interval;
        let is_expired = now > deadline;
        let time_remaining = if deadline > now {
            deadline - now
        } else {
            0
        };

        let mut warning_grace_remaining: u64 = 0;
        let mut is_warning_active = false;
        let mut is_execution_ready = false;

        if warning_at != 0 {
            is_warning_active = true;
            let warning_deadline = warning_at + grace;
            warning_grace_remaining = if warning_deadline > now {
                warning_deadline - now
            } else {
                0
            };
            is_execution_ready = now >= warning_deadline && is_expired;
        }

        let has_payload: bool = env
            .storage()
            .instance()
            .has(&DataKey::SecurePayload);

        VaultStatus {
            owner,
            backup,
            vault_balance: balance,
            interval_sec: interval,
            grace_period_sec: grace,
            last_ping,
            time_remaining_sec: time_remaining,
            warning_triggered_at: warning_at,
            warning_grace_remaining_sec: warning_grace_remaining,
            is_expired,
            is_warning_active,
            is_execution_ready,
            is_yielding,
            is_emergency,
            is_completed,
            has_secure_payload: has_payload,
        }
    }

    /// Get the owner address.
    pub fn get_owner(env: Env) -> Address {
        Self::require_initialized(&env);
        env.storage().instance().get(&DataKey::Owner).unwrap()
    }

    /// Get the backup (beneficiary) address.
    pub fn get_backup(env: Env) -> Address {
        Self::require_initialized(&env);
        env.storage().instance().get(&DataKey::Backup).unwrap()
    }


    //  Internal Helpers


    fn require_initialized(env: &Env) {
        if !env.storage().instance().has(&DataKey::IsInitialized) {
            panic!("Contract not initialized");
        }
    }
}


//  Tests


#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
    use soroban_sdk::{token::StellarAssetClient, Env};

    fn setup_env() -> (
        Env,
        Address,        // contract
        Address,        // owner
        Address,        // backup
        Address,        // agent
        Address,        // token_id
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(KeepAliveInstance, ());
        let owner = Address::generate(&env);
        let backup = Address::generate(&env);
        let agent = Address::generate(&env);

        // Create a test token (simulates XLM SAC)
        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_id = token_contract.address();
        let sac = StellarAssetClient::new(&env, &token_id);

        // Mint tokens to owner for testing
        sac.mint(&owner, &10_000_000_000i128); // 1000 XLM in stroops

        (env, contract_id, owner, backup, agent, token_id)
    }

    fn init_vault(
        env: &Env,
        contract_id: &Address,
        owner: &Address,
        backup: &Address,
        agent: &Address,
        token_id: &Address,
    ) {
        let client = KeepAliveInstanceClient::new(env, contract_id);
        client.initialize(
            owner,
            backup,
            token_id,
            &300u64,  // 5 minute interval
            &60u64,   // 1 minute grace
            agent,
            &None::<String>,
        );
    }

    #[test]
    fn test_initialize() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);
        let status = client.get_status();

        assert_eq!(status.owner, owner);
        assert_eq!(status.backup, backup);
        assert_eq!(status.interval_sec, 300);
        assert_eq!(status.grace_period_sec, 60);
        assert_eq!(status.vault_balance, 0);
        assert!(!status.is_expired);
        assert!(!status.is_yielding);
        assert!(!status.is_completed);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_double_initialize() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);
        // Second init should panic
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);
    }

    #[test]
    fn test_ping_resets_timer() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);

        // Advance time by 100 seconds
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 100,
            ..env.ledger().get()
        });

        client.ping();
        let status = client.get_status();

        // Time remaining should be close to full interval (300s), not 200s
        assert!(status.time_remaining_sec >= 299);
        assert!(!status.is_expired);
    }

    #[test]
    fn test_deposit_and_withdraw() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);

        // Deposit 100 XLM (in stroops: 100 * 10^7)
        let deposit_amount: i128 = 1_000_000_000;
        client.deposit(&owner, &deposit_amount);

        let status = client.get_status();
        assert_eq!(status.vault_balance, deposit_amount);

        // Withdraw half
        let half = deposit_amount / 2;
        client.withdraw(&half);

        let status = client.get_status();
        assert_eq!(status.vault_balance, half);
    }

    #[test]
    fn test_warning_and_yield_lifecycle() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);

        // Expire the heartbeat (advance time past interval)
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 301,
            ..env.ledger().get()
        });

        // Trigger warning
        let result = client.trigger_warning();
        assert_eq!(result, 1); // WARNING_TRIGGERED

        // Check pulse — should be in grace period
        let pulse = client.check_pulse();
        assert_eq!(pulse.status, 2); // WARNING_GRACE

        // Advance past grace period
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 61,
            ..env.ledger().get()
        });

        // Check pulse — should initiate yield
        let pulse = client.check_pulse();
        assert_eq!(pulse.status, 4); // YIELD_INITIATED
        assert!(pulse.is_yielding);
    }

    #[test]
    fn test_fallback_transfer() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);

        // Deposit some funds
        let deposit_amount: i128 = 500_000_000; // 50 XLM
        client.deposit(&owner, &deposit_amount);

        // Expire → warning → grace expires → yield
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 301,
            ..env.ledger().get()
        });
        client.trigger_warning();

        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 61,
            ..env.ledger().get()
        });
        client.check_pulse();

        // Execute fallback
        let result = client.trigger_fallback(&true);
        assert_eq!(result, 1); // TRANSFER_COMPLETE

        let status = client.get_status();
        assert!(status.is_completed);
        assert!(status.is_emergency);
        assert_eq!(status.vault_balance, 0);

        // Verify backup received the funds
        let token_client = token::Client::new(&env, &token_id);
        let backup_balance = token_client.balance(&backup);
        assert_eq!(backup_balance, deposit_amount);
    }

    #[test]
    fn test_fallback_resume() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);

        // Move to yield
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 301,
            ..env.ledger().get()
        });
        client.trigger_warning();
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 61,
            ..env.ledger().get()
        });
        client.check_pulse();

        // Resume instead of confirm death
        let result = client.trigger_fallback(&false);
        assert_eq!(result, 0); // RESUMED

        let status = client.get_status();
        assert!(!status.is_completed);
        assert!(!status.is_yielding);
    }

    #[test]
    fn test_update_beneficiary() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);
        let new_backup = Address::generate(&env);

        client.update_beneficiary(&new_backup);

        let status = client.get_status();
        assert_eq!(status.backup, new_backup);
    }

    #[test]
    fn test_agent_ping() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);

        // Advance time
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 100,
            ..env.ledger().get()
        });

        // Agent ping should reset timer
        client.agent_ping();

        let status = client.get_status();
        assert!(status.time_remaining_sec >= 299);
    }

    #[test]
    fn test_reveal_payload_owner() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();

        let client = KeepAliveInstanceClient::new(&env, &contract_id);
        let payload = String::from_str(&env, "secret-data-encrypted");

        client.initialize(
            &owner,
            &backup,
            &token_id,
            &300u64,
            &60u64,
            &agent,
            &Some(payload.clone()),
        );

        // Owner can always reveal
        let result = client.reveal_payload(&owner);
        assert_eq!(result, Some(payload));
    }

    #[test]
    #[should_panic(expected = "Vault is still active")]
    fn test_reveal_payload_beneficiary_blocked() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();

        let client = KeepAliveInstanceClient::new(&env, &contract_id);
        let payload = String::from_str(&env, "secret-data");

        client.initialize(
            &owner,
            &backup,
            &token_id,
            &300u64,
            &60u64,
            &agent,
            &Some(payload),
        );

        // Beneficiary cannot reveal while vault is active
        client.reveal_payload(&backup);
    }

    #[test]
    fn test_reset_vault() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);

        // Deposit then reset
        let deposit_amount: i128 = 100_000_000;
        client.deposit(&owner, &deposit_amount);

        let token_client = token::Client::new(&env, &token_id);
        let balance_before = token_client.balance(&owner);

        client.reset_vault();

        // Owner should get funds back
        let balance_after = token_client.balance(&owner);
        assert_eq!(balance_after - balance_before, deposit_amount);
    }

    #[test]
    #[should_panic(expected = "Vault completed")]
    fn test_ping_after_completion() {
        let (env, contract_id, owner, backup, agent, token_id) = setup_env();
        init_vault(&env, &contract_id, &owner, &backup, &agent, &token_id);

        let client = KeepAliveInstanceClient::new(&env, &contract_id);

        // Force to completed state via lifecycle
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 301,
            ..env.ledger().get()
        });
        client.trigger_warning();
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 61,
            ..env.ledger().get()
        });
        client.check_pulse();
        client.trigger_fallback(&true);

        // Ping should fail
        client.ping();
    }
}
