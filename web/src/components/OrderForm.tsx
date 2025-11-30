import React, { useState, useEffect } from 'react';
import { useCowSdk } from '../hooks/useCowSdk';
import { type Token } from '../constants/tokens';
import { TokenSelectorModal } from './TokenSelectorModal';
import { LimitOrder } from './LimitOrder';
import { ethers } from 'ethers';
import { ApprovalButton } from './ApprovalButton';
import { useTokenApproval } from '../hooks/useTokenApproval';
import { WethService } from '../services/wethService';
import { swapApi } from '../api/swapApi';

interface OrderFormProps {
    cowSdk: ReturnType<typeof useCowSdk>;
    selectedChainId: number;
    onNetworkChange?: (chainId: number) => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({ cowSdk, selectedChainId, onNetworkChange }) => {
    const { getQuote, placeOrder, sdk } = cowSdk;
    const [sellToken, setSellToken] = useState<Token | null>(() => {
        // Restore from localStorage on mount
        const saved = localStorage.getItem('alphaswap_sellToken');
        return saved ? JSON.parse(saved) : null;
    });
    const [buyToken, setBuyToken] = useState<Token | null>(() => {
        // Restore from localStorage on mount
        const saved = localStorage.getItem('alphaswap_buyToken');
        return saved ? JSON.parse(saved) : null;
    });
    const [amount, setAmount] = useState('');
    const [debouncedAmount, setDebouncedAmount] = useState(amount);
    const [quote, setQuote] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [orderStatus, setOrderStatus] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'sell' | 'buy'>('sell');
    const [wrapTxHash, setWrapTxHash] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'swap' | 'limit'>('swap');

    const [isApproved, setIsApproved] = useState(false);
    const [sellBalance, setSellBalance] = useState<string>('0');
    const [buyBalance, setBuyBalance] = useState<string>('0');

    const { getBalance } = useTokenApproval(cowSdk.provider, cowSdk.signer, cowSdk.account);

    // Reset approval state when token changes
    useEffect(() => {
        setIsApproved(false);
    }, [sellToken?.address]);

    const handleApprovalComplete = () => {
        setIsApproved(true);
    };

    // Fetch balances
    useEffect(() => {
        const fetchBalances = async () => {
            // Only fetch balances if wallet is connected to the same network as selected tokens
            const walletChainId = cowSdk.chainId;
            const walletOnSelectedNetwork = walletChainId === selectedChainId;

            if (sellToken && cowSdk.account && walletOnSelectedNetwork) {
                try {
                    const balance = await getBalance(sellToken.address);
                    setSellBalance(balance.formatted);
                } catch (e) {
                    console.error('Error fetching sell token balance:', e);
                    setSellBalance('0');
                }
            } else {
                setSellBalance('0');
            }

            if (buyToken && cowSdk.account && walletOnSelectedNetwork) {
                try {
                    const balance = await getBalance(buyToken.address);
                    setBuyBalance(balance.formatted);
                } catch (e) {
                    console.error('Error fetching buy token balance:', e);
                    setBuyBalance('0');
                }
            } else {
                setBuyBalance('0');
            }
        };

        fetchBalances();
        // Refresh balances periodically
        const interval = setInterval(fetchBalances, 10000);
        return () => clearInterval(interval);
    }, [sellToken, buyToken, cowSdk.account, cowSdk.chainId, selectedChainId, getBalance]);

    // Persist tokens to localStorage whenever they change
    useEffect(() => {
        if (sellToken) {
            localStorage.setItem('alphaswap_sellToken', JSON.stringify(sellToken));
        } else {
            localStorage.removeItem('alphaswap_sellToken');
        }
    }, [sellToken]);

    useEffect(() => {
        if (buyToken) {
            localStorage.setItem('alphaswap_buyToken', JSON.stringify(buyToken));
        } else {
            localStorage.removeItem('alphaswap_buyToken');
        }
    }, [buyToken]);

    // Debounce amount
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedAmount(amount);
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [amount]);

    // Helper functions for wrap detection
    const isNativeEth = (addr: string) => addr.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const isWeth = (addr: string, chainId: number) => {
        const wethAddresses: { [key: number]: string } = {
            1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            11155111: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
            100: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
            42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
            8453: '0x4200000000000000000000000000000000000006',
        };
        return addr.toLowerCase() === wethAddresses[chainId]?.toLowerCase();
    };

