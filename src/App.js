import { useState } from 'react';
import './App.css';

import BlockchainViewer from './components/BlockchainViewer';
import TransactionForm from './components/TransactionForm';
import StatsPanel from './components/StatsPanel';
import Header from './components/Header';
import Wallet from './components/Wallet';

import useBlockchain from './hooks/useBlockchain';
import { mineBlock } from './api/blockchain.api';

function App() {
  const { chain, stats, loading, error, refresh } = useBlockchain();
  const [wallet, setWallet] = useState(null);

  const handleMine = async () => {
    try {
      await mineBlock();
      await refresh();
    } catch (err) {
      console.error('Mining failed:', err.message);
    }
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading Blockchain...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <Header />
      <div className="app-container">
        {error && (
          <div className="error-banner">
            <p>{error}</p>
          </div>
        )}

        <div className="main-content">
          <div className="left-panel">
            <Wallet onWalletGenerated={setWallet} />
            <StatsPanel stats={stats} onMine={handleMine} />
            <TransactionForm onTransactionAdded={refresh} wallet={wallet} />
          </div>

          <div className="right-panel">
            <BlockchainViewer blockchain={chain} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
