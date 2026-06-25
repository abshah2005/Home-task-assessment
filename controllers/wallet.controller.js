const crypto = require('crypto');
const { sendCreated } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Generates a new EC P-256 key pair for use as a blockchain wallet.
 * The public key is returned as DER SPKI hex — this is the wallet address.
 * The private key is returned as PEM PKCS8 for client-side signing only.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const generateWallet = (req, res) => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  logger.info('Generated new wallet');

  sendCreated(res, {
    publicKey: publicKey.toString('hex'),
    privateKey,
  });
};

module.exports = { generateWallet };
