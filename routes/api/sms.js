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
    console.log(command, args);
    command = command.toLowerCase();
  
    if (prefix.includes(command) && command === 'init') {
      if (args.length !== 1) {
        twiml.message(`Please enter your name with the init command.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

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
      else if (user.box) {
        twiml.message(`It looks like you're already apart of a box.`);
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

      var box = await Box.findOne({ code });
      if (!box) {
        twiml.message("This box doesn't exist.");
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }
      
      // if admin, return

      // create nodes from everyone that already exists to this new user
      var user = await User.findOne({ number });
      if (!user) {
        twiml.message("You haven't signed up yet.");
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      // generate new due pairings
      var users = await User.find({ box: code });
      if (users.length === 0) {
        twiml.message('It looks like no other users have joined your box yet.');
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      var newDues = []
      for (var u of users) {
        newDues.push({ pair: `${u.number}:${user.number}`, amount: 0 });
      }

      box.dues = [...box.dues, ...newDues];
      await box.save();

      user.box = box.code;
      await user.save();

      // return success message back to user
      twiml.message(`You've successfully joined ${box.name}.`);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    }
    else if (!prefix.includes(command)) {
     // check for transactions here
     var splitContent = content.split(' ');
     
     var amount;
     var payer;
     var box;
     var ower;
     var caller;
     if (!(/\s/.test(content)) && content.includes('/')) {
        var rawSplit = content.split('/');
        var amount = (parseFloat(rawSplit[0]) / parseFloat(rawSplit[1])).toFixed(2);

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

        var owers = await User.find({ box: payer.box });
        if (owers.length === 0) {
          twiml.message(`It looks like you're not in a there are no other people in your box yet.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }

        async function recordTransaction() {
          for (var ower of owers) {
            console.log(ower, payer);
            if (ower.number === payer.number) continue; // skip over themself
 
            var direction = 1;
            var index = -1
            for (var i = 0; i < box.dues.length; i++){  
              console.log(box.dues[i].pair, `${payer.number}:${ower.number}`);
              console.log(box.dues[i].pair, `${ower.number}:${payer.number}`);
              if (box.dues[i].pair === `${payer.number}:${ower.number}`) index = i;
              else if (box.dues[i].pair === `${ower.number}:${payer.number}`) {
                index = i;
                direction = -1;
              }

            if (index === -1) continue;
            
            var dues = [...box.dues];
            dues[index] = { pair: box.dues[index].pair, amount: (box.dues[index].amount + (amount * direction)) };
            box.dues = dues;
            await box.save();

            var transaction = await Transaction.create({ box: box.code });
            var text = `${payer.name} payed ${amount} for ${ower.name} on ${new Date(transaction.createdAt).toLocaleString()}`;
            transaction.raw = content;
            transaction.text = text;
            await transaction.save();
            console.log(4)
            }
          }
          return;
        }

        await recordTransaction();

        twiml.message(`Transaction recorded.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
     }
      // 2 args transaction - To name:amount
      else if (splitContent.length === 2) {
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

      console.log('PAYER: ');
      console.log(payer);
      console.log('OWER: ');
      console.log(ower);

        var direction = 1;

        var pair = -1
        for (var i = 0; i < box.dues.length; i++){  
          console.log(box.dues[i].pair, `${payer.number}:${ower.number}`);
          console.log(box.dues[i].pair, `${ower.number}:${payer.number}`);
          if (box.dues[i].pair === `${payer.number}:${ower.number}`) {
            pair = i;
            break;
          }
          else if (box.dues[i].pair === `${ower.number}:${payer.number}`) {
            pair = i;
            direction = -1;
            break;
          }
        }

        if (pair === -1) return console.log('Not found.');

        var dues = [...box.dues];
        dues[pair] = { pair: box.dues[pair].pair, amount: (box.dues[pair].amount + (amount * direction)) };
        box.dues = dues;
        await box.save();

        var transaction = await Transaction.create({ box: box.code });

        var text = `${payer.name} payed ${amount} for ${ower.name} on ${new Date(transaction.createdAt).toLocaleString()}`;
        transaction.raw = content;
        transaction.text = text;
        await transaction.save();

        twiml.message(`Transaction recorded.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
    }
  });

module.exports = router;
  