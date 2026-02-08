/**
 * Bankr Integration (bankr.bot)
 *
 * Bankr provides wallet infrastructure for autonomous agents.
 * Agents can use their bk_ API key to sign and submit blockchain transactions
 * without requiring hosted wallet infrastructure.
 *
 * Docs: https://docs.bankr.bot
 */

import type { Address, Hex } from 'viem'

const BANKR_API_URL = process.env.BANKR_API_URL || 'https://api.bankr.bot'

interface BankrTransaction {
  to: Address
  data: Hex
  value?: string // hex string
  chainId: number
  gasLimit?: string // optional gas limit override
}

interface BankrSignResponse {
  signature: Hex
  serialized: Hex
}

interface BankrSubmitResponse {
  hash: Hex
  status: 'pending' | 'confirmed' | 'failed'
}

interface BankrWallet {
  address: Address
  chainId: number
  isPrimary: boolean
}

interface BankrWalletsResponse {
  wallets: BankrWallet[]
}

/**
 * Sign a transaction using Bankr
 * Does NOT submit the transaction to the network
 *
 * @param apiKey - Bankr API key (bk_...)
 * @param transaction - Transaction to sign
 * @returns Signature and serialized transaction
 */
export async function bankrSign(
  apiKey: string,
  transaction: BankrTransaction
): Promise<BankrSignResponse> {
  const response = await fetch(`${BANKR_API_URL}/agent/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(transaction),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Bankr sign failed: ${error.error || response.statusText}`)
  }

  return response.json()
}

/**
 * Sign and submit a transaction using Bankr
 * Submits the transaction to the blockchain network
 *
 * @param apiKey - Bankr API key (bk_...)
 * @param transaction - Transaction to sign and submit
 * @param waitForConfirmation - Whether to wait for tx confirmation (default: false)
 * @returns Transaction hash and status
 */
export async function bankrSubmit(
  apiKey: string,
  transaction: BankrTransaction,
  waitForConfirmation: boolean = false
): Promise<BankrSubmitResponse> {
  const response = await fetch(`${BANKR_API_URL}/agent/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      ...transaction,
      waitForConfirmation,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Bankr submit failed: ${error.error || response.statusText}`)
  }

  return response.json()
}

/**
 * Get wallet addresses associated with a Bankr API key
 *
 * @param apiKey - Bankr API key (bk_...)
 * @returns List of wallet addresses with their chain IDs
 */
export async function bankrGetWallets(apiKey: string): Promise<BankrWalletsResponse> {
  const response = await fetch(`${BANKR_API_URL}/agent/wallets`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Bankr get wallets failed: ${error.error || response.statusText}`)
  }

  return response.json()
}

/**
 * Get the primary wallet address for a given chain
 *
 * @param apiKey - Bankr API key (bk_...)
 * @param chainId - Chain ID (8453 for Base, 84532 for Base Sepolia)
 * @returns Primary wallet address for the chain
 */
export async function bankrGetPrimaryWallet(apiKey: string, chainId: number): Promise<Address> {
  const { wallets } = await bankrGetWallets(apiKey)

  const primaryWallet = wallets.find(w => w.chainId === chainId && w.isPrimary)
  if (!primaryWallet) {
    throw new Error(`No primary wallet found for chain ${chainId}`)
  }

  return primaryWallet.address
}

/**
 * Validate a Bankr API key format
 *
 * @param apiKey - API key to validate
 * @returns True if format is valid (bk_ prefix + alphanumeric)
 */
export function isValidBankrApiKey(apiKey: string): boolean {
  return /^bk_[a-zA-Z0-9]{32,64}$/.test(apiKey)
}
