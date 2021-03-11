const express = require('express');
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const app = express();

//initialize request middleware
app.use(express.json());

app.get('/', (req, res) => {
  return res.status(200).sendFile('./index.html', { root: __dirname })
});

app.get('/sms', (req, res) => {
  const twiml = new MessagingResponse();
  console.log(req.params);
  console.log(req.body);
  console.log(req.query);

  // send xml response
  twiml.message('The Robots are coming! Head for the hills!');
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

//Set server port as environment or 5000
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
});