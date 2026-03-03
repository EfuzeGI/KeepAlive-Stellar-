#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, log, Address, BytesN, Env, Map, String, Vec,
};


//  Storage Keys


#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    WasmHash,
    TokenId,
    /// Map<Address, Address>: owner -> deployed instance contract
    Instances,
    /// Vec<Address>: ordered list of all owners for enumeration
    OwnerList,
    IsInitialized,
}


//  Return Types


#[derive(Clone)]
#[contracttype]
pub struct DeployResult {
    pub instance_address: Address,
    pub owner: Address,
}


//  Contract


#[contract]
pub struct KeepAliveFactory;

#[contractimpl]
impl KeepAliveFactory {
    /// Initialize the factory. Called once after deployment.
    ///
    /// # Arguments
    /// * `admin` - Factory administrator
    /// * `instance_wasm_hash` - Hash of the uploaded KeepAlive instance WASM
    /// * `token_id` - XLM SAC contract address (passed to all deployed instances)
    pub fn init(env: Env, admin: Address, instance_wasm_hash: BytesN<32>, token_id: Address) {
        if env.storage().instance().has(&DataKey::IsInitialized) {
            panic!("Factory already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::WasmHash, &instance_wasm_hash);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage()
            .instance()
            .set(&DataKey::IsInitialized, &true);

        let instances: Map<Address, Address> = Map::new(&env);
        env.storage()
            .instance()
            .set(&DataKey::Instances, &instances);

        let owner_list: Vec<Address> = Vec::new(&env);
        env.storage()
            .instance()
            .set(&DataKey::OwnerList, &owner_list);

        log!(&env, "Factory initialized by {}", admin);
    }

    /// Deploy a new isolated KeepAlive instance for the given owner.
    ///
    /// The `salt` parameter ensures unique contract addresses. Use the owner's
    /// address bytes or a random nonce. The deployer (caller = owner) pays
    /// for the new contract's storage rent.
    ///
    /// # Arguments
    /// * `owner` - The vault owner (primary admin)
    /// * `backup` - The fallback/beneficiary address
    /// * `interval_sec` - Heartbeat interval in seconds
    /// * `grace_period_sec` - Grace period after warning in seconds
    /// * `salt` - Unique salt for deterministic address generation
    /// * `agent` - Authorized agent account for auto-pings
    /// * `secure_payload` - Optional encrypted payload
    ///
    /// # Returns
    /// `DeployResult` with the new instance's contract address
    pub fn deploy(
        env: Env,
        owner: Address,
        backup: Address,
        interval_sec: u64,
        grace_period_sec: u64,
        salt: BytesN<32>,
        agent: Address,
        secure_payload: Option<String>,
    ) -> DeployResult {
        Self::require_initialized(&env);
        owner.require_auth();

        // Check if owner already has a vault
        let mut instances: Map<Address, Address> = env
            .storage()
            .instance()
            .get(&DataKey::Instances)
            .unwrap();

        if instances.contains_key(owner.clone()) {
            panic!("Owner already has a vault. Reset the existing one first.");
        }

        // Deploy a new instance contract from the stored WASM hash
        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::WasmHash)
            .unwrap();

        let deployed_address = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, ());

        // Initialize the newly deployed instance
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();

        // Build the initialize call on the new contract
        let init_fn = soroban_sdk::Symbol::new(&env, "initialize");
        let init_args: Vec<soroban_sdk::Val> = {
            use soroban_sdk::IntoVal;
            let mut args = Vec::new(&env);
            args.push_back(owner.clone().into_val(&env));
            args.push_back(backup.into_val(&env));
            args.push_back(token_id.into_val(&env));
            args.push_back(interval_sec.into_val(&env));
            args.push_back(grace_period_sec.into_val(&env));
            args.push_back(agent.into_val(&env));
            args.push_back(secure_payload.into_val(&env));
            args
        };
        env.invoke_contract::<()>(&deployed_address, &init_fn, init_args);

        // Track this deployment
        instances.set(owner.clone(), deployed_address.clone());
        env.storage()
            .instance()
            .set(&DataKey::Instances, &instances);

        let mut owner_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::OwnerList)
            .unwrap();
        owner_list.push_back(owner.clone());
        env.storage()
            .instance()
            .set(&DataKey::OwnerList, &owner_list);

        log!(
            &env,
            "Deployed KeepAlive instance for {} at {}",
            owner,
            deployed_address
        );