    const getWrapScenario = (): 'wrap' | 'unwrap' | null => {
        if (!sellToken || !buyToken) return null;
        if (isNativeEth(sellToken.address) && isWeth(buyToken.address, selectedChainId)) return 'wrap';
        if (isWeth(sellToken.address, selectedChainId) && isNativeEth(buyToken.address)) return 'unwrap';
        return null;
    };

    const fetchQuote = async (isRefresh = false) => {
        // We can fetch quote even if sdk is not initialized (wallet not connected)
        if (!sellToken || !buyToken || !debouncedAmount || parseFloat(debouncedAmount) === 0) {
            setQuote(null);
            return;
        }

        // Skip quote fetching for wrap/unwrap scenarios
        if (getWrapScenario()) {
            setQuote(null);
            return;
        }

        if (!isRefresh) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        setError(null);

        try {
            const sellDecimals = sellToken.decimals;
            const buyDecimals = buyToken.decimals;
            const q = await getQuote(
                sellToken.address,
                buyToken.address,
                debouncedAmount,
                'sell',
                sellDecimals,
                buyDecimals,
                selectedChainId // Pass selectedChainId to use navbar network
            );
            setQuote(q);
        } catch (err: any) {
            console.error(err);
            // Only show error if it's not a refresh (to avoid annoying popups) or if it's a critical error
            if (!isRefresh) {
                setError(err.message || 'Failed to fetch quote');
                setQuote(null);
            }
        } finally {
            if (!isRefresh) {
                setLoading(false);
            } else {
                setRefreshing(false);
            }
        }
    };

    // Auto-fetch quote when dependencies change
    useEffect(() => {
        // Don't fetch quote if order is in progress
        if (orderId && orderStatus && !['fulfilled', 'cancelled', 'expired'].includes(orderStatus)) {
            return;
        }
        fetchQuote();
    }, [sdk, sellToken, buyToken, debouncedAmount, orderId, orderStatus]);

    // Auto-refresh quote every 20 seconds
    useEffect(() => {
        if (!quote) return;

        // Don't refresh quote if order is in progress
        if (orderId && orderStatus && !['fulfilled', 'cancelled', 'expired'].includes(orderStatus)) {
            return;
        }

        const interval = setInterval(() => {
            fetchQuote(true);
        }, 20000);

        return () => clearInterval(interval);
    }, [quote, sdk, sellToken, buyToken, debouncedAmount, orderId, orderStatus]);

