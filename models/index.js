const config = require('../config');
const logger = require('../utils/logger');
const { Blockchain, Block, Transaction } = require('./blockchain');
const { save, load } = require('../services/persistence.service');

/**
 * Initialise the singleton blockchain instance.
 * Attempts to restore persisted state first; falls back to a fresh chain.
 */
let blockchain = load();

if (!blockchain) {
  blockchain = new Blockchain(
    config.blockchain.difficulty,
    config.blockchain.miningReward
  );
}

/**
 * Wraps a blockchain method so that `save()` is called automatically after
 * every successful mutation.  Errors from the original method still propagate;
 * persistence failures are logged but never re-thrown.
 * @param {Function} fn - Bound blockchain method to wrap
 * @returns {Function}
 */
function withPersist(fn) {
  return function (...args) {
    fn(...args); // propagates any validation error; save only runs on success
    save(blockchain).catch((err) =>
      logger.error(`Auto-save failed: ${err.message}`)
    );
  };
}

blockchain.addTransaction = withPersist(blockchain.addTransaction.bind(blockchain));
blockchain.minePendingTransactions = withPersist(
  blockchain.minePendingTransactions.bind(blockchain)
);

module.exports = {
  blockchain,
  Blockchain,
  Block,
  Transaction,
};
