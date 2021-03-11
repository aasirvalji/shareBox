const router = require('express').Router();
const path = require('path');

router.get('/', (req, res) => {
    return res.status(200).sendFile(path.join(__dirname, '..', '..', 'index.html'));
});

module.exports = router;