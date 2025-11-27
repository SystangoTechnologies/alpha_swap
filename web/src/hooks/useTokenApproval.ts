import { useState, useCallback, useEffect } from 'react';
import { TokenApprovalManager, type ApprovalTransactionResult, type ApprovalResult, type BalanceResult } from '../utils/tokenApproval';
export type { ApprovalTransactionResult, ApprovalResult, BalanceResult };
import { type Provider, type Signer } from 'ethers';

export interface UseTokenApprovalResult {
    checkApproval: (tokenAddress: string, amount: string) => Promise<ApprovalResult>;
    approve: (tokenAddress: string, amount: string, infinite?: boolean) => Promise<ApprovalTransactionResult>;
    getBalance: (tokenAddress: string) => Promise<BalanceResult>;
    isChecking: boolean;
    isApproving: boolean;
}

export function useTokenApproval(provider: Provider | null, signer: Signer | null, userAddress: string | null): UseTokenApprovalResult {
    const [approvalManager, setApprovalManager] = useState<TokenApprovalManager | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    useEffect(() => {
        if (provider && signer) {
            setApprovalManager(new TokenApprovalManager(provider, signer));
        } else {
            setApprovalManager(null);
        }
    }, [provider, signer]);

    /**
     * Check if approval is needed
     */
    const checkApproval = useCallback(async (tokenAddress: string, amount: string): Promise<ApprovalResult> => {
        if (!approvalManager || !userAddress) {
            console.warn('Approval manager or user address not ready yet');
            return { hasAllowance: false, currentAllowance: '0', requiredAmount: amount };
        }

        if (!tokenAddress || !amount) {
            console.warn('Token address or amount not provided');
            return { hasAllowance: false, currentAllowance: '0', requiredAmount: amount };
        }

        setIsChecking(true);
        try {
            const result = await approvalManager.checkAllowance(
                tokenAddress,
                userAddress,
                amount
            );
            return result;
        } finally {
            setIsChecking(false);
        }
    }, [approvalManager, userAddress]);

    /**
     * Request approval
     */
    const approve = useCallback(async (tokenAddress: string, amount: string, infinite = true): Promise<ApprovalTransactionResult> => {
        if (!approvalManager) {
            throw new Error('Approval manager not initialized');
        }

        setIsApproving(true);
        try {
            const result = await approvalManager.approveToken(
                tokenAddress,
                amount,
                infinite
            );
            return result;
        } finally {
            setIsApproving(false);
        }
    }, [approvalManager]);

    /**
     * Get token balance
     */
    const getBalance = useCallback(async (tokenAddress: string): Promise<BalanceResult> => {
        if (!approvalManager || !userAddress) {
            // Return zero balance if not initialized instead of throwing
            return {
                balance: '0',
                decimals: 18,
                symbol: 'UNKNOWN',
                formatted: '0'
            };
        }

        return await approvalManager.getTokenBalance(tokenAddress, userAddress);
    }, [approvalManager, userAddress]);

    return {
        checkApproval,
        approve,
        getBalance,
        isChecking,
        isApproving
    };
}
