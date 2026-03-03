#![no_std]
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    token, Address, BytesN, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    TimeoutNotReached = 4,
    InvalidSignature = 5,
    InsufficientBalance = 6,
    AlreadyTransferred = 7,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Owner,              // Address - wallet owner
    OwnerPubKey,        // BytesN<32> - ed25519 key
    Beneficiary,        // Address - beneficiary
    BeneficiaryPubKey,  // BytesN<32> - beneficiary ed25519
    TimeoutDuration,    // u64 - inactivity timeout (sec)
    LastActiveTime,     // u64 - last ping (unix ts)
    Agent,              // Address — Keeper
    XlmSac,             // Address - SAC for native XLM
    Transferred,        // bool - transfer completed?
}

/// Account Status
#[contracttype]
#[derive(Clone)]
pub struct AccountStatus {
    pub owner: Address,
    pub beneficiary: Address,
    pub timeout_sec: u64,
    pub last_active: u64,
    pub time_remaining: u64,
    pub is_expired: bool,
    pub transferred: bool,
}

/// Signature for __check_auth
#[contracttype]
#[derive(Clone)]
pub struct Signature {
    pub signer: Address,
    pub signature: BytesN<64>,
}

#[contract]
pub struct KeepAliveSmartAccount;

#[contractimpl]
impl KeepAliveSmartAccount {

    /// Initialize Smart Wallet.
    /// Funds remain in user wallet. Contract only controls transfer_from.
    pub fn init(
        env: Env,
        owner: Address,
        beneficiary: Address,
        timeout_duration: u64,
        owner_pub_key: BytesN<32>,
        beneficiary_pub_key: BytesN<32>,
        agent: Address,
        xlm_sac: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Owner) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::OwnerPubKey, &owner_pub_key);
        env.storage().instance().set(&DataKey::Beneficiary, &beneficiary);
        env.storage().instance().set(&DataKey::BeneficiaryPubKey, &beneficiary_pub_key);
        env.storage().instance().set(&DataKey::TimeoutDuration, &timeout_duration);
        env.storage().instance().set(&DataKey::Agent, &agent);
        env.storage().instance().set(&DataKey::XlmSac, &xlm_sac);
        env.storage().instance().set(&DataKey::Transferred, &false);

        let now = env.ledger().timestamp();
        env.storage().instance().set(&DataKey::LastActiveTime, &now);

        env.storage().instance().extend_ttl(31536000, 31536000);
        Ok(())
    }


    //  TRIGGER TRANSFER - Automatic translation on timeout
    //  Called by Keeper or Beneficiary after timeout.
    //  Transfers ALL XLM from owner to beneficiary via transfer_from.


    pub fn trigger_transfer(env: Env) -> Result<i128, Error> {
        // Check initialization
        let owner: Address = env.storage().instance().get(&DataKey::Owner)
            .ok_or(Error::NotInitialized)?;
        let beneficiary: Address = env.storage().instance().get(&DataKey::Beneficiary)
            .ok_or(Error::NotInitialized)?;

        // Check if transfer already completed
        let transferred: bool = env.storage().instance().get(&DataKey::Transferred)
            .unwrap_or(false);
        if transferred {
            return Err(Error::AlreadyTransferred);
        }

        // Check if timeout expired
        let timeout: u64 = env.storage().instance().get(&DataKey::TimeoutDuration)
            .ok_or(Error::NotInitialized)?;
        let last_active: u64 = env.storage().instance().get(&DataKey::LastActiveTime)
            .ok_or(Error::NotInitialized)?;
        let now = env.ledger().timestamp();

        if now.saturating_sub(last_active) < timeout {
            return Err(Error::TimeoutNotReached);
        }

        // Timeout expired - transfer all XLM from owner to beneficiary
        let xlm_sac: Address = env.storage().instance().get(&DataKey::XlmSac)
            .ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &xlm_sac);

        // Get owner balance
        let owner_balance = client.balance(&owner);
        if owner_balance <= 0 {
            return Err(Error::InsufficientBalance);
        }

        // Leave 2.5 XLM (25_000_000 stroops) for minimum balance
        // (Base reserve + signers/trustlines reserve)
        let min_reserve: i128 = 25_000_000; // 2.5 XLM
        let transfer_amount = owner_balance - min_reserve;
        if transfer_amount <= 0 {
            return Err(Error::InsufficientBalance);
        }

        // transfer_from: contract transfers from owner to beneficiary
        // Works thanks to SAC.approve signed during activation
        client.transfer_from(
            &env.current_contract_address(), // spender (contract)
            &owner,                           // from (user wallet)
            &beneficiary,                     // to (beneficiary)
            &transfer_amount,
        );

        // Mark transfer as completed
        env.storage().instance().set(&DataKey::Transferred, &true);

        Ok(transfer_amount)
    }


    //  PING - Reset timer (Owner or Agent/Keeper)


    pub fn ping(env: Env, caller: Address) -> Result<(), Error> {
        let owner: Address = env.storage().instance().get(&DataKey::Owner)
            .ok_or(Error::NotInitialized)?;
        let agent: Address = env.storage().instance().get(&DataKey::Agent)
            .ok_or(Error::NotInitialized)?;

        if caller != owner && caller != agent {
            return Err(Error::NotAuthorized);
        }
        caller.require_auth();

        let now = env.ledger().timestamp();
        env.storage().instance().set(&DataKey::LastActiveTime, &now);
        env.storage().instance().extend_ttl(31536000, 31536000);

        Ok(())
    }


    //  READ FUNCTIONS


    pub fn get_last_active(env: Env) -> Result<u64, Error> {
        env.storage().instance().get(&DataKey::LastActiveTime).ok_or(Error::NotInitialized)
    }

    pub fn get_status(env: Env) -> Result<AccountStatus, Error> {
        let owner: Address = env.storage().instance().get(&DataKey::Owner)
            .ok_or(Error::NotInitialized)?;
        let beneficiary: Address = env.storage().instance().get(&DataKey::Beneficiary)
            .ok_or(Error::NotInitialized)?;
        let timeout: u64 = env.storage().instance().get(&DataKey::TimeoutDuration)
            .ok_or(Error::NotInitialized)?;
        let last_active: u64 = env.storage().instance().get(&DataKey::LastActiveTime)
            .ok_or(Error::NotInitialized)?;
        let transferred: bool = env.storage().instance().get(&DataKey::Transferred)
            .unwrap_or(false);

        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(last_active);
        let is_expired = elapsed >= timeout;
        let time_remaining = if is_expired { 0 } else { timeout - elapsed };

        Ok(AccountStatus {
            owner,
            beneficiary,
            timeout_sec: timeout,
            last_active,
            time_remaining,
            is_expired,
            transferred,
        })
    }
}


