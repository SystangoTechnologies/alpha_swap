import { ethers, type Provider, type Signer } from 'ethers';
import { VAULT_RELAYER } from './constants';

// ERC20 ABI for approval functions
const ERC20_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function balanceOf(address account) view returns (uint256)'
];

export interface ApprovalResult {
    hasAllowance: boolean;
    currentAllowance: string;
    requiredAmount: string;
}

export interface BalanceResult {
    balance: string;
    decimals: number;
    symbol: string;
    formatted: string;
}

export interface ApprovalTransactionResult {
    success: boolean;
    transactionHash: string;
    blockNumber: number;
}

export class TokenApprovalManager {
    private provider: Provider;
    private signer: Signer;

    constructor(provider: Provider, signer: Signer) {
        this.provider = provider;
        this.signer = signer;
    }

    /**
     * Check if user has sufficient allowance
     */
    async checkAllowance(tokenAddress: string, owner: string, amount: string): Promise<ApprovalResult> {
        try {
            // Check if it's native ETH
            const isNativeEth = tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

            if (isNativeEth) {
                // Native ETH doesn't need approval
                return {
                    hasAllowance: true,
                    currentAllowance: amount,
                    requiredAmount: amount
                };
            }

            // For ERC-20 tokens
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ERC20_ABI,
                this.provider
            );

            // Check allowance for VaultRelayer
            const allowance = await tokenContract.allowance(owner, VAULT_RELAYER);
            const amountBigInt = BigInt(amount);
            const hasAllowance = allowance >= amountBigInt;

            return {
                hasAllowance,
                currentAllowance: allowance.toString(),
                requiredAmount: amount
            };
        } catch (error: any) {
            console.error('Error checking allowance:', error);
            throw new Error(`Failed to check token allowance: ${error.message}`);
        }
    }

    /**
     * Get token balance
     */
    async getTokenBalance(tokenAddress: string, owner: string): Promise<BalanceResult> {
        try {
            // Check if it's native ETH
            const isNativeEth = tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

            if (isNativeEth) {
                // For native ETH, use provider.getBalance
                const balance = await this.provider.getBalance(owner);
                return {
                    balance: balance.toString(),
                    decimals: 18,
                    symbol: 'ETH',
                    formatted: ethers.formatUnits(balance, 18)
                };
            }

            // For ERC-20 tokens
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ERC20_ABI,
                this.provider
            );

            const balance = await tokenContract.balanceOf(owner);
            const decimals = await tokenContract.decimals();
            const symbol = await tokenContract.symbol();

            return {
                balance: balance.toString(),
                decimals: Number(decimals),
                symbol,
                formatted: ethers.formatUnits(balance, decimals)
            };
        } catch (error) {
            console.error('Error getting token balance:', error);
            throw error;
        }
    }

    /**
     * Approve token spending
     * @param {string} tokenAddress - Token contract address
     * @param {string} amount - Amount to approve (use MaxUint256 for infinite)
     * @param {boolean} infinite - If true, approve infinite amount
     */
    async approveToken(tokenAddress: string, amount: string, infinite = false): Promise<ApprovalTransactionResult> {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ERC20_ABI,
                this.signer
            );

            const approvalAmount = infinite
                ? ethers.MaxUint256
                : BigInt(amount);

            // Approve VaultRelayer
            const tx = await tokenContract.approve(
                VAULT_RELAYER,
                approvalAmount
            );

            console.log('Approval transaction sent:', tx.hash);
            console.log(`Approving ${infinite ? 'infinite' : amount} for VaultRelayer: ${VAULT_RELAYER}`);

            // Wait for confirmation
            const receipt = await tx.wait();

            console.log('Approval confirmed:', receipt.hash);

            return {
                success: true,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error: any) {
            console.error('Error approving token:', error);

            // Handle user rejection
            if (error.code === 4001 || error.code === 'ACTION_REJECTED' || (error.info && error.info.error && error.info.error.code === 4001)) {
                throw new Error('User rejected the approval transaction');
            }

            throw new Error(`Token approval failed: ${error.message}`);
        }
    }
}
