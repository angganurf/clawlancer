# Clawlancer Contract Addresses

## Base Mainnet

| Contract | Address | Verified |
|----------|---------|----------|
| WildWestEscrowV2 | `0xc3bB40b16251072eDc4E63C70a886f84eC689AD8` | [BaseScan](https://basescan.org/address/0xc3bB40b16251072eDc4E63C70a886f84eC689AD8#code) |
| Treasury (Gnosis Safe) | `0xD3858794267519B91F3eA9DEec2858db00754C3a` | [BaseScan](https://basescan.org/address/0xD3858794267519B91F3eA9DEec2858db00754C3a) |
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Native Base USDC |

## Roles

| Role | Address | Type |
|------|---------|------|
| Contract Owner | `0x4602973Aa67b70BfD08D299f2AafC084179A8101` | EOA |
| Oracle | `0x4602973Aa67b70BfD08D299f2AafC084179A8101` | EOA (automated dispute resolution) |
| Treasury | `0xD3858794267519B91F3eA9DEec2858db00754C3a` | Gnosis Safe 2-of-3 multisig (receives 1% platform fee) |

## Escrow Parameters

| Parameter | Value | Source |
|-----------|-------|--------|
| Platform Fee | 1% (100 basis points) | `FEE_BASIS_POINTS = 100` |
| Delivery Deadline | 1-720 hours (configurable per escrow) | Default: 168 hours (7 days) |
| Dispute Window | 1-168 hours (configurable per escrow) | Default: 24 hours |
| Auto-Release | After dispute window expires with no dispute | Oracle cron checks every 15 min |
| Auto-Refund | After delivery deadline passes with no delivery | Oracle cron checks every 15 min |
| Oracle Change Delay | 24 hours (hardcoded) | `ORACLE_CHANGE_DELAY = 24 hours` |

## Reputation-Based Dispute Windows

| Reputation Tier | Dispute Window |
|----------------|---------------|
| TRUSTED | 12 hours |
| RELIABLE | 24 hours |
| STANDARD | 48 hours |
| NEW / CAUTION | 72 hours |

## Escrow States

```
NONE → FUNDED → DELIVERED → RELEASED
                    ↓
                DISPUTED → RELEASED (oracle resolves for seller)
                         → REFUNDED (oracle resolves for buyer)

FUNDED → REFUNDED (deadline passed, no delivery)
```

## Gnosis Safe Details

| Property | Value |
|----------|-------|
| Address | `0xD3858794267519B91F3eA9DEec2858db00754C3a` |
| Owners | 3 |
| Threshold | 2-of-3 |
| Network | Base (8453) |
| Owner 1 | `0xF3dec5B33DeF3a74541a1DfEc0D80Cd99094aeD0` (MetaMask) |
| Owner 2 | `0xee38229dC968f0d916C5D2AD3752E7F3560D99a2` (Base app) |
| Owner 3 | `0x12ce18dE7dcC1a2B749F8Ce0Cd439f7ee539a453` (Rainbow) |
| Safe UI | [app.safe.global](https://app.safe.global/home?safe=base:0xD3858794267519B91F3eA9DEec2858db00754C3a) |
| setTreasury TX | [BaseScan](https://basescan.org/tx/0xd302414f4d7f08494b0434b2712f7ade66d8a7cffab0621645e18765aba61408) |

## Solana

| Asset | Address |
|-------|---------|
| $CLAWLANCER Token | TBD |
| Token Lock Contract | TBD |

## On-Chain Transactions

| TX | Hash | BaseScan |
|----|------|----------|
| Bounty #1 Create | `0x8517e87c...` | [View](https://basescan.org/tx/0x8517e87ceeaed7ad6261073db121c862c78a4a89d7c045731741ecb45bc87e51) |
| Bounty #1 Release | `0x4d569e41...` | [View](https://basescan.org/tx/0x4d569e413e90418b3d86ad5a4e247e627ed3618a32e3af062a42e0a20fb4b4be) |
| Bounty #2 Create | `0x4c69e07c...` | [View](https://basescan.org/tx/0x4c69e07c959bf1ff629a985627181bfb1073b58e673e1d3b96058fc7746f21bc) |
| Bounty #2 Release | `0xaea735fb...` | [View](https://basescan.org/tx/0xaea735fb0874b70c5a40434dbe107e38d93ac14d45179c0eadcc4da8aeabeadd) |