//  ACCOUNT ABSTRACTION — __check_auth


#[contractimpl]
impl CustomAccountInterface for KeepAliveSmartAccount {
    type Error = Error;
    type Signature = Signature;

    #[allow(non_snake_case)]
    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signature: Signature,
        _auth_context: Vec<Context>,
    ) -> Result<(), Error> {
        let owner: Address = env.storage().instance().get(&DataKey::Owner)
            .ok_or(Error::NotInitialized)?;
        let beneficiary: Address = env.storage().instance().get(&DataKey::Beneficiary)
            .ok_or(Error::NotInitialized)?;

        let signer = &signature.signer;

        if *signer == owner {
            let owner_pk: BytesN<32> = env.storage().instance().get(&DataKey::OwnerPubKey)
                .ok_or(Error::NotInitialized)?;
            env.crypto().ed25519_verify(
                &owner_pk,
                &signature_payload.into(),
                &signature.signature,
            );
            // Owner signed - reset timer
            let now = env.ledger().timestamp();
            env.storage().instance().set(&DataKey::LastActiveTime, &now);
            Ok(())
        } else if *signer == beneficiary {
            // Beneficiary - only after timeout
            let timeout: u64 = env.storage().instance().get(&DataKey::TimeoutDuration)
                .ok_or(Error::NotInitialized)?;
            let last_active: u64 = env.storage().instance().get(&DataKey::LastActiveTime)
                .ok_or(Error::NotInitialized)?;
            let now = env.ledger().timestamp();
            if now.saturating_sub(last_active) < timeout {
                return Err(Error::TimeoutNotReached);
            }
            let ben_pk: BytesN<32> = env.storage().instance().get(&DataKey::BeneficiaryPubKey)
                .ok_or(Error::NotInitialized)?;
            env.crypto().ed25519_verify(
                &ben_pk,
                &signature_payload.into(),
                &signature.signature,
            );
            Ok(())
        } else {
            Err(Error::NotAuthorized)
        }
    }
}
