/**
 * Set Treasury to Gnosis Safe Multisig
 *
 * Calls setTreasury() on WildWestEscrowV2 using the oracle/owner wallet.
 * This is a one-time operation to upgrade the treasury from an EOA to a 2-of-3 Safe.
 */
const { createWalletClient, createPublicClient, http, encodeFunctionData } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
require('dotenv').config({ path: '.env.local' });

const ESCROW_V2_ADDRESS = '0xc3bB40b16251072eDc4E63C70a886f84eC689AD8';
const NEW_TREASURY = '0xD3858794267519B91F3eA9DEec2858db00754C3a'; // Gnosis Safe 2-of-3

const SET_TREASURY_ABI = [{
  name: 'setTreasury',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [{ name: '_treasury', type: 'address' }],
  outputs: [],
}];

const TREASURY_GETTER_ABI = [{
  name: 'treasury',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ name: '', type: 'address' }],
}];

async function main() {
  const privateKey = process.env.ORACLE_PRIVATE_KEY;
  if (!privateKey) {
    console.error('ORACLE_PRIVATE_KEY not set in .env.local');
    process.exit(1);
  }

  const rpcUrl = process.env.ALCHEMY_BASE_URL;
  if (!rpcUrl) {
    console.error('ALCHEMY_BASE_URL not set in .env.local');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  // Pre-flight: verify current state
  console.log('=== SET TREASURY TO GNOSIS SAFE ===\n');
  console.log(`Escrow Contract: ${ESCROW_V2_ADDRESS}`);
  console.log(`Signer (owner):  ${account.address}`);
  console.log(`New Treasury:    ${NEW_TREASURY}`);

  const currentTreasury = await publicClient.readContract({
    address: ESCROW_V2_ADDRESS,
    abi: TREASURY_GETTER_ABI,
    functionName: 'treasury',
  });
  console.log(`Current Treasury: ${currentTreasury}`);

  if (currentTreasury.toLowerCase() === NEW_TREASURY.toLowerCase()) {
    console.log('\nTreasury is already set to the Safe. Nothing to do.');
    return;
  }

  console.log('\nSending setTreasury transaction...');

  const hash = await walletClient.writeContract({
    address: ESCROW_V2_ADDRESS,
    abi: SET_TREASURY_ABI,
    functionName: 'setTreasury',
    args: [NEW_TREASURY],
  });

  console.log(`TX Hash: ${hash}`);
  console.log(`BaseScan: https://basescan.org/tx/${hash}`);
  console.log('\nWaiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Status: ${receipt.status === 'success' ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed}`);

  // Verify
  const newTreasury = await publicClient.readContract({
    address: ESCROW_V2_ADDRESS,
    abi: TREASURY_GETTER_ABI,
    functionName: 'treasury',
  });
  console.log(`\n=== VERIFICATION ===`);
  console.log(`Treasury now: ${newTreasury}`);

  if (newTreasury.toLowerCase() === NEW_TREASURY.toLowerCase()) {
    console.log('CONFIRMED: Treasury is now the Gnosis Safe multisig.');
    console.log(`\nSafe: https://app.safe.global/home?safe=base:${NEW_TREASURY}`);
    console.log(`BaseScan: https://basescan.org/address/${NEW_TREASURY}`);
  } else {
    console.error('ERROR: Treasury did not update!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n!!! FAILED !!!', err.message);
  process.exit(1);
});
