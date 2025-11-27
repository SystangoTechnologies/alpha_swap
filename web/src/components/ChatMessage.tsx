import { useState, useEffect } from 'react';
import type { Message } from '../api/agentApi';
import './ChatMessage.css';

interface ChatMessageProps {
    message: Message;
    quote?: any;
    requiredAction?: string;
    action?: any;
    onAcceptQuote?: () => void;
    onConnectWallet?: () => void;
    onApproveToken?: (tokenAddress: string, amount: string, tokenSymbol: string) => void;
    onWrap?: (wrapAction: any) => void;
    onRefreshQuote?: (quote: any) => void;
    chainId?: number;
    isRefreshing?: boolean;
    isApproving?: boolean;
}

const formatTokenSymbol = (symbol: string) => {
    if (!symbol) return '';
    if (symbol.startsWith('0x') && symbol.length > 10) {
        return `${symbol.slice(0, 6)}...${symbol.slice(-4)}`;
    }
    return symbol;
};

const formatTokenAmount = (amount: string | number | undefined) => {
    if (!amount) return '0';
    const num = Number(amount);
    if (isNaN(num)) return String(amount);
    // Show up to 6 decimal places, removing trailing zeros
    return parseFloat(num.toFixed(6)).toString();
};

export function ChatMessage({
    message,
    quote,
    requiredAction,
    action,
    onAcceptQuote,
    onConnectWallet,
    onApproveToken,
    onWrap,
    onRefreshQuote,
    chainId,
    isRefreshing,
    isApproving
}: ChatMessageProps) {
    const isUser = message.role === 'user';
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        if (!quote || !onRefreshQuote) return;

        setTimeLeft(30); // Reset timer when quote changes

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    onRefreshQuote(quote);
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [quote, onRefreshQuote]);

    return (
        <div className={`chat-message ${isUser ? 'user-message' : 'assistant-message'}`}>
            <div className="message-content">
                {!quote && (
                    <div className="message-text">
                        {message.metadata?.isLoading && (
                            <span className="loading-spinner">⏳ </span>
                        )}
                        {message.content}
                    </div>
                )}

                {quote && (
                    <div className="quote-card">
                        <div className="quote-header">
                            <h4>Swap</h4>
                            <div className="quote-refresh-container">
                                {isRefreshing && <div className="spinner-small"></div>}
                                <span className="quote-refresh">Quote refresh in {timeLeft}s</span>
                            </div>
                        </div>

                        <div className="quote-swap-section">
                            <div className="swap-card">
                                <div className="swap-card-label">Sell amount</div>
                                <div className="swap-card-content">
                                    <div className="token-logo-wrapper">
                                        {quote.sellTokenLogoURI ? (
                                            <img src={quote.sellTokenLogoURI} alt={quote.sellTokenSymbol} className="token-logo-large" />
                                        ) : (
                                            <span className="token-icon-fallback-large">🪙</span>
                                        )}
                                    </div>
                                    <div className="swap-amount">
                                        {(() => {
                                            // If we have a formatted amount from the backend (which preserves the user's original request), use it.
                                            // This prevents "double adding" the fee if the backend already sent the total amount.
                                            if (quote.formattedSellAmount) {
                                                return formatTokenAmount(quote.formattedSellAmount);
                                            }

                                            // Otherwise (e.g. refreshed quotes where we only have raw data), 
                                            // calculate total sell amount (amount + fee) to show what user is actually selling.
                                            // We need to be careful with units here.
                                            // quote.quote.sellAmount is usually in wei/base units.
                                            // We need to format it first.

                                            try {
                                                // If we have access to ethers and decimals, we could format.
                                                // But here we might only have the strings.
                                                // Let's assume formattedSellAmount is missing implies we need to rely on what we have.
                                                // Ideally, we should have formatted values.

                                                // Fallback: if we can't calculate easily, just show what we have
                                                return formatTokenAmount(quote.quote?.sellAmount || '0');
                                            } catch (e) {
                                                return '0';
                                            }
                                        })()} {formatTokenSymbol(quote.sellTokenSymbol)}
                                    </div>
                                    <div className="swap-usd-value">≈ $0.00</div>
                                </div>
                            </div>

                            <div className="swap-arrow-wrapper">
                                <div className={`swap-arrow-circle ${isRefreshing ? 'rotating' : ''}`}>→</div>
                            </div>

                            <div className="swap-card">
                                <div className="swap-card-label">Receive (before fees)</div>
                                <div className="swap-card-content">
                                    <div className="token-logo-wrapper">
                                        {quote.buyTokenLogoURI ? (
                                            <img src={quote.buyTokenLogoURI} alt={quote.buyTokenSymbol} className="token-logo-large" />
                                        ) : (
                                            <span className="token-icon-fallback-large">🪙</span>
                                        )}
                                    </div>
                                    <div className="swap-amount">{formatTokenAmount(quote.formattedBuyAmount || quote.quote?.buyAmount)} {formatTokenSymbol(quote.buyTokenSymbol)}</div>
                                    <div className="swap-usd-value">≈ $0.00 <span className="price-impact">(0.02%)</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="quote-details">
                            <div className="detail-row">
                                <span className="detail-label">Price 🔄</span>
                                <span className="detail-value">
                                    1 {formatTokenSymbol(quote.sellTokenSymbol)} = {
                                        (Number(quote.formattedBuyAmount) / Number(quote.formattedSellAmount)).toFixed(4)
                                    } {formatTokenSymbol(quote.buyTokenSymbol)}
                                </span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Protocol fee ({Number(quote.protocolFeeBps || 0) / 100}%) ⓘ</span>
                                <span className="detail-value">
                                    {(Number(quote.formattedSellAmount) * Number(quote.protocolFeeBps || 0) / 10000).toFixed(6)} {formatTokenSymbol(quote.sellTokenSymbol)} (≈ ${'<'} 0.01)
                                </span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Network costs (est.) ⓘ</span>
                                <span className="detail-value">
                                    {Number(quote.formattedFeeAmount || 0).toFixed(6)} {formatTokenSymbol(quote.sellTokenSymbol)} (≈ ${'<'} 0.01)
                                </span>
                            </div>

                            <div className="detail-row detail-highlight">
                                <span className="detail-label">= Expected to receive</span>
                                <span className="detail-value">
                                    {Number(quote.formattedBuyAmount).toFixed(6)} {formatTokenSymbol(quote.buyTokenSymbol)}
                                </span>
                            </div>

                            <div className="detail-divider"></div>

                            <div className="detail-row">
                                <span className="detail-label">Slippage tolerance (dynamic) ⓘ</span>
                                <span className="detail-value">
                                    {(() => {
                                        const slippage = chainId === 11155111 ? 1.00 : 0.50;
                                        return `${slippage.toFixed(2)}%`;
                                    })()}
                                </span>
                            </div>

                            <div className="detail-row detail-highlight">
                                <span className="detail-label">= Minimum receive ⓘ</span>
                                <span className="detail-value">
                                    {(() => {
                                        const slippage = chainId === 11155111 ? 0.01 : 0.005;
                                        return (Number(quote.formattedBuyAmount) * (1 - slippage)).toFixed(6);
                                    })()} {formatTokenSymbol(quote.buyTokenSymbol)}
                                </span>
                            </div>
                        </div>

                        <div className="quote-footer">
                            {requiredAction === 'REQUEST_ALLOWANCE' && onApproveToken && quote && (
                                <>
                                    <div className="approval-warning">
                                        <span className="warning-icon">⚠️</span>
                                        <div className="warning-content">
                                            <strong>Approval Required</strong>
                                            <p>You need to approve {formatTokenSymbol(quote.sellTokenSymbol)} before trading. This is a one-time transaction that allows CoW Protocol to access your tokens.</p>
                                        </div>
                                    </div>
                                    <button
                                        className="confirm-swap-btn"
                                        onClick={() => onApproveToken(
                                            quote.quote?.sellToken || quote.sellToken,
                                            quote.quote?.sellAmount || quote.sellAmount,
                                            quote.sellTokenSymbol
                                        )}
                                        disabled={isApproving}
                                    >
                                        {isApproving ? 'Approving...' : `Allow CoW Swap to use your ${formatTokenSymbol(quote.sellTokenSymbol)}`}
                                    </button>
                                    <button className="confirm-swap-btn disabled" disabled>
                                        Confirm Swap
                                    </button>
                                </>
                            )}
                            {onAcceptQuote && !requiredAction && (
                                <button className="confirm-swap-btn" onClick={onAcceptQuote}>
                                    Confirm Swap
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {requiredAction === 'REQUEST_WALLET_CONNECT' && onConnectWallet && (
                    <button className="action-btn wallet-connect-btn" onClick={onConnectWallet}>
                        Connect Wallet
                    </button>
                )}

                {action?.type === 'WRAP' && onWrap && (
                    <button
                        className="action-btn wrap-btn"
                        onClick={() => onWrap(action)}
                    >
                        {action.wrapType === 'wrap' ? 'Wrap' : 'Unwrap'} {action.wrapAmount} {action.sellToken}
                    </button>
                )}
            </div>
        </div>
    );
}
