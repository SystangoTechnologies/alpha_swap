import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useCowSdk } from '../hooks/useCowSdk';
import { type Token } from '../constants/tokens';
import { TokenSelectorModal } from './TokenSelectorModal';
import { ApprovalButton } from './ApprovalButton';
import { useTokenApproval } from '../hooks/useTokenApproval';

interface LimitOrderProps {
    cowSdk: ReturnType<typeof useCowSdk>;
    selectedChainId: number;
    onNetworkChange?: (chainId: number) => void;
}

export const LimitOrder: React.FC<LimitOrderProps> = ({ cowSdk, selectedChainId, onNetworkChange }) => {
    const { createLimitOrder, getQuote } = cowSdk;

    // State
    const [sellToken, setSellToken] = useState<Token | null>(null);
    const [buyToken, setBuyToken] = useState<Token | null>(null);
    const [sellAmount, setSellAmount] = useState('');
    const [buyAmount, setBuyAmount] = useState('');
    const [validFor, setValidFor] = useState('10080'); // 7 days in minutes
    const [partiallyFillable, setPartiallyFillable] = useState(false);

    const [marketPrice, setMarketPrice] = useState<number | null>(null);
    const [limitPrice, setLimitPrice] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'sell' | 'buy'>('sell');

    const [isApproved, setIsApproved] = useState(false);
    const [sellBalance, setSellBalance] = useState<string>('0');

    const { getBalance } = useTokenApproval(cowSdk.provider, cowSdk.signer, cowSdk.account);

    // Load saved tokens
    useEffect(() => {
        const savedSell = localStorage.getItem('alphaswap_limit_sellToken');
        const savedBuy = localStorage.getItem('alphaswap_limit_buyToken');
        if (savedSell) setSellToken(JSON.parse(savedSell));
        if (savedBuy) setBuyToken(JSON.parse(savedBuy));
    }, []);

    // Save tokens
    useEffect(() => {
        if (sellToken) localStorage.setItem('alphaswap_limit_sellToken', JSON.stringify(sellToken));
        if (buyToken) localStorage.setItem('alphaswap_limit_buyToken', JSON.stringify(buyToken));
    }, [sellToken, buyToken]);

    // Reset approval when token changes
    useEffect(() => {
        setIsApproved(false);
    }, [sellToken?.address]);

    // Fetch balance
    useEffect(() => {
        const fetchBalance = async () => {
            if (sellToken && cowSdk.account && cowSdk.chainId === selectedChainId) {
                try {
                    const balance = await getBalance(sellToken.address);
                    setSellBalance(balance.formatted);
                } catch (e) {
                    console.error('Error fetching balance:', e);
                    setSellBalance('0');
                }
            } else {
                setSellBalance('0');
            }
        };
        fetchBalance();
        const interval = setInterval(fetchBalance, 10000);
        return () => clearInterval(interval);
    }, [sellToken, cowSdk.account, cowSdk.chainId, selectedChainId, getBalance]);

    // Update Limit Price when Sell/Buy amounts change (if not editing price directly)
    // We only want to do this if the user is explicitly editing the BUY amount.
    // If they edit SELL amount, we want to keep PRICE constant and update BUY amount.
    // So we should remove this effect that blindly updates price from amounts, 
    // and instead handle it in the change handlers.

    /* 
    useEffect(() => {
        if (sellAmount && buyAmount && parseFloat(sellAmount) > 0) {
            const sell = parseFloat(sellAmount);
            const buy = parseFloat(buyAmount);
            const price = buy / sell;
            if (!limitPrice || Math.abs(parseFloat(limitPrice) - price) > 0.000001) {
                 setLimitPrice(price.toFixed(6));
            }
        }
    }, [sellAmount, buyAmount]); 
    */

    // Fetch market price
    useEffect(() => {
        const fetchMarketPrice = async () => {
            if (sellToken && buyToken && sellAmount && parseFloat(sellAmount) > 0) {
                try {
                    const quote = await getQuote(
                        sellToken.address,
                        buyToken.address,
                        sellAmount,
                        'sell',
                        sellToken.decimals,
                        buyToken.decimals,
                        selectedChainId
                    );

                    if (quote && quote.quote) {
                        const buyAmountFromQuote = ethers.formatUnits(quote.quote.buyAmount, buyToken.decimals);
                        const marketRate = parseFloat(buyAmountFromQuote) / parseFloat(sellAmount);
                        setMarketPrice(marketRate);

                        // Auto-fill limit price if not set, or update buy amount if we have a limit price
                        if (!limitPrice) {
                            setLimitPrice(marketRate.toFixed(6));
                            setBuyAmount(buyAmountFromQuote);
                        } else {
                            // If limit price is already set, recalculate buy amount based on new sell amount (handled in handleSellAmountChange, but good to ensure consistency here if needed, though handleSellAmountChange drives it)
                            // Actually, if we are just fetching market price because sellAmount changed, we might want to update buyAmount if the user hasn't locked in a custom buy amount? 
                            // For now, let's stick to: if limitPrice is set, we respect it.
                        }
                    }
                } catch (e) {
                    console.error('Error fetching market price:', e);
                }
            } else {
                setMarketPrice(null);
            }
        };

        const debounce = setTimeout(fetchMarketPrice, 500);
        return () => clearTimeout(debounce);
    }, [sellAmount, sellToken, buyToken, selectedChainId, getQuote]); // Removed limitPrice from dependency to avoid loops

    const handleLimitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPrice = e.target.value;
        setLimitPrice(newPrice);

        if (newPrice && !isNaN(parseFloat(newPrice)) && sellAmount && !isNaN(parseFloat(sellAmount))) {
            const newBuyAmount = (parseFloat(sellAmount) * parseFloat(newPrice)).toFixed(6);
            setBuyAmount(newBuyAmount);
        }
    };

    const handleSellAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSellAmount = e.target.value;
        setSellAmount(newSellAmount);

        if (newSellAmount && !isNaN(parseFloat(newSellAmount)) && limitPrice && !isNaN(parseFloat(limitPrice))) {
            const newBuyAmount = (parseFloat(newSellAmount) * parseFloat(limitPrice)).toFixed(6);
            setBuyAmount(newBuyAmount);
        }
    };

    const handleBuyAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newBuyAmount = e.target.value;
        setBuyAmount(newBuyAmount);

        if (newBuyAmount && !isNaN(parseFloat(newBuyAmount)) && sellAmount && !isNaN(parseFloat(sellAmount)) && parseFloat(sellAmount) > 0) {
            const newPrice = (parseFloat(newBuyAmount) / parseFloat(sellAmount)).toFixed(6);
            setLimitPrice(newPrice);
        }
    };

    const handleApprovalComplete = () => {
        setIsApproved(true);
    };

    const handleCreateOrder = async () => {
        if (!sellToken || !buyToken || !sellAmount || !buyAmount || !cowSdk.signer) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const atomicSellAmount = ethers.parseUnits(sellAmount, sellToken.decimals).toString();
            const atomicBuyAmount = ethers.parseUnits(buyAmount, buyToken.decimals).toString();

            const orderId = await createLimitOrder({
                sellToken: sellToken.address,
                buyToken: buyToken.address,
                sellAmount: atomicSellAmount,
                buyAmount: atomicBuyAmount,
                validFor: parseInt(validFor) * 60, // Convert minutes to seconds
                partiallyFillable
            });

            const price = (parseFloat(buyAmount) / parseFloat(sellAmount)).toFixed(6);
            const expiresAt = new Date(Date.now() + parseInt(validFor) * 60 * 1000).toLocaleString();

            setResult({
                success: true,
                orderId,
                price,
                expiresAt
            });

            // Clear form
            setSellAmount('');
            setBuyAmount('');
        } catch (err: any) {
            console.error('Limit order error:', err);
            setError(err.message || 'Failed to create limit order');
        } finally {
            setLoading(false);
        }
    };

    const openModal = (type: 'sell' | 'buy') => {
        setModalType(type);
        setIsModalOpen(true);
    };

    const handleTokenSelect = (token: Token) => {
        if (modalType === 'sell') {
            setSellToken(token);
            if (buyToken && token.chainId !== buyToken.chainId) setBuyToken(null);
        } else {
            setBuyToken(token);
            if (sellToken && token.chainId !== sellToken.chainId) setSellToken(null);
        }
        setIsModalOpen(false);
    };

    const expirationOptions = [
        { value: '10080', label: '7 Days' },
        { value: '43200', label: '30 Days' },
        { value: '129600', label: '90 Days' },
        { value: '525600', label: '1 Year' }
    ];

    return (
        <div className="limit-order-container">
            {isModalOpen && (
                <TokenSelectorModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSelect={handleTokenSelect}
                    connectedChainId={selectedChainId}
                    selectedTokenChainId={modalType === 'sell' ? sellToken?.chainId : buyToken?.chainId}
                    onNetworkChange={onNetworkChange}
                />
            )}

            <div className="order-form-header">
                <h3 style={{ margin: 0, fontWeight: 500 }}>Limit Order</h3>
                <div className="settings-icon" style={{ cursor: 'pointer', opacity: 0.7 }}>⚙️</div>
            </div>

            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '20px', marginTop: '4px' }}>
                Place orders at a specific price.
            </p>

            {/* Sell Section */}
            <div className="input-container">
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Sell</div>
                <div className="input-row">
                    <input
                        type="text"
                        value={sellAmount}
                        onChange={handleSellAmountChange}
                        placeholder="0"
                        className="amount-input"
                    />
                    <button className="token-select" onClick={() => openModal('sell')}>
                        {sellToken ? (
                            <>
                                <span className="token-icon-small">
                                    {sellToken.logoURI ? <img src={sellToken.logoURI} alt={sellToken.symbol} /> : '🪙'}
                                </span>
                                {sellToken.symbol}
                            </>
                        ) : 'Select Token'}
                        <span className="dropdown-arrow">▼</span>
                    </button>
                </div>
                <div className="balance-row">
                    <span>Balance: {parseFloat(sellBalance).toFixed(4)}</span>
                </div>
            </div>

            <div className="arrow-container">
                <div className="arrow-icon">↓</div>
            </div>

            {/* Buy Section */}
            <div className="input-container">
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Receive at least</div>
                <div className="input-row">
                    <input
                        type="text"
                        value={buyAmount}
                        onChange={handleBuyAmountChange}
                        placeholder="0"
                        className="amount-input"
                    />
                    <button className="token-select" onClick={() => openModal('buy')}>
                        {buyToken ? (
                            <>
                                <span className="token-icon-small">
                                    {buyToken.logoURI ? <img src={buyToken.logoURI} alt={buyToken.symbol} /> : '🪙'}
                                </span>
                                {buyToken.symbol}
                            </>
                        ) : 'Select Token'}
                        <span className="dropdown-arrow">▼</span>
                    </button>
                </div>
            </div>

            {/* Price Info Card */}
            {sellToken && buyToken && (
                <div style={{
                    padding: '16px',
                    background: 'var(--color-surface)',
                    borderRadius: '16px',
                    marginBottom: '16px',
                    border: '1px solid transparent'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>When 1 {sellToken.symbol} is worth</span>
                            {marketPrice && limitPrice && (
                                <span style={{
                                    color: parseFloat(limitPrice) > marketPrice ? '#4caf50' : '#ff3b30',
                                    fontWeight: 500
                                }}>
                                    ({((parseFloat(limitPrice) - marketPrice) / marketPrice * 100).toFixed(2)}%)
                                </span>
                            )}
                        </div>
                        <div>
                            Market: <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>{marketPrice ? marketPrice.toFixed(4) : '-'}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <input
                            type="text"
                            value={limitPrice}
                            onChange={handleLimitPriceChange}
                            placeholder="0"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: '24px',
                                fontWeight: 500,
                                color: 'var(--color-text)',
                                width: '100%',
                                outline: 'none'
                            }}
                        />
                        <div style={{
                            background: 'rgba(0, 0, 0, 0.05)',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            {buyToken.logoURI && <img src={buyToken.logoURI} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />}
                            {buyToken.symbol}
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        <div>≈ {limitPrice ? (parseFloat(limitPrice) * 1).toFixed(4) : '0'} {buyToken.symbol}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            Est. partial fill price <span style={{ fontSize: '10px' }}>❓</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Order expires in</label>
                </div>

                <select
                    value={validFor}
                    onChange={(e) => setValidFor(e.target.value)}
                    style={{
                        padding: '4px 8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text)',
                        outline: 'none',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'right'
                    }}
                >
                    {expirationOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    Limit price <span style={{ cursor: 'pointer' }}>🔄</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                    {sellToken && buyToken && limitPrice ? `1 ${sellToken.symbol} = ${limitPrice} ${buyToken.symbol}` : '-'}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    Protocol fee (0.02%) <span style={{ cursor: 'pointer' }}>ℹ️</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                    0.000278 {buyToken?.symbol || 'USDC'} (≈ $&lt; 0.01)
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                        type="checkbox"
                        checked={partiallyFillable}
                        onChange={(e) => setPartiallyFillable(e.target.checked)}
                        style={{ accentColor: 'var(--primary-color)' }}
                    />
                    Partially Fillable
                </label>
            </div>

            {/* Actions */}
            <div className="actions">
                {sellToken && sellAmount && !isApproved && (
                    <ApprovalButton
                        provider={cowSdk.provider}
                        signer={cowSdk.signer}
                        userAddress={cowSdk.account}
                        tokenAddress={sellToken.address}
                        amount={ethers.parseUnits(sellAmount, sellToken.decimals).toString()}
                        onApprovalComplete={handleApprovalComplete}
                        tokenSymbol={sellToken.symbol}
                    />
                )}

                <button
                    className="btn-primary"
                    onClick={handleCreateOrder}
                    disabled={!cowSdk.account || loading || !isApproved || !sellAmount || !buyAmount}
                    title={!isApproved ? "Please approve token first" : ""}
                >
                    {loading ? 'Creating Order...' : 'Review limit order'}
                </button>
            </div>

            {/* Result */}
            {result && (
                <div className="success-message" style={{ marginTop: '16px' }}>
                    <div>✅ Limit Order Created!</div>
                    <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                        Price: {result.price} <br />
                        Expires: {result.expiresAt}
                    </div>
                    <a
                        href={`${import.meta.env.VITE_COW_EXPLORER_URL || 'https://explorer.cow.fi/sepolia/orders/'}${result.orderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', fontSize: '12px', textDecoration: 'underline', display: 'block', marginTop: '8px' }}
                    >
                        View on CoW Explorer
                    </a>
                </div>
            )}

            {error && <div className="error-banner" style={{ marginTop: '16px' }}>{error}</div>}
        </div>
    );
};
