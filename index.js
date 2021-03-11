const http = require('http');
const express = require('express');
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const app = express();

app.get('/', (req, res) => {
  return res.status(200).sendFile('./index.html', { root: __dirname })
});

app.post('/sms', (req, res) => {
  const twiml = new MessagingResponse();

  twiml.message('The Robots are coming! Head for the hills!');

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 5000;

http.createServer(app).listen(PORT, () => {
  console.log('Express server listening on port 5000');
});