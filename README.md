# KeepAlive Protocol

Non-custodial asset protection and inheritance protocol built on Stellar (Soroban).

KeepAlive allows users to secure their Stellar assets by designating a beneficiary. The protocol monitors account activity, and if a predefined inactivity timeout is reached, it automatically transfers signing rights or assets to the designated heir.

## Architecture

The repository is structured as a monorepo containing the following components:

- `/soroban-contracts`: Core Rust smart contracts (Factory and Instance).
- `/frontend`: Next.js web application for interacting with the protocol.
- `/keeper-node`: Off-chain Node.js daemon that monitors account states and triggers time-locked operations.

## Network

Currently configured for **Stellar Testnet**.

## Getting Started

To run the project locally, please refer to the respective subdirectories for component-specific instructions.

### Prerequisites

- Node.js >= 18
- Rust + `soroban-cli`
- Freighter Wallet

## License

MIT
