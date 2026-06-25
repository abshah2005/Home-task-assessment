const { Router } = require('express');
const { generateWallet } = require('../controllers/wallet.controller');
const { writeLimiter } = require('../middleware/rateLimit.middleware');

const router = Router();

router.post('/', writeLimiter, generateWallet);

module.exports = router;