        DeployResult {
            instance_address: deployed_address,
            owner,
        }
    }

    /// Remove a tracked instance (called when user resets their vault).
    /// Only the owner of the instance or the factory admin can unregister.
    pub fn unregister(env: Env, owner: Address) {
        Self::require_initialized(&env);

        let _admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

        // Either the owner or admin can unregister
        owner.require_auth();

        let mut instances: Map<Address, Address> = env
            .storage()
            .instance()
            .get(&DataKey::Instances)
            .unwrap();

        if !instances.contains_key(owner.clone()) {
            panic!("No instance found for this owner");
        }

        instances.remove(owner.clone());
        env.storage()
            .instance()
            .set(&DataKey::Instances, &instances);

        // Remove from owner list
        let owner_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::OwnerList)
            .unwrap();

        let mut new_list: Vec<Address> = Vec::new(&env);
        for existing_owner in owner_list.iter() {
            if existing_owner != owner {
                new_list.push_back(existing_owner);
            }
        }
        env.storage()
            .instance()
            .set(&DataKey::OwnerList, &new_list);

        log!(&env, "Unregistered instance for {}", owner);
    }

    /// Update the WASM hash (for contract upgrades). Admin-only.
    pub fn update_wasm_hash(env: Env, new_wasm_hash: BytesN<32>) {
        Self::require_initialized(&env);
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::WasmHash, &new_wasm_hash);
        log!(&env, "WASM hash updated by admin");
    }


    //  View Methods


    /// Get the deployed instance address for a given owner.
    pub fn get_instance(env: Env, owner: Address) -> Option<Address> {
        Self::require_initialized(&env);
        let instances: Map<Address, Address> = env
            .storage()
            .instance()
            .get(&DataKey::Instances)
            .unwrap();
        instances.get(owner)
    }

    /// Get all deployed instance owners.
    pub fn get_all_owners(env: Env) -> Vec<Address> {
        Self::require_initialized(&env);
        env.storage()
            .instance()
            .get(&DataKey::OwnerList)
            .unwrap_or(Vec::new(&env))
    }

    /// Get the total count of deployed vaults.
    pub fn get_vault_count(env: Env) -> u32 {
        Self::require_initialized(&env);
        let owner_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::OwnerList)
            .unwrap_or(Vec::new(&env));
        owner_list.len()
    }

    /// Get the factory admin address.
    pub fn get_admin(env: Env) -> Address {
        Self::require_initialized(&env);
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }


    //  Internal


    fn require_initialized(env: &Env) {
        if !env.storage().instance().has(&DataKey::IsInitialized) {
            panic!("Factory not initialized");
        }
    }
}


//  Tests

//
//  NOTE: Full cross-contract deploy tests require a pre-built instance
//  WASM binary. Run them as integration tests after:
//    cargo build --target wasm32-unknown-unknown --release -p keepalive-instance
//
//  The tests below verify factory state management (init, tracking,
//  unregister) without needing the instance WASM.

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn setup_factory(env: &Env) -> (Address, Address, Address) {
        env.mock_all_auths();

        let factory_id = env.register(KeepAliveFactory, ());
        let admin = Address::generate(env);

        // Create a test token
        let token_admin = Address::generate(env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_id = token_contract.address();

        // Use a dummy WASM hash for init (we won't actually deploy instances)
        let dummy_wasm_hash = BytesN::from_array(env, &[0xABu8; 32]);

        let client = KeepAliveFactoryClient::new(env, &factory_id);
        client.init(&admin, &dummy_wasm_hash, &token_id);

        (factory_id, admin, token_id)
    }

    #[test]
    fn test_factory_init() {
        let env = Env::default();
        let (factory_id, admin, _) = setup_factory(&env);

        let client = KeepAliveFactoryClient::new(&env, &factory_id);
        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.get_vault_count(), 0);
        assert!(client.get_all_owners().is_empty());
    }

    #[test]
    #[should_panic(expected = "Factory already initialized")]
    fn test_factory_double_init() {
        let env = Env::default();
        let (factory_id, admin, token_id) = setup_factory(&env);

        let client = KeepAliveFactoryClient::new(&env, &factory_id);
        let fake_hash = BytesN::from_array(&env, &[0u8; 32]);
        client.init(&admin, &fake_hash, &token_id);
    }

    #[test]
    fn test_factory_update_wasm_hash() {
        let env = Env::default();
        env.mock_all_auths();

        let (factory_id, _, _) = setup_factory(&env);
        let client = KeepAliveFactoryClient::new(&env, &factory_id);

        // Update WASM hash should succeed (admin-only)
        let new_hash = BytesN::from_array(&env, &[0xFFu8; 32]);
        client.update_wasm_hash(&new_hash);
        // No panic = success
    }

    #[test]
    fn test_factory_get_instance_empty() {
        let env = Env::default();
        let (factory_id, _, _) = setup_factory(&env);

        let client = KeepAliveFactoryClient::new(&env, &factory_id);
        let owner = Address::generate(&env);

        // Should return None for unknown owners
        assert!(client.get_instance(&owner).is_none());
    }

    #[test]
    #[should_panic(expected = "Factory not initialized")]
    fn test_factory_not_initialized() {
        let env = Env::default();
        env.mock_all_auths();

        // Register factory but DON'T call init()
        let factory_id = env.register(KeepAliveFactory, ());
        let client = KeepAliveFactoryClient::new(&env, &factory_id);

        // Any view call should panic
        client.get_vault_count();
    }
}

