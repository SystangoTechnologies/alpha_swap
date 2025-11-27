import React, { useState, useEffect } from 'react';
import { useTokenApproval, type ApprovalTransactionResult } from '../hooks/useTokenApproval';
import { type Provider, type Signer } from 'ethers';

interface ApprovalButtonProps {
    provider: Provider | null;
    signer: Signer | null;
    userAddress: string | null;
    tokenAddress: string;
    amount: string;
    onApprovalComplete?: (result: ApprovalTransactionResult | { alreadyApproved: boolean }) => void;
    tokenSymbol?: string;
}

export const ApprovalButton: React.FC<ApprovalButtonProps> = ({
    provider,
    signer,
    userAddress,
    tokenAddress,
    amount,
    onApprovalComplete,
    tokenSymbol = 'Token'
}) => {
    const { checkApproval, approve, isChecking, isApproving } = useTokenApproval(
        provider,
        signer,
        userAddress
    );

    const [needsApproval, setNeedsApproval] = useState(false);
    const [approvalStatus, setApprovalStatus] = useState<{ success: boolean; message: string; txHash?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Check if all required props are available
    useEffect(() => {
        setIsReady(!!provider && !!signer && !!userAddress && !!tokenAddress && !!amount);
    }, [provider, signer, userAddress, tokenAddress, amount]);

    // Check approval when everything is ready
    useEffect(() => {
        if (!isReady) return;

        const checkNeedsApproval = async () => {
            try {
                setError(null);
                const result = await checkApproval(tokenAddress, amount);
                setNeedsApproval(!result.hasAllowance);
                console.log('Approval check:', {
                    token: tokenAddress,
                    hasAllowance: result.hasAllowance
                });

                // If already approved, notify parent immediately
                if (result.hasAllowance && onApprovalComplete) {
                    console.log('Token already approved, calling onApprovalComplete');
                    onApprovalComplete({ alreadyApproved: true });
                }
            } catch (err: any) {
                console.error('Error checking approval:', err);
                // Only show critical errors
                if (!err.message.includes('not initialized')) {
                    setError(err.message);
                }
            }
        };

        // Add small delay to ensure everything is initialized
        const timeoutId = setTimeout(checkNeedsApproval, 200);
        return () => clearTimeout(timeoutId);
    }, [isReady, tokenAddress, amount, checkApproval]);

    const handleApprove = async () => {
        setError(null);
        setApprovalStatus(null);

        try {
            const result = await approve(tokenAddress, amount, true);

            setApprovalStatus({
                success: true,
                message: 'Token approved successfully!',
                txHash: result.transactionHash
            });

            setNeedsApproval(false);

            if (onApprovalComplete) {
                onApprovalComplete(result);
            }
        } catch (err: any) {
            console.error('Approval error:', err);
            setError(err.message);
            setApprovalStatus({
                success: false,
                message: err.message
            });
        }
    };

    // Show loading state if not ready
    if (!isReady) {
        return (
            <div style={{
                padding: '12px',
                background: 'var(--color-secondary)',
                borderRadius: '8px',
                marginBottom: '16px'
            }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    {!provider || !signer || !userAddress
                        ? '⏳ Connect wallet to check approval status...'
                        : '⏳ Waiting for token information...'
                    }
                </p>
            </div>
        );
    }

    // Show checking state
    if (isChecking) {
        return (
            <div style={{
                padding: '12px',
                background: 'var(--color-secondary)',
                borderRadius: '8px',
                marginBottom: '16px'
            }}>
                <p style={{ margin: 0, fontSize: '14px' }}>
                    ⏳ Checking {tokenSymbol} allowance...
                </p>
            </div>
        );
    }

    // Show approved state
    if (!needsApproval) {
        return (
            <div style={{
                padding: '12px',
                background: 'rgba(76, 175, 80, 0.1)',
                borderRadius: '8px',
                border: '1px solid #4caf50',
                marginBottom: '16px'
            }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#4caf50' }}>
                    ✅ {tokenSymbol} approved
                </p>
            </div>
        );
    }

    // Show approval needed state
    return (
        <div style={{ marginBottom: '16px' }}>
            <div style={{
                padding: '12px',
                background: 'rgba(255, 152, 0, 0.1)',
                borderRadius: '8px',
                border: '1px solid #ff9800',
                marginBottom: '12px'
            }}>
                <p style={{
                    margin: '0 0 8px 0',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#ff9800'
                }}>
                    ⚠️ Approval Required
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    You need to approve {tokenSymbol} before trading. This is a one-time transaction
                    that allows CoW Protocol to access your tokens.
                </p>
            </div>

            <button
                className="btn-primary"
                onClick={handleApprove}
                disabled={isApproving}
                style={{ width: '100%', marginBottom: '12px' }}
            >
                {isApproving ? <><span className="loading"></span> Approving...</> : `Allow CoW Swap to use your ${tokenSymbol}`}
            </button>

            {approvalStatus && (
                <div style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: approvalStatus.success ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                    border: `1px solid ${approvalStatus.success ? '#4caf50' : '#f44336'}`,
                    color: approvalStatus.success ? '#4caf50' : '#f44336'
                }}>
                    {approvalStatus.message}
                    {approvalStatus.txHash && (
                        <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
                            <a
                                href={`https://sepolia.etherscan.io/tx/${approvalStatus.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'inherit', textDecoration: 'underline' }}
                            >
                                View on Etherscan
                            </a>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'rgba(244, 67, 54, 0.1)',
                    border: '1px solid #f44336',
                    color: '#f44336'
                }}>
                    {error}
                </div>
            )}
        </div>
    );
};
