const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env')});

const connectDB = async () => {
try {  
    await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true,
    })

    console.log('Connected to MongoDB');

} catch (err) {
    console.log(err.message);
    process.exit(1)
}
}

module.exports = connectDB;