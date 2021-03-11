const Box = require('../../models/Box');
const User = require('../../models/User');
const router = require('express').Router();
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const prefix = ['setup', 'init', 'join'];

router.post('/', async (req, res) => {
    const twiml = new MessagingResponse();
  
    var content = req.body.Body;
    var [command, ...args] = content.split(' ');
    command = command.toLowerCase();
  
    if (prefix.includes(command) && command === 'init') {
      if (args.length > 1) return res.status(400);

      var name = args[0];
      var number = req.body.From;

      var user = await User.findOne({ number });
      if (user) return res.status(400); // send phone number already in user here
      user = await User.create({ name, number });

      // send welcome message here with commands
    }
    else if (prefix.includes(command) && command === 'setup') {
      // var keys = [];
      // for (var i = 0; i < args.length; i++){
      //   for (var j = i + 1; j < args.length; j++) {
      //     keys.push(`${args[i]}-${args[j]}`)
      //   }
      // }

      // get vals
      var name = args[0];
      var number = req.body.From;
      var code = genCode();
      var isUnique = false;

      // check user
      var user = await User.findOne({ number });
      if (!user) return res.status(400); // send you have not registered message here

      // generate a unique code
      while(!isUnique) {
         let boxExists = await Box.findOne({ code });
         if (!boxExists) isUnique = true;
         else code = genCode();
      }
  
      // create box
      var box = await Box.create({ name, code, dues: [] });

      // update user document
      user.box = box.code;
      user.isAdmin = true;
      await user.save();

      // return text back to user here
      
    }
    else if (prefix.includes(command) && command === 'join') {
      // join existing room, create user document and attach to room
      var code = args[0];
      var number = req.body.From;

      // create nodes from everyone that already exists to this new user
      var user = await User.findOne({ number });
      if (!user) return; // send you haven't signed up message yet here

      // generate new due pairings
      var users = await User.find({ code });
      if (users.length === 0) return; // send message saying no other users have signed up for this box

      var newDues = []
      for (var u of users) {
        newDues.push({ pair: `${u.number}:${user.number}`, amount: 0 });
      }

      var box = await Box.findOne({ code });
      if (!box) return; // send error text back to user

      box.dues = [...box.dues, ...newDues];
      await box.save();

      // return success message back to user
    }
    else if (!prefix.includes(command)) {
      var number = req.body.From;
      var user = await User.findOne({ number });
      if (!user) return; // send you have not set up an account message

      // create transaction here
    }
  
    // Access the message body and the number it was sent from.
    console.log(`Incoming message from ${req.body.From}: ${req.body.Body}`);
  
    twiml.message('The Robots are coming! Head for the hills!');
  
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  });

module.exports = router;
  