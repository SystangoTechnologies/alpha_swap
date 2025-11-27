import React, { useEffect, useState, useRef } from 'react';

interface NetworkIndicatorProps {
    selectedChainId: number;
    onNetworkChange: (chainId: number) => void;
}

interface Chain {
    chainId: number;
    name: string;
    icon: string;
}

export const NetworkIndicator: React.FC<NetworkIndicatorProps> = ({ selectedChainId, onNetworkChange }) => {
    const [chains, setChains] = useState<Chain[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const selectedNetwork = chains.find(c => c.chainId === selectedChainId) || {
        name: 'Ethereum',
        icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        chainId: 1
    };

    const handleNetworkSelect = (chainId: number) => {
        onNetworkChange(chainId);
        setIsOpen(false);
    };

    return (
        <div className="network-selector-container" ref={dropdownRef}>
            <button
                className="network-indicator"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <span className="network-icon">
                    {selectedNetwork.icon.startsWith('http') ? (
                        <img src={selectedNetwork.icon} alt={selectedNetwork.name} />
                    ) : (
                        selectedNetwork.icon
                    )}
                </span>
                <span className="network-name">{selectedNetwork.name}</span>
                <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="network-dropdown">
                    <div className="dropdown-header">Select a network</div>
                    {chains.map((chain) => (
                        <button
                            key={chain.chainId}
                            className={`network-option ${chain.chainId === selectedChainId ? 'selected' : ''}`}
                            onClick={() => handleNetworkSelect(chain.chainId)}
                        >
                            <span className="network-icon">
                                {chain.icon.startsWith('http') ? (
                                    <img src={chain.icon} alt={chain.name} />
                                ) : (
                                    chain.icon
                                )}
                            </span>
                            <span className="network-name">{chain.name}</span>
                            {chain.chainId === selectedChainId && (
                                <span className="check-icon">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            <style>{`
                .network-selector-container {
                    position: relative;
                }

                .network-indicator {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--surface-color);
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    padding: 8px 14px;
                    border-radius: 20px;
                    font-weight: 600;
                    font-size: 15px;
                    color: var(--text-color);
                    transition: all 0.2s;
                    cursor: pointer;
                }

                .network-indicator:hover {
                    background: var(--surface-hover);
                    border-color: rgba(0, 0, 0, 0.1);
                }

                .network-icon {
                    font-size: 18px;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                }

                .network-icon img {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                }

                .network-name {
                    font-weight: 600;
                }

                .dropdown-arrow {
                    font-size: 10px;
                    margin-left: 4px;
                    color: #666;
                }

                .network-dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                    min-width: 200px;
                    z-index: 1000;
                    overflow: hidden;
                }

                .dropdown-header {
                    padding: 12px 16px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #edf2f7;
                }

                .network-option {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    width: 100%;
                    border: none;
                    background: white;
                    cursor: pointer;
                    transition: background 0.15s;
                    font-size: 14px;
                    color: #1e293b;
                }

                .network-option:hover {
                    background: #f8fafc;
                }

                .network-option.selected {
                    background: #eff6ff;
                    color: #3b82f6;
                }

                .network-option .network-icon {
                    font-size: 16px;
                }

                .network-option .network-icon img {
                    width: 20px;
                    height: 20px;
                }

                .check-icon {
                    margin-left: auto;
                    color: #3b82f6;
                    font-weight: bold;
                }
            `}</style>
        </div>
    );
};
