const mongoose = require('mongoose');

const Transaction = new mongoose.Schema({
    box: {
        type: String,
        required: true
    },
    text: {
        type: String,
    },
    raw: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('Transaction', Transaction);