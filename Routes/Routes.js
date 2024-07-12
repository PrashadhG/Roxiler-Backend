const express = require('express');
const {
    initializeDatabase,
    getTransactions,
    getStatistics,
    getCombinedData
} = require('../Controllers/Controller');

const router = express.Router();

router.get('/initialize', initializeDatabase);
router.get('/transaction', getTransactions);
router.get('/statistics/:month', getStatistics);
router.get('/combined/:month', getCombinedData);

module.exports = router;
