/**
 * @fileoverview Blockchain persistence service.
 *
 * Serialises blockchain state to `blockchain.json` in the project root so the
 * chain survives server restarts.  All file I/O errors are caught internally;
 * the server will never crash due to a persistence failure.
 *
 * File shape:
 * {
 *   "difficulty":          number,
 *   "miningReward":        number,
 *   "chain": Array<{
 *     "timestamp":         number,
 *     "previousHash":      string,
 *     "nonce":             number,
 *     "hash":              string,
 *     "transactions": Array<{
 *       "fromAddress":     string | null,
 *       "toAddress":       string,
 *       "amount":          number,
 *       "timestamp":       number,
 *       "signature":       string
 *     }>
 *   }>,
 *   "pendingTransactions": Array<Transaction-shape (same as above)>
 * }
 */

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');
const { Blockchain, Block, Transaction } = require('../models/blockchain');

const FILE_PATH = path.join(__dirname, '..', 'blockchain.json');

/**
 * Reconstructs a Transaction class instance from a plain JSON object.
 * @param {Object} raw - Plain transaction object from JSON
 * @returns {Transaction}
 */
function hydrateTransaction(raw) {
  const tx = new Transaction(raw.fromAddress, raw.toAddress, raw.amount);
  tx.timestamp = raw.timestamp;
  tx.signature = raw.signature || '';
  return tx;
}

/**
 * Reconstructs a Block class instance from a plain JSON object.
 * The stored hash and nonce are restored directly so the block is not re-mined.
 * @param {Object} raw - Plain block object from JSON
 * @returns {Block}
 */
function hydrateBlock(raw) {
  const transactions = raw.transactions.map(hydrateTransaction);
  const block = new Block(raw.timestamp, transactions, raw.previousHash);
  block.nonce = raw.nonce;
  block.hash = raw.hash;
  return block;
}

/**
 * Serialises the blockchain state and writes it to `blockchain.json`.
 * Called asynchronously after every successful transaction and mine operation.
 * Errors are logged but never re-thrown — the server must remain stable.
 * @param {Blockchain} blockchain - The live blockchain instance
 * @returns {Promise<void>}
 */
async function save(blockchain) {
  try {
    const payload = {
      difficulty: blockchain.difficulty,
      miningReward: blockchain.miningReward,
      chain: blockchain.chain,
      pendingTransactions: blockchain.pendingTransactions,
    };
    await fsPromises.writeFile(FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    logger.debug(`Blockchain state saved to ${FILE_PATH}`);
  } catch (err) {
    logger.error(`Failed to save blockchain state: ${err.message}`);
  }
}

/**
 * Reads and deserialises the saved blockchain state from `blockchain.json`.
 * Uses synchronous I/O because it is called during module initialisation.
 * Returns `null` if the file does not exist, is corrupt, or fails chain validation.
 * @returns {Blockchain|null}
 */
function load() {
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const data = JSON.parse(raw);

    const blockchain = new Blockchain(data.difficulty, data.miningReward);
    blockchain.chain = data.chain.map(hydrateBlock);
    blockchain.pendingTransactions = data.pendingTransactions.map(hydrateTransaction);

    if (!blockchain.isChainValid()) {
      logger.warn('Loaded chain failed integrity check — starting fresh');
      return null;
    }

    logger.info(`Blockchain state restored from ${FILE_PATH} (${blockchain.chain.length} blocks)`);
    return blockchain;
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.info('No saved blockchain state found — starting fresh');
    } else {
      logger.warn(`Failed to load blockchain state (${err.message}) — starting fresh`);
    }
    return null;
  }
}

/**
 * Deletes the saved blockchain state file.
 * Useful for testing and resetting state.
 * @returns {Promise<void>}
 */
async function clear() {
  try {
    await fsPromises.unlink(FILE_PATH);
    logger.info('Blockchain state file cleared');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error(`Failed to clear blockchain state: ${err.message}`);
    }
  }
}

module.exports = { save, load, clear };
