import { useState } from 'react';
import PropTypes from 'prop-types';
import './TransactionForm.css';
import { addTransaction } from '../api/blockchain.api';

/**
 * Converts a PEM PKCS8 private key string into a Web Crypto CryptoKey.
 * @param {string} pem
 * @returns {Promise<CryptoKey>}
 */
async function importPrivateKey(pem) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return window.crypto.subtle.importKey(
    'pkcs8',
    buffer.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

/**
 * Converts a Web Crypto ECDSA P1363 signature (r||s, 64 bytes) to DER hex,
 * which is what Node.js crypto.verify expects.
 * @param {Uint8Array} p1363
 * @returns {string} hex-encoded DER signature
 */
function p1363ToDerHex(p1363) {
  const encodeInt = (bytes) => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    const trimmed = bytes.slice(start);
    // Prepend 0x00 if the high bit is set to avoid being interpreted as negative
    return trimmed[0] >= 0x80 ? new Uint8Array([0, ...trimmed]) : trimmed;
  };

  const r = encodeInt(p1363.slice(0, 32));
  const s = encodeInt(p1363.slice(32, 64));
  const der = new Uint8Array([
    0x30,
    r.length + s.length + 4,
    0x02,
    r.length,
    ...r,
    0x02,
    s.length,
    ...s,
  ]);
  return Array.from(der)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Signs a transaction using the Web Crypto API.
 * Mirrors the backend Transaction.signTransaction() signing logic:
 *   SHA256(fromAddress + toAddress + amount + timestamp)
 * @param {string} privateKeyPem
 * @param {string} fromAddress
 * @param {string} toAddress
 * @param {number} amount
 * @param {number} timestamp
 * @returns {Promise<string>} DER-encoded signature as hex string
 */
async function signTransaction(privateKeyPem, fromAddress, toAddress, amount, timestamp) {
  const cryptoKey = await importPrivateKey(privateKeyPem);
  const message = `${fromAddress}${toAddress}${amount}${timestamp}`;
  const data = new TextEncoder().encode(message);
  const sigBuffer = await window.crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    cryptoKey,
    data
  );
  return p1363ToDerHex(new Uint8Array(sigBuffer));
}

const TransactionForm = ({ onTransactionAdded, wallet }) => {
  const [formData, setFormData] = useState({
    toAddress: '',
    amount: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!wallet) {
      setMessage('Generate a wallet first before creating a transaction.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const timestamp = Date.now();
      const amount = parseFloat(formData.amount);
      const signature = await signTransaction(
        wallet.privateKey,
        wallet.publicKey,
        formData.toAddress,
        amount,
        timestamp
      );

      await addTransaction(wallet.publicKey, formData.toAddress, amount, timestamp, signature);
      setMessage('Transaction added successfully!');
      setFormData({ toAddress: '', amount: '' });
      onTransactionAdded();
    } catch (err) {
      setMessage(err.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="transaction-form">
      <h2 className="panel-title">Create Transaction</h2>

      {!wallet && <p className="form-notice">Generate a wallet above to enable transactions.</p>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fromAddress">From Address</label>
          <input
            type="text"
            id="fromAddress"
            name="fromAddress"
            value={wallet ? `${wallet.publicKey.slice(0, 20)}…${wallet.publicKey.slice(-10)}` : ''}
            readOnly
            placeholder="Generate a wallet first"
            className="input-readonly"
          />
        </div>

        <div className="form-group">
          <label htmlFor="toAddress">To Address</label>
          <input
            type="text"
            id="toAddress"
            name="toAddress"
            value={formData.toAddress}
            onChange={handleChange}
            placeholder="Recipient public key (hex)"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount</label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            placeholder="e.g., 100"
            step="0.01"
            min="0"
            required
          />
        </div>

        {message && (
          <div className={`form-message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <button type="submit" className="submit-button" disabled={loading || !wallet}>
          {loading ? 'Signing & Adding...' : 'Add Transaction'}
        </button>
      </form>
    </div>
  );
};

TransactionForm.propTypes = {
  onTransactionAdded: PropTypes.func.isRequired,
  /** Active wallet with { publicKey, privateKey }. Transactions are disabled without one. */
  wallet: PropTypes.shape({
    publicKey: PropTypes.string.isRequired,
    privateKey: PropTypes.string.isRequired,
  }),
};

TransactionForm.defaultProps = {
  wallet: null,
};

export default TransactionForm;
