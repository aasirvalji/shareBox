const mongoose = require('mongoose');

const Transaction = new mongoose.Schema({
    room: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    createdAt: {
        type: Boolean,
        default: false
    }
})

module.exports = mongoose.model('Transaction', Transaction);