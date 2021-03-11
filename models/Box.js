const mongoose = require('mongoose');

const Box = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    code: {
        type: String,
        required: true
    },
    dues: [
        {
            pair: {
                type: String
            },
            amount: {
                type: Number
            }
        }
    ]
})

module.exports = mongoose.model('Box', Box);