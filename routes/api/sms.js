const Box = require('../../models/Box');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const router = require('express').Router();
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const prefix = ['setup', 'init', 'join'];

function genCode() {
  return Math.random().toString(36).substr(2, 5);
}

router.post('/', async (req, res) => {
    const twiml = new MessagingResponse();

    console.log(`Incoming message from ${req.body.From}: ${req.body.Body}`);
    console.log('Body content: ');
    console.log(req.body)
  
    var content = req.body.Body.trim();
    console.log('Content received: ' + content);
     
    var [command, ...args] = content.split(' ');
    command = command.toLowerCase();
  
    if (prefix.includes(command) && command === 'init') {
      if (args.length > 1) return res.status(400);

      var name = args[0].toLowerCase();
      var number = req.body.From;

      var user = await User.findOne({ number });
      if (user) {
        twiml.message(`You've already registered.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }
      user = await User.create({ name, number });

      // send welcome message here with commands
      twiml.message(`Hey ${name}, welcome to share box!`);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    }
    else if (prefix.includes(command) && command === 'setup') {
      // get vals
      var name = args[0].toLowerCase();
      var number = req.body.From;
      var code = genCode();
      var isUnique = false;

      // check user
      var user = await User.findOne({ number });
      if (!user) {
        twiml.message(`It looks like you haven't setup with shareBox yet.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      // generate a unique code
      while(!isUnique || !code) {
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
      twiml.message(`Your box has been created (${name}). Send this code to your friends so they can join your room: ${code}`);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    }
    else if (prefix.includes(command) && command === 'join') {
      // join existing room, create user document and attach to room
      var code = args[0];
      var number = req.body.From;

      // create nodes from everyone that already exists to this new user
      var user = await User.findOne({ number });
      if (!user) {
        twiml.message("You haven't signed up yet.");
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      // generate new due pairings
      var users = await User.find({ code });
      if (users.length === 0) {
        twiml.message('It looks like no other users have joined your box yet.');
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      var newDues = []
      for (var u of users) {
        newDues.push({ pair: `${u.number}:${user.number}`, amount: 0 });
      }

      var box = await Box.findOne({ code });
      if (!box) {
        twiml.message("Something went wrong locating your box. Please try again later.");
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      box.dues = [...box.dues, ...newDues];
      await box.save();

      // return success message back to user
      twiml.message(`You've successfully joined ${box.name}.`);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    }
    else if (!prefix.includes(command)) {
     // check for transactions here
     var splitContent = content.split(' ');
      // 2 args transaction - To name:amount
      if (splitContent.length === 2) {
        var amount = parseFloat(splitContent[1]).toFixed(2);
    
        var payer = await User.findOne({ number: req.body.From });
        if (!payer) {
          twiml.message(`I couldn't find your information. Please make sure you've initialized your phone number.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }

        var box = await Box.findOne({ code: payer.box });
        if (!box) {
          twiml.message(`It looks like you're not in a box yet.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }

        var ower = await User.findOne({ name: splitContent[0], box: payer.box });
        if (!ower) {
          twiml.message(`I couldn't find the owing persons information.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }
      }
      else if (splitContent.length === 3){
        var amount = parseFloat(splitContent[2]).toFixed(2);

        var caller = await User.findOne({ number: req.body.From });
        if (!caller) {
          twiml.message(`It seems like you haven't setup with shareBox yet.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }

        var box = await Box.findOne({ code: caller.box });
        if (!box) {
          twiml.message(`It looks like you're not in a box yet.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }
    
        var payer = await User.findOne({ name: splitContent[0], box: box.code });
        if (!payer) {
          twiml.message(`I couldn't find your information. Please make sure you've initialized your phone number.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }

        var ower = await User.findOne({ name: splitContent[1], box: box.code });
        if (!ower) {
          twiml.message(`I couldn't find the owing persons information.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }
      }
      else return;

        var direction = 1;
        var pair = box.dues.findIndex((d) => d.pair === `${payer.number}:${ower.number}`);
        if (!pair || pair === -1) {
          pair = box.dues.findIndex((d) => d.pair === `${ower.number}:${payer.number}`);
          direction = -1;
        }
        if (!pair || pair === -1) {
          twiml.message(`Something went wrong. Please try again later.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }
        var dues = [...box.dues];
        dues[pair] = { pair: box.dues[pair].name, amount: ((box.dues[pair].amount + amount) * direction) };
        box.dues = dues;
        await box.save();

        var transaction = await Transaction.create({ box: box.code });

        var text = `${payer.name} payed ${amount} for ${ower} on ${new Date(transaction.createdAt).toLocaleString()}`;
        transaction.raw = content;
        transaction.text = text;
        await transaction.save();

        twiml.message(`Transaction recorded.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
    }
  });

module.exports = router;
  