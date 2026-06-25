import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import './Wallet.css';
import { generateWallet, fetchBalance } from '../api/blockchain.api';

/**
 * Wallet component — generates a cryptographic key pair and displays
 * the public key (wallet address) with its current balance.
 * The private key is held in component state only and never sent back to the server.
 */
const Wallet = ({ onWalletGenerated }) => {
  const [publicKey, setPublicKey] = useState('');
  const [balance, setBalance] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const data = await generateWallet();
      setPublicKey(data.publicKey);
      setBalance(0);
      // Pass both keys to parent; private key stays in App state, never leaves the client
      onWalletGenerated({ publicKey: data.publicKey, privateKey: data.privateKey });
    } catch (err) {
      setError(err.message || 'Failed to generate wallet');
    } finally {
      setGenerating(false);
    }
  };

  const handleRefreshBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const data = await fetchBalance(publicKey);
      setBalance(data.balance);
    } catch {
      setError('Failed to fetch balance');
    }
  }, [publicKey]);

  return (
    <div className="wallet">
      <h2 className="panel-title">Wallet</h2>

      <button className="wallet-generate-btn" onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating...' : 'Generate New Wallet'}
      </button>

      {error && <p className="wallet-error">{error}</p>}

      {publicKey && (
        <div className="wallet-info">
          <div className="wallet-field">
            <span className="wallet-label">Address (Public Key)</span>
            <span className="wallet-value wallet-address" title={publicKey}>
              {publicKey.slice(0, 20)}…{publicKey.slice(-10)}
            </span>
          </div>

          <div className="wallet-field">
            <span className="wallet-label">Balance</span>
            <span className="wallet-value">{balance !== null ? balance : '—'}</span>
            <button className="wallet-refresh-btn" onClick={handleRefreshBalance}>
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

Wallet.propTypes = {
  /** Called with { publicKey, privateKey } when a new wallet is generated */
  onWalletGenerated: PropTypes.func.isRequired,
};

export default Wallet;