    // Poll order status
    useEffect(() => {
        if (!orderId || !selectedChainId) return;

        const pollStatus = async () => {
            try {
                const status = await swapApi.getOrderStatus(orderId, selectedChainId);
                setOrderStatus(status.status);

                // Stop polling and reset if order is fulfilled, cancelled, or expired
                if (['fulfilled', 'cancelled', 'expired'].includes(status.status)) {
                    // Wait 3 seconds to show the final status, then reset
                    setTimeout(() => {
                        setOrderId(null);
                        setOrderStatus(null);
                        setQuote(null);
                        setAmount('');
                    }, 3000);
                    return true; // Stop polling
                }
            } catch (error) {
                console.error('Error polling order status:', error);
            }
            return false; // Continue polling
        };

        // Initial check
        pollStatus();

        const interval = setInterval(async () => {
            const shouldStop = await pollStatus();
            if (shouldStop) {
                clearInterval(interval);
            }
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [orderId, selectedChainId]);

    // Preserve tokens when network changes
    useEffect(() => {
        const preserveTokensOnNetworkSwitch = async () => {
            if (!selectedChainId) return;

            // Store current symbols
            const sellSymbol = sellToken?.symbol;
            const buySymbol = buyToken?.symbol;

            // If no tokens selected, nothing to preserve
            if (!sellSymbol && !buySymbol) return;

            // Check if tokens are already on the correct network
            if (sellToken?.chainId === selectedChainId && buyToken?.chainId === selectedChainId) {
                return;
            }

            try {
                // Fetch tokens for new network
                const response = await fetch(`http://localhost:3000/api/tokens?chainId=${selectedChainId}`);
                const newNetworkTokens = await response.json();

                // Find matching tokens by symbol
                if (sellSymbol && sellToken?.chainId !== selectedChainId) {
                    const matchingSellToken = newNetworkTokens.find((t: any) => t.symbol === sellSymbol);
                    if (matchingSellToken) {
                        setSellToken(matchingSellToken);
                    } else {
                        // Token doesn't exist on new network, clear it
                        setSellToken(null);
                    }
                }

                if (buySymbol && buyToken?.chainId !== selectedChainId) {
                    const matchingBuyToken = newNetworkTokens.find((t: any) => t.symbol === buySymbol);
                    if (matchingBuyToken) {
                        setBuyToken(matchingBuyToken);
                    } else {
                        // Token doesn't exist on new network, clear it
                        setBuyToken(null);
                    }
                }
            } catch (error) {
                console.error('Error preserving tokens on network switch:', error);
            }
        };

        preserveTokensOnNetworkSwitch();
    }, [selectedChainId]); // Only run when selectedChainId changes




    const handlePlaceOrder = async () => {
        if (!quote) return;
        setLoading(true);
        setError(null);
        try {
            const id = await placeOrder(quote);
            setOrderId(id);
        } catch (err: any) {
            console.error(err);
            if (err.code === 4001 || (err.message && err.message.includes('user rejected'))) {
                setError('Transaction rejected by user');
            } else {
                setError(err.message || 'Failed to place order');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleWrap = async () => {
        if (!cowSdk.provider || !cowSdk.signer || !cowSdk.chainId) {
            setError('Please connect your wallet');
            return;
        }

        const wrapScenario = getWrapScenario();
        if (!wrapScenario) return;

        setLoading(true);
        setError(null);
        setWrapTxHash(null);

        try {
            const wethService = new WethService(cowSdk.signer, cowSdk.chainId);
            let txHash: string;

            if (wrapScenario === 'wrap') {
                txHash = await wethService.wrap(debouncedAmount);
            } else {
                txHash = await wethService.unwrap(debouncedAmount);
            }

            setWrapTxHash(txHash);
            // Refresh balances after wrap/unwrap
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (err: any) {
            console.error(err);
            if (err.code === 4001 || (err.message && err.message.includes('user rejected'))) {
                setError('Transaction rejected by user');
            } else {
                setError(err.message || `Failed to ${wrapScenario}`);
            }
        } finally {
            setLoading(false);
        }
    };
    const openModal = (type: 'sell' | 'buy') => {
        setModalType(type);
        setIsModalOpen(true);
    };

    const handleTokenSelect = (token: Token) => {
        // If the selected token is on a different chain than the current one,
        // we should clear the other token to avoid cross-chain confusion
        // Note: The chain switch itself is handled in the modal, so by the time
        // we get here or shortly after, chainId might update.

        // However, if we are just selecting a token and the chain is already correct:
        if (modalType === 'sell') {
            setSellToken(token);
            // If we're switching chains (implied if token.chainId != buyToken.chainId), clear buyToken
            if (buyToken && token.chainId !== buyToken.chainId) {
                setBuyToken(null);
            }
        } else {
            setBuyToken(token);
            // If we're switching chains (implied if token.chainId != sellToken.chainId), clear sellToken
            if (sellToken && token.chainId !== sellToken.chainId) {
                setSellToken(null);
            }
        }
        // Quote will be cleared by the useEffect dependency change
        setIsModalOpen(false);
    };

    return (
        <div className="glass-card">
            {isModalOpen ? (
                <TokenSelectorModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSelect={handleTokenSelect}
                    connectedChainId={selectedChainId}
                    selectedTokenChainId={modalType === 'sell' ? sellToken?.chainId : buyToken?.chainId}
                    onNetworkChange={onNetworkChange}
                />
            ) : (
                <>
                    <div className="tabs-header" style={{ display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                        <button
                            className={`tab-button ${activeTab === 'swap' ? 'active' : ''}`}
                            onClick={() => setActiveTab('swap')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: activeTab === 'swap' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                fontWeight: activeTab === 'swap' ? 600 : 400,
                                cursor: 'pointer',
                                padding: '0 4px',
                                fontSize: '16px'
                            }}
                        >
                            Swap
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'limit' ? 'active' : ''}`}
                            onClick={() => setActiveTab('limit')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: activeTab === 'limit' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                fontWeight: activeTab === 'limit' ? 600 : 400,
                                cursor: 'pointer',
                                padding: '0 4px',
                                fontSize: '16px'
                            }}
                        >
                            Limit
                        </button>
                    </div>

                    {activeTab === 'limit' ? (
                        <LimitOrder
                            cowSdk={cowSdk}
                            selectedChainId={selectedChainId}
                            onNetworkChange={onNetworkChange}
                        />
                    ) : (
                        <>
                            <div className="order-form-header">
                                <h3 style={{ margin: 0, fontWeight: 500 }}>Swap</h3>
                                <div className="settings-icon" style={{ cursor: 'pointer', opacity: 0.7 }}>⚙️</div>
                            </div>


                            <div className="input-container">
                                <div className="input-row">
                                    <input
                                        type="text"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0"
                                        className="amount-input"
                                    />
                                    <button
                                        className="token-select"
                                        onClick={() => openModal('sell')}
                                    >
                                        {sellToken ? (
                                            <>
                                                <span className="token-icon-small">
                                                    {sellToken.logoURI ? <img src={sellToken.logoURI} alt={sellToken.symbol} /> : '🪙'}
                                                </span>
                                                {sellToken.symbol}
                                            </>
                                        ) : (
                                            'Select Token'
                                        )}
                                        <span className="dropdown-arrow">▼</span>
                                    </button>
                                </div>
                                <div className="balance-row">
                                    <span>Balance: {parseFloat(sellBalance).toFixed(4)}</span>
                                </div>
                            </div>

                            <div className="arrow-container">
                                {refreshing ? (
                                    <div className="refresh-spinner">
                                        <img src="/alphaswap_logo_v2.svg" alt="Refreshing..." />
                                    </div>
                                ) : (
                                    <div className="arrow-icon">↓</div>
                                )}
                            </div>

                            <div className="input-container">
                                <div className="input-row">
                                    <input
                                        type="text"
                                        value={(() => {
                                            const wrapScenario = getWrapScenario();
                                            if (wrapScenario && debouncedAmount && parseFloat(debouncedAmount) > 0) {
                                                // For wrap/unwrap, show 1:1 conversion
                                                return debouncedAmount;
                                            }
                                            if (quote && buyToken) {
                                                return parseFloat(ethers.formatUnits(quote.quote.buyAmount, buyToken.decimals)).toFixed(6).replace(/\.?0+$/, '');
                                            }
                                            return '';
                                        })()}
                                        readOnly
                                        placeholder="0.0"
                                        className="amount-input"
                                    />
                                    <button
                                        className="token-select"
                                        onClick={() => openModal('buy')}
                                    >
                                        {buyToken ? (
                                            <>
                                                <span className="token-icon-small">
                                                    {buyToken.logoURI ? <img src={buyToken.logoURI} alt={buyToken.symbol} /> : '🪙'}
                                                </span>
                                                {buyToken.symbol}
                                            </>
                                        ) : (
                                            'Select Token'
                                        )}
                                        <span className="dropdown-arrow">▼</span>
                                    </button>
                                </div>
                                <div className="balance-row">
                                    <span>Balance: {parseFloat(buyBalance).toFixed(4)}</span>
                                </div>
                            </div>

                            {quote && sellToken && buyToken && (
                                <div className="quote-details-section">
                                    <div className="detail-row main-receive-row">
                                        <span className="detail-label">Receive (incl. fees) ⓘ</span>
                                        <span className="detail-value">
                                            {parseFloat(ethers.formatUnits(quote.quote.buyAmount, buyToken.decimals)).toFixed(4)} {buyToken.symbol}
                                        </span>
                                    </div>

                                    <div className="detail-row exchange-rate-row">
                                        <span className="detail-label">1 {sellToken.symbol} = {
                                            (parseFloat(ethers.formatUnits(quote.quote.buyAmount, buyToken.decimals)) /
                                                parseFloat(ethers.formatUnits(quote.quote.sellAmount, sellToken.decimals))).toFixed(4)
                                        } {buyToken.symbol}</span>
                                    </div>

                                    <div className="fee-details-group">
                                        <div className="detail-row fee-row">
                                            <div className="fee-label-container">
                                                <div className="fee-bullet"></div>
                                                <span className="detail-label">Protocol fee (0.02%) ⓘ</span>
                                            </div>
                                            <span className="detail-value">
                                                {(parseFloat(ethers.formatUnits(quote.quote.sellAmount, sellToken.decimals)) * 0.0002).toFixed(8)} {sellToken.symbol}
                                            </span>
                                        </div>

                                        <div className="detail-row fee-row">
                                            <div className="fee-label-container">
                                                <div className="fee-bullet"></div>
                                                <span className="detail-label">Network costs (est.) ⓘ</span>
                                            </div>
                                            <span className="detail-value">
                                                {parseFloat(ethers.formatUnits(quote.quote.feeAmount, sellToken.decimals)).toFixed(8)} {sellToken.symbol}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="detail-row slippage-row">
                                        <span className="detail-label">Slippage tolerance (dynamic) ⓘ</span>
                                        <span className="detail-value">
                                            {(() => {
                                                const slippage = cowSdk?.chainId === 11155111 ? 1.00 : 0.50;
                                                return `${slippage.toFixed(2)}%`;
                                            })()}
                                        </span>
                                    </div>

                                    <div className="detail-row detail-highlight">
                                        <span className="detail-label">= Minimum receive</span>
                                        <span className="detail-value">
                                            {(() => {
                                                const slippage = cowSdk?.chainId === 11155111 ? 0.01 : 0.005;
                                                return (parseFloat(ethers.formatUnits(quote.quote.buyAmount, buyToken.decimals)) * (1 - slippage)).toFixed(8);
                                            })()} {buyToken.symbol}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {error && <div className="error-banner">{error}</div>}

                            <div className="actions">
                                {(() => {
                                    const wrapScenario = getWrapScenario();

                                    if (wrapScenario) {
                                        // Wrap/Unwrap button
                                        return (
                                            <button
                                                onClick={handleWrap}
                                                disabled={loading || !sdk || !debouncedAmount || parseFloat(debouncedAmount) === 0}
                                                className="btn-primary"
                                            >
                                                {loading ? `${wrapScenario === 'wrap' ? 'Wrapping' : 'Unwrapping'}...` : (wrapScenario === 'wrap' ? 'Wrap' : 'Unwrap')}
                                            </button>
                                        );
                                    }

                                    // Normal swap flow
                                    return (
                                        <>
                                            {quote && sellToken && !isApproved && (
                                                <ApprovalButton
                                                    provider={cowSdk.provider}
                                                    signer={cowSdk.signer}
                                                    userAddress={cowSdk.account}
                                                    tokenAddress={sellToken.address}
                                                    amount={ethers.parseUnits(debouncedAmount, sellToken.decimals).toString()}
                                                    onApprovalComplete={handleApprovalComplete}
                                                    tokenSymbol={sellToken.symbol}
                                                />
                                            )}

                                            <button
                                                onClick={handlePlaceOrder}
                                                disabled={loading || !quote || !sdk || !isApproved || !!(orderId && orderStatus && !['fulfilled', 'cancelled', 'expired'].includes(orderStatus))}
                                                className="btn-primary"
                                                title={!isApproved ? "Please approve token first" : (orderId && orderStatus && !['fulfilled', 'cancelled', 'expired'].includes(orderStatus)) ? "Order in progress..." : ""}
                                            >
                                                {orderId && orderStatus && !['fulfilled', 'cancelled', 'expired'].includes(orderStatus)
                                                    ? 'Order Processing...'
                                                    : loading ? (quote ? 'Swapping...' : 'Fetching Quote...') : (quote ? 'Swap' : 'Enter Amount')}
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>

                            {wrapTxHash && (
                                <div className="success-message">
                                    Transaction Successful! <br />
                                    <a
                                        href={`https://etherscan.io/tx/${wrapTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'inherit', fontSize: '12px', textDecoration: 'underline' }}
                                    >
                                        View on Etherscan
                                    </a>
                                </div>
                            )}

                            {orderId && (
                                <div className="success-message">
                                    <div style={{ marginBottom: '8px' }}>
                                        {orderStatus === 'fulfilled' ? '✅ Order Filled!' :
                                            orderStatus === 'cancelled' ? '❌ Order Cancelled' :
                                                orderStatus === 'expired' ? '⚠️ Order Expired' :
                                                    '⏳ Processing Order...'}
                                    </div>
                                    <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>
                                        Status: <span style={{ textTransform: 'capitalize' }}>{orderStatus || 'Pending'}</span>
                                    </div>
                                    <a
                                        href={`${import.meta.env.VITE_COW_EXPLORER_URL || 'https://explorer.cow.fi/sepolia/orders/'}${orderId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'inherit', fontSize: '12px', textDecoration: 'underline' }}
                                    >
                                        View on CoW Explorer
                                    </a>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
};
