import React from 'react';
import type { CowHook } from '../hooks/useCowSdk';

interface WalletConnectProps {
    cowSdk: CowHook;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({ cowSdk }) => {
    const { account, connect, disconnect } = cowSdk;

    const formatAddress = (addr: string) => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    return (
        <div className="wallet-connect">
            {account ? (
                <button
                    onClick={disconnect}
                    className="connect-btn connected"
                    title="Disconnect"
                >
                    <span className="status-dot"></span>
                    {formatAddress(account)}
                </button>
            ) : (
                <button onClick={connect} className="connect-btn">
                    Connect Wallet
                </button>
            )}
            <style>{`
                .connect-btn {
                    background: rgba(255, 0, 122, 0.1);
                    color: #ff007a;
                    border: 1px solid rgba(255, 0, 122, 0.2);
                    padding: 10px 16px;
                    border-radius: 20px;
                    font-weight: 600;
                    font-size: 16px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .connect-btn:hover {
                    background: rgba(255, 0, 122, 0.2);
                    border-color: rgba(255, 0, 122, 0.4);
                }
                .connect-btn.connected {
                    background: var(--surface-hover);
                    color: var(--text-color);
                    border-color: transparent;
                }
                .connect-btn.connected:hover {
                    background: rgba(0, 0, 0, 0.05);
                }
                .status-dot {
                    width: 8px;
                    height: 8px;
                    background: #4cd964;
                    border-radius: 50%;
                }
            `}</style>
        </div>
    );
};
