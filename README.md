# PolyGov: Cross-Chain Governance Framework

<div align="center">

![PolyGov Logo](fe/public/logo.png)

*A decentralized governance platform enabling seamless decision-making across multiple blockchain networks*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.28-blue.svg)](https://soliditylang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22.18-yellow.svg)](https://hardhat.org/)

</div>

## 📋 Table of Contents

- [Overview](#overview)
- [Research Background](#research-background)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Smart Contracts](#smart-contracts)
- [Relayer System](#relayer-system)
- [Frontend Application](#frontend-application)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [Testing](#testing)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## 🔍 Overview

PolyGov is an innovative cross-chain governance framework that addresses the fragmentation challenges in multi-chain ecosystems. It enables decentralized autonomous organizations (DAOs) and protocols to coordinate governance decisions across multiple blockchain networks seamlessly.

The platform leverages a sophisticated relayer system to synchronize proposals and votes between a main governance chain and multiple secondary chains, ensuring consistent and secure decision-making across the entire ecosystem.

## 🔬 Research Background

*[This section will be populated with details from your thesis. Please add the following information:]*

### Problem Statement
- *Details about the challenges in cross-chain governance*
- *Current limitations in existing solutions*
- *Research objectives and hypotheses*

### Methodology
- *Research approach and methodologies used*
- *Experimental design and testing frameworks*
- *Performance metrics and evaluation criteria*

### Literature Review
- *Related work in cross-chain governance*
- *Comparative analysis with existing solutions*
- *Technical innovations and contributions*

### Results and Analysis
- *Key findings from your research*
- *Performance benchmarks*
- *Security analysis results*
- *Scalability measurements*

## 🏗️ Architecture

PolyGov consists of three main components working in harmony:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Relayer     │    │ Smart Contracts │
│   (Next.js)     │◄──►│   (Node.js)     │◄──►│   (Solidity)    │
│                 │    │                 │    │                 │
│ • User Interface│    │ • Cross-chain   │    │ • MainGovernance│
│ • Wallet Connect│    │   Sync          │    │ • SecondaryGov  │
│ • Proposal UI   │    │ • Event Monitor │    │ • PGV Token     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Multi-Chain Architecture

```
Main Chain (Arbitrum Sepolia)
├── MainGovernance Contract
├── PGV Token Contract
└── Proposal Execution

Secondary Chains (BSC Testnet)
├── SecondaryGovernance Contract
├── PGV Token Contract (Mirrored)
└── Vote Collection

Relayer System
├── Proposal Mirroring
├── Vote Aggregation
└── Result Synchronization
```

## ✨ Key Features

### 🌐 Cross-Chain Governance
- **Multi-Network Support**: Seamlessly operate across Arbitrum, BSC, and other EVM-compatible chains
- **Unified Voting**: Aggregate votes from multiple chains into a single governance decision
- **Proposal Mirroring**: Automatically replicate proposals across all connected networks

### 🔒 Security & Trust
- **Trusted Relayer System**: Secure message passing between chains with cryptographic verification
- **Reentrancy Protection**: All critical functions protected against reentrancy attacks
- **Access Control**: Role-based permissions for different governance operations

### 💰 Token-Based Voting
- **ERC20Votes Standard**: Leverage OpenZeppelin's battle-tested voting token implementation
- **Timestamp-Based Snapshots**: Consistent voting power calculation across chains
- **Auto-Delegation**: Automatic vote delegation for improved user experience

### 🔄 Real-Time Synchronization
- **WebSocket Connections**: Real-time event monitoring across all chains
- **Automatic Retry Logic**: Robust error handling and connection recovery
- **Health Monitoring**: Comprehensive system health checks and alerts

### 📊 Comprehensive Governance
- **Flexible Proposals**: Support for complex multi-transaction proposals
- **Quorum Requirements**: Configurable quorum thresholds for proposal validity
- **Execution Framework**: Automatic execution of approved proposals

## 📜 Smart Contracts

### MainGovernance.sol
The central governance contract deployed on the main chain (Arbitrum Sepolia).

**Key Functions:**
- `createProposal()`: Create new governance proposals
- `castVote()`: Cast votes on active proposals
- `finalizeProposalVotes()`: Aggregate votes from all chains
- `executeProposal()`: Execute approved proposals
- `collectSecondaryChainVotes()`: Collect votes from secondary chains (relayer only)

**Key Features:**
- Proposal lifecycle management
- Multi-chain vote aggregation
- Quorum enforcement
- Proposal execution with arbitrary contract calls

### SecondaryGovernance.sol
Mirror governance contracts deployed on secondary chains.

**Key Functions:**
- `mirrorProposal()`: Mirror proposals from main chain (relayer only)
- `castVote()`: Cast votes on mirrored proposals
- `finalizeVotes()`: Prepare vote data for collection (relayer only)
- `updateProposalStatus()`: Update proposal status from main chain results

**Key Features:**
- Proposal mirroring from main chain
- Local vote collection
- Status synchronization

### PGVToken.sol
ERC20 governance token with cross-chain voting capabilities.

**Key Features:**
- **ERC20Votes**: Built-in voting functionality with delegation
- **Timestamp-Based Voting**: Uses block timestamps instead of block numbers for cross-chain consistency
- **Auto-Delegation**: Automatically delegates votes to token recipients
- **Fixed Supply**: 10,000 total tokens for controlled governance
- **ERC20Permit**: Gasless approval functionality

## 🔄 Relayer System

The relayer system is the backbone of cross-chain communication, ensuring data consistency and integrity across all connected networks.

### Core Components

#### Event Listeners
- **Main Chain Listeners**: Monitor proposal creation and voting events
- **Secondary Chain Listeners**: Monitor voting completion and status updates

#### Synchronization Services
- **Proposal Mirroring**: Replicate new proposals to secondary chains
- **Vote Collection**: Aggregate voting results from secondary chains
- **Status Updates**: Synchronize proposal outcomes across all chains

#### Utility Systems
- **Connection Management**: WebSocket connection handling with auto-reconnect
- **Nonce Management**: Transaction ordering and duplicate prevention
- **Cache System**: Persistent storage for processed proposals
- **Health Monitoring**: System status monitoring and alerting

### Periodic Tasks
- **Proposal Sync**: Hourly synchronization of new proposals (1 hour intervals)
- **Vote Processing**: Frequent processing of completed proposals (30-second intervals)

## 💻 Frontend Application

Built with modern web technologies for an optimal user experience.

### Technology Stack
- **Framework**: Next.js 15.1.6 with React 19
- **Styling**: Tailwind CSS with custom UI components
- **Blockchain Integration**: Wagmi v2 + RainbowKit for wallet connectivity
- **State Management**: TanStack Query for efficient data fetching
- **UI Components**: Radix UI primitives with custom styling

### Key Features
- **Multi-Wallet Support**: Connect with popular Ethereum wallets
- **Real-Time Updates**: Live proposal status and voting updates
- **Responsive Design**: Mobile-first responsive interface
- **Dark/Light Mode**: Theme switching capability
- **IPFS Integration**: Decentralized storage for proposal metadata

### User Interface Components
- **Dashboard**: Overview of all active proposals
- **Proposal Creation**: Intuitive proposal creation form
- **Voting Interface**: Chain-specific voting with power display
- **Proposal Details**: Comprehensive proposal information
- **Execution Status**: Real-time execution status tracking

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ or Bun runtime
- Git for version control
- MetaMask or compatible Web3 wallet

### Clone Repository
```bash
git clone https://github.com/your-username/PolyGov.git
cd PolyGov
```

### Install Dependencies
```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

### Environment Setup
Create a `.env` file in the root directory:

```env
# Wallet Private Keys
OWNER_PVT_KEY=your_owner_private_key_here
RELAYER_PVT_KEY=your_relayer_private_key_here

# RPC Endpoints
ARB_RPC=https://sepolia-rollup.arbitrum.io/rpc
BSC_RPC=https://data-seed-prebsc-1-s1.binance.org:8545

# WebSocket Endpoints (for relayer)
ARB_WS_URL=wss://sepolia-rollup.arbitrum.io/rpc
BSC_WS_URL=wss://bsc-testnet.public.blastapi.io

# Optional: Etherscan API Keys
ARBISCAN_API_KEY=your_arbiscan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key
```

### Compile Smart Contracts
```bash
bun run compile
```

### Generate TypeScript Types
```bash
bun run typechain
```

## 📖 Usage

### 1. Deploy Smart Contracts

#### Deploy PGV Tokens
```bash
# Deploy tokens to both networks
bun run deploy:token
```

#### Deploy Governance Contracts
```bash
# Deploy to BSC Testnet
bun run deploy:bsc

# Deploy to Arbitrum Testnet
bun run deploy:arb
```

#### Distribute Test Tokens
```bash
# Distribute tokens for testing
bun run dist:token
```

### 2. Start the Relayer
```bash
# Start the cross-chain relayer
bun run relay
```

### 3. Launch Frontend
```bash
# Navigate to frontend directory
cd fe

# Install frontend dependencies
bun install

# Start development server
bun run dev
```

The application will be available at `http://localhost:3000`

### 4. Using the Platform

#### Create a Proposal
1. Connect your wallet using the "Connect Wallet" button
2. Click "Create Proposal" on the dashboard
3. Fill in proposal details:
   - Title and description
   - IPFS hash for additional documentation
   - Voting duration in minutes
   - Execution parameters (optional)
4. Submit the proposal (requires minimum 100 PGV tokens)

#### Vote on Proposals
1. Browse active proposals on the dashboard
2. Click on a proposal to view details
3. Select your vote (Yes/No) on each connected chain
4. Confirm the transaction in your wallet

#### Monitor Results
- View real-time voting progress
- Check proposal status across all chains
- Monitor execution status for approved proposals

## 🧪 Testing

### Run Test Suite
```bash
# Run all tests
bun run test

# Run with coverage
bun run test --coverage

# Run specific test file
bunx hardhat test test/Governance.test.ts
```

### Test Coverage
The test suite covers:
- ✅ Token functionality and auto-delegation
- ✅ Proposal creation and validation
- ✅ Voting mechanisms and power calculation
- ✅ Cross-chain proposal mirroring
- ✅ Vote aggregation and finalization
- ✅ Proposal execution
- ✅ Access control and security measures
- ✅ Error handling and edge cases

### Test Networks
- **Local Hardhat Network**: For unit testing
- **BSC Testnet**: For integration testing
- **Arbitrum Sepolia**: For end-to-end testing

## 🚀 Deployment

### Network Configuration

The project is configured for the following networks:

#### Main Chain: Arbitrum Sepolia
- **Chain ID**: 421614
- **RPC URL**: https://sepolia-rollup.arbitrum.io/rpc
- **Explorer**: https://sepolia.arbiscan.io/
- **Governance Contract**: `0x2265d043c79caeca800be7ecc150c6c23d5e3374`
- **Token Contract**: `0xc359f38eD76d8941d486dA85a4aA553Aa74b18BD`

#### Secondary Chain: BSC Testnet
- **Chain ID**: 97
- **RPC URL**: https://data-seed-prebsc-1-s1.binance.org:8545
- **Explorer**: https://testnet.bscscan.com/
- **Governance Contract**: `0x216941d5ce326edec59ffdf6959a1b855ee94276`
- **Token Contract**: `0xc359f38eD76d8941d486dA85a4aA553Aa74b18BD`

### Production Deployment Checklist

- [ ] Update contract addresses in configuration files
- [ ] Set up secure private key management
- [ ] Configure production RPC endpoints
- [ ] Set up monitoring and alerting
- [ ] Verify all contract deployments
- [ ] Test cross-chain functionality
- [ ] Configure frontend environment variables
- [ ] Set up CI/CD pipelines

## ⚙️ Configuration

### Smart Contract Configuration

#### MainGovernance Parameters
- **Quorum Votes**: 1,000 PGV (adjustable by admin)
- **Minimum Creation Power**: 100 PGV
- **Minimum Voting Duration**: 1 minute

#### Token Configuration
- **Total Supply**: 10,000 PGV
- **Decimals**: 18
- **Voting Mechanism**: Timestamp-based for cross-chain consistency

### Relayer Configuration

Located in `relayer/config.ts`:

```typescript
export const CONFIG = {
    MAIN: {
        CHAIN_ID: "main",
        RPC_URL: process.env.ARB_RPC,
        WS_URL: process.env.ARB_WS_URL,
        CONTRACT: "0x2265d043c79caeca800be7ecc150c6c23d5e3374",
    },
    SECONDARY_CHAINS: [{
        CHAIN_ID: "bsc",
        RPC_URL: process.env.BSC_RPC,
        WS_URL: process.env.BSC_WS_URL,
        CONTRACT: "0x216941d5ce326edec59ffdf6959a1b855ee94276",
    }],
};
```

### Frontend Configuration

Located in `fe/src/constants/config.ts`:

```typescript
const CONFIG = {
    MAIN: {
        name: "Arbitrum Sepolia",
        chainId: 421614,
        contracts: {
            token: "0xc359f38eD76d8941d486dA85a4aA553Aa74b18BD",
            governance: "0x2265d043c79caeca800be7ecc150c6c23d5e3374",
        },
    },
    SECONDARY_CHAINS: [{
        name: "BSC Testnet",
        chainId: 97,
        contracts: {
            token: "0xc359f38eD76d8941d486dA85a4aA553Aa74b18BD",
            governance: "0x216941d5ce326edec59ffdf6959a1b855ee94276",
        },
    }],
};
```

## 📚 API Reference

### Smart Contract Events

#### MainGovernance Events
```solidity
event ProposalCreated(bytes32 indexed id, string title, uint256 endTime);
event Voted(bytes32 indexed proposalId, address voter, bool support, uint256 weight);
event VoteTallyFinalized(bytes32 indexed id, uint256 totalYesVotes, uint256 totalNoVotes);
event ProposalExecuted(bytes32 indexed id, ProposalStatus status);
event SecondaryChainVotesCollected(bytes32 indexed proposalId, string chainId, uint256 yesVotes, uint256 noVotes);
```

#### SecondaryGovernance Events
```solidity
event ProposalMirrored(bytes32 indexed id, string title, uint256 endTime);
event Voted(bytes32 indexed proposalId, address voter, bool support, uint256 weight);
event VotesTallied(bytes32 indexed proposalId, uint256 yesVotes, uint256 noVotes);
```

### Frontend Hooks

#### Core Hooks
- `useProposals()`: Fetch all proposals
- `useProposalById(id)`: Fetch specific proposal details
- `useCreateProposal()`: Create new proposals
- `useVoteOnProposal()`: Cast votes on proposals
- `useVotingPower()`: Get user's voting power
- `useHasUserVoted()`: Check if user has voted

#### Chain-Specific Hooks
- `useChainProposalDetails()`: Get proposal details for specific chain
- `useVoteStats()`: Get voting statistics
- `useExecuteProposal()`: Execute approved proposals

## 🤝 Contributing

We welcome contributions to PolyGov! Please follow these guidelines:

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add/update tests as needed
5. Ensure all tests pass (`bun run test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Standards
- Follow TypeScript best practices
- Use consistent code formatting (Prettier)
- Write comprehensive tests for new features
- Document complex functions and components
- Follow Solidity style guidelines

### Areas for Contribution
- Additional blockchain network support
- UI/UX improvements
- Performance optimizations
- Security enhancements
- Documentation improvements
- Test coverage expansion

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenZeppelin for secure smart contract libraries
- Hardhat team for development framework
- Wagmi and RainbowKit for Web3 integration
- The Ethereum and multi-chain community for inspiration



<div align="center">

**PolyGov** - *Bridging governance across chains* 🌉

Made with ❤️ for the decentralized future

</div>
