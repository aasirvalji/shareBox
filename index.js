const http = require('http');
const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const { urlencoded } = require('body-parser');

/* TODO LIST */
// Add backup route to console incase main goes down

// Load env vars
dotenv.config();

//Connect to Database
connectDB();

const app = express();
app.use(urlencoded({ extended: false }));

app.use('/', require('./routes/api/index.js'));
app.use('/sms', require('./routes/api/sms.js'));

//Set server port as environment or 5000
const PORT = process.env.PORT || 5000;

http.createServer(app).listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
});