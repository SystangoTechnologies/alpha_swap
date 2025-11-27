import React, { useState, useMemo, useEffect } from 'react';
import { type Token } from '../constants/tokens';

interface Chain {
    chainId: number;
    name: string;
    icon: string;
}

interface TokenSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (token: Token) => void;
    connectedChainId: number | null; // Currently selected network from navbar
    selectedTokenChainId?: number; // Chain of the currently selected token (if any)
    onNetworkChange?: (chainId: number) => void; // Callback to update global network
}

// Updated common tokens to match "Favorite tokens"
const FAVORITE_SYMBOLS = ['DAI', 'COW', 'USDC', 'USDT', 'WBTC', 'WETH'];

export const TokenSelectorModal: React.FC<TokenSelectorModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    connectedChainId,
    selectedTokenChainId,
    onNetworkChange
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    // Initialize with selectedTokenChainId if available, otherwise connectedChainId
    const [selectedChainId, setSelectedChainId] = useState<number | null>(selectedTokenChainId || connectedChainId);
    const [chains, setChains] = useState<Chain[]>([]);
    const [tokens, setTokens] = useState<Token[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch supported chains on mount
    useEffect(() => {
        const fetchChains = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/chains');
                const data = await response.json();
                setChains(data);
            } catch (error) {
                console.error('Error fetching chains:', error);
            }
        };
        fetchChains();
    }, []);

    // Auto-select chain when wallet connects or navbar network changes
    useEffect(() => {
        if (connectedChainId) {
            setSelectedChainId(connectedChainId);
        }
    }, [connectedChainId]);

    // Fetch tokens when selected chain changes
    useEffect(() => {
        const fetchTokens = async () => {
            if (!selectedChainId) return;

            setLoading(true);
            try {
                const response = await fetch(`http://localhost:3000/api/tokens?chainId=${selectedChainId}`);
                const data = await response.json();
                setTokens(data);
            } catch (error) {
                console.error('Error fetching tokens:', error);
                setTokens([]);
            } finally {
                setLoading(false);
            }
        };
        fetchTokens();
    }, [selectedChainId]);

    const filteredTokens = useMemo(() => {
        if (!searchQuery) return tokens;
        const lowerQuery = searchQuery.toLowerCase();
        return tokens.filter(token =>
            token.symbol.toLowerCase().includes(lowerQuery) ||
            token.name.toLowerCase().includes(lowerQuery) ||
            token.address.toLowerCase().includes(lowerQuery)
        );
    }, [tokens, searchQuery]);

    const favoriteTokens = useMemo(() => {
        // Find tokens from the full list that match favorite symbols
        return FAVORITE_SYMBOLS.map(symbol => tokens.find(t => t.symbol === symbol)).filter((t): t is Token => !!t);
    }, [tokens]);

    const handleTokenSelect = async (token: Token) => {
        // If token is from a different network than currently selected, update global network
        if (token.chainId && connectedChainId && token.chainId !== connectedChainId && onNetworkChange) {
            onNetworkChange(token.chainId);
        }

        // Select the token
        onSelect(token);
        onClose();
    };

    const selectedChain = chains.find(c => c.chainId === selectedChainId);

    if (!isOpen) return null;

    return (
        <div className="token-selector-container">
            <div className="search-container">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="token-search-input"
                    placeholder="Search name or paste address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                />
                <button className="close-button-inline" onClick={onClose}>✕</button>
            </div>

            <div className="network-selector">
                {chains.map(chain => (
                    <button
                        key={chain.chainId}
                        className={`network-icon ${selectedChainId === chain.chainId ? 'active' : ''}`}
                        title={chain.name}
                        onClick={() => setSelectedChainId(chain.chainId)}
                    >
                        {chain.icon.startsWith('http') ? (
                            <img src={chain.icon} alt={chain.name} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                        ) : (
                            chain.icon
                        )}
                    </button>
                ))}
            </div>

            {favoriteTokens.length > 0 && (
                <div className="common-tokens-section">
                    <div className="section-header">
                        <span className="section-title-text">Favorite tokens</span>
                        <span className="help-icon">?</span>
                    </div>
                    <div className="common-tokens-list">
                        {favoriteTokens.map(token => (
                            <button
                                key={token.address}
                                className="common-token-chip"
                                onClick={() => handleTokenSelect(token)}
                            >
                                <span className="token-icon-small">
                                    {token.logoURI ? <img src={token.logoURI} alt={token.symbol} /> : '🪙'}
                                    <span className="chain-badge-small">
                                        {selectedChain?.icon.startsWith('http') ? (
                                            <img src={selectedChain.icon} alt={selectedChain.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                        ) : (
                                            selectedChain?.icon || '🔷'
                                        )}
                                    </span>
                                </span>
                                {token.symbol}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="token-list-section">
                <div className="token-list">
                    {loading ? (
                        <div className="no-results">Loading tokens...</div>
                    ) : filteredTokens.length > 0 ? (
                        filteredTokens.map(token => (
                            <div
                                key={token.address}
                                className="token-item"
                                onClick={() => handleTokenSelect(token)}
                            >
                                <div className="token-icon-large">
                                    {token.logoURI ? <img src={token.logoURI} alt={token.symbol} /> : '🪙'}
                                    <span className="chain-badge-large">
                                        {selectedChain?.icon.startsWith('http') ? (
                                            <img src={selectedChain.icon} alt={selectedChain.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                        ) : (
                                            selectedChain?.icon || '🔷'
                                        )}
                                    </span>
                                </div>
                                <div className="token-details">
                                    <div className="token-name-row">
                                        <span className="token-symbol-main">{token.symbol}</span>
                                    </div>
                                    <div className="token-symbol-row">
                                        <span className="token-name-sub">{token.name}</span>
                                    </div>
                                </div>
                                <div className="token-balance">
                                    {/* Balance placeholder */}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-results">
                            {selectedChain ?
                                `No tokens available for ${selectedChain.name}` :
                                'No tokens found'
                            }
                        </div>
                    )}
                </div>
            </div>

            <div className="modal-footer">
                <button className="manage-lists-button">
                    <span className="edit-icon">📝</span>
                    Manage Token Lists
                </button>
            </div>
        </div>
    );
};
