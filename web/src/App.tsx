import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useCowSdk } from './hooks/useCowSdk';
import { useNetworkState } from './hooks/useNetworkState';
import { WalletConnect } from './components/WalletConnect';
import { NetworkIndicator } from './components/NetworkIndicator';
import { OrderForm } from './components/OrderForm';
import { ChatPage } from './components/ChatPage';
import './App.css';

function AppContent() {
  const cowSdk = useCowSdk();
  const location = useLocation();
  const { selectedChainId, setSelectedChainId } = useNetworkState();

  // Handle network change - update state AND request wallet to switch
  const handleNetworkChange = async (chainId: number) => {
    // Update internal state
    setSelectedChainId(chainId);

    // Request wallet to switch networks
    if ((window as any).ethereum && cowSdk.account) {
      try {
        const chainIdHex = `0x${chainId.toString(16)}`;
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
      } catch (error: any) {
        if (error.code === 4902) {
          console.error('Network not added to wallet:', chainId);
          // Network not added to wallet - could implement wallet_addEthereumChain here
        } else if (error.code === 4001) {
          console.log('User rejected network switch');
        } else {
          console.error('Error switching network:', error);
        }
      }
    }
  };

  // Sync navbar network with wallet network when wallet connects or switches
  useEffect(() => {
    if (cowSdk.chainId) {
      console.log('Syncing navbar to wallet network:', cowSdk.chainId);
      setSelectedChainId(cowSdk.chainId);
    }
  }, [cowSdk.chainId, setSelectedChainId]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <img src="/alphaswap_logo_v2.svg" alt="AlphaSwap Logo" className="app-logo" />
          <div className="app-title">Alpha Swap</div>
        </div>

        <nav className="nav-links">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            Expert Mode
          </Link>
          <Link to="/chat" className={`nav-link ${location.pathname === '/chat' ? 'active' : ''}`}>
            Chat
          </Link>
        </nav>

        <div className="header-actions">
          <NetworkIndicator
            selectedChainId={selectedChainId}
            onNetworkChange={handleNetworkChange}
          />
          <WalletConnect cowSdk={cowSdk} />
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={
            <div className="expert-mode-container">
              <OrderForm
                cowSdk={cowSdk}
                selectedChainId={selectedChainId}
                onNetworkChange={handleNetworkChange}
              />
              <div className="info-section">
                <h3 className="info-title">Why Alpha Swap?</h3>
                <p>Experience the future of decentralized trading with MEV protection and gasless orders.</p>

                <div className="info-grid">
                  <div className="info-item">
                    <h4>$12B+</h4>
                    <p>Volume Traded</p>
                  </div>
                  <div className="info-item">
                    <h4>300K+</h4>
                    <p>Trades Protected</p>
                  </div>
                  <div className="info-item">
                    <h4>0</h4>
                    <p>Failed Transactions</p>
                  </div>
                </div>
              </div>
            </div>
          } />
          <Route path="/chat" element={<ChatPage selectedChainId={selectedChainId} />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
