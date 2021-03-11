const Box = require('../../models/Box');
const User = require('../../models/User');
const router = require('express').Router();
const MessagingResponse = require('twilio').twiml.MessagingResponse;

router.post('/', async (req, res) => {
    const twiml = new MessagingResponse();
  
    var content = req.body.Body;
    var [command, ...args] = content.split(' ');
  
    if (command === 'init') {
      if (args.length > 1) return res.status(400);

      var name = args[0];
      var number = req.body.From;

      var user = await User.findOne({ number });
      if (user) return res.status(400); // send phone number already in user here
      user = await User.create({ name, number });

      // send welcome message here with commands
    }
    else if (command === 'setup') {
      // var keys = [];
      // for (var i = 0; i < args.length; i++){
      //   for (var j = i + 1; j < args.length; j++) {
      //     keys.push(`${args[i]}-${args[j]}`)
      //   }
      // }

      var name = args[0];

      // generate unqiue code
      // let stopped = false

      // // infinite loop
      // while(!stopped) {
      //    let res = await fetch('api link') 
      //    if (res.something) stopped = true // stop when you want
      // }
  
      // create box, set current user as admin and create a user document for the current user
      var box = await Box.create({ name, code, dues: [] });
      var user = await User.create({ name, number, box: code, isAdmin: true });
    }
    else if (command === 'join') {
      // join existing room, create user document and attach to room
      var code = args[0];
    }
  
    // transactions
  
    // Access the message body and the number it was sent from.
    console.log(`Incoming message from ${req.body.From}: ${req.body.Body}`);
  
    twiml.message('The Robots are coming! Head for the hills!');
  
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  });

module.exports = router;
  