const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    title: String,
    description: String,
    price: Number,
    dateOfSale: Date,
    category: String,
    image:String,
    sold: Boolean,
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;