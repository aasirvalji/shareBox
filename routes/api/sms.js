const Box = require('../../models/Box');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const router = require('express').Router();
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const prefix = ['setup', 'init', 'join', 'users', 'clear'];

// generate 5 character code
function genCode() { 
  return Math.random().toString(36).substr(2, 5);
}

// text callback route
router.post('/', async (req, res) => {
    const twiml = new MessagingResponse();

    // log incoming text
    console.log(`Incoming message from ${req.body.From}: ${req.body.Body}`);
    console.log('Body content: ');
    console.log(req.body)
  
    var content = req.body.Body.trim();
    console.log('Content received: ' + content);
     
    // format incoming text body
    var [command, ...args] = content.split(' ');
    console.log(command, args);
    command = command.toLowerCase();
  
    // setup users account in db
    if (prefix.includes(command) && command === 'init') {
      if (args.length !== 1) {
        twiml.message(`Please enter your nickname with the init command.`);
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

    // create box
    else if (prefix.includes(command) && command === 'setup') {
      if (args.length !== 1) {
        twiml.message(`Please enter your box name with the init command.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      var name = args[0].toLowerCase();
      var number = req.body.From;
      var code = genCode();
      var isUnique = false;

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

      // keep generating short code until one is found that hasn't been used.
      while(!isUnique || !code) {
         let boxExists = await Box.findOne({ code });
         if (!boxExists) isUnique = true;
         else code = genCode();
      }
  
      var box = await Box.create({ name, code, dues: [] });

      user.box = box.code;
      user.isAdmin = true;
      await user.save();

      twiml.message(`Your box has been created (${name}). Send this code to your friends so they can join your room: ${code}`);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    }
    // join an exisiting room using a short code
    else if (prefix.includes(command) && command === 'join') {
      var code = args[0];
      var number = req.body.From;

      var box = await Box.findOne({ code });
      if (!box) {
        twiml.message("This box doesn't exist.");
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }
      
      var user = await User.findOne({ number });
      if (!user) {
        twiml.message("You haven't signed up yet.");
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      if (user.box && user.box === code) {
        twiml.message("You're already apart of this box.");
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      // find existing users in box and generate new due pairings with them
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

      twiml.message(`You've successfully joined ${box.name}.`);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    }
    else if (prefix.includes(command) && command === 'users') {
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
  
      var users = await User.find({ box: box.code });
      
      var str = '';
      for (var u of users) {
        str = `${str}- ${u.name}\n`
      }

      twiml.message(str);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    }

    // clear all dues in box
    else if (prefix.includes(command) && command === 'clear' && args.length === 0) {
      var caller = await User.findOne({ number: req.body.From });
      if (!caller) {
        twiml.message(`I couldn't find your information. Please make sure you've initialized your phone number.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      var box = await Box.findOne({ code: caller.box });
      if (!box) {
        twiml.message(`It looks like you're not in a box yet.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      if (box.dues.length === 0) {
        twiml.message(`It looks like no one else has joined youe box yet. Use this code to have your friends join: ${box.code}`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      var dues = [...box.dues];
      for (var i = 0; i < dues.length; i++){
        dues[i].amount = 0;
      }

      box.dues = dues;
      await box.save();

      twiml.message(`All dues in your box (${box.name}) have been reset.`);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    }

    // clear dues with a specific person
    else if (prefix.includes(command) && command === 'clear' && args.length === 1) {
      var caller = await User.findOne({ number: req.body.From });
      if (!caller) {
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

      if (box.dues.length === 0) {
        twiml.message(`It looks like no one else has joined youe box yet. Use this code to have your friends join: ${box.code}`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      var other = await User.findOne({ name: args[0], box: box.code });
      if (!other) {
        twiml.message(`We couldn't find that person. Please try again.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      var dues = [...box.dues];
      for (var i = 0; i < dues.length; i++){
        if (dues[i].pair === `${caller.number}:${other.number}` || dues[i].pair === `${other.number}:${caller.number}`) {
          dues[i].amount = 0;
          break;
        }
      }

      box.dues = dues;
      await box.save();

      twiml.message(`Your dues with ${other.name} have been cleared.`);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    }


    // check how much is owed/dued by others in your box
    else if (prefix.includes(command) && command === 'owe') {
      var caller = await User.findOne({ number: req.body.From });
      if (!caller) {
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

      if (box.dues.length === 0) {
        twiml.message(`It looks like no one else has joined youe box yet. Use this code to have your friends join: ${box.code}`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      var others = await User.find({ box: payer.box });
      if (owers.length === 0) {
        twiml.message(`It looks like you're not in a there are no other people in your box yet.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
      }

      var dueStr = '';
      var counter = 1;
      for (var due of box.dues) {
        if (due.pair.includes(caller.number)) {
          // get indices of caller and other memeber in due key
          var splitPair = due.pair.split(':');
          var callerIndex = splitPair.findIndex((s) => s === caller.number);
          if (callerIndex === -1) continue;
          var otherIndex = callerIndex === 0 ? 1 : 0;

          var other = others.find((o) => o.number === splitPair[otherIndex]);
          if (!other) continue;

          // cases 
          // caller:other +amount
          // caller:other -amount
          // caller:other 0
          // other:caller +amount
          // other:amount -amount
          // other:amount 0

          if (callerIndex === 0 && due.amount > 0 || callerIndex === 1 && due.amount < 0) dueStr = `${dueStr}${counter}) ${other.name} owes you $${Math.abs(due.pair.amount)}\n`;
          else if (callerIndex === 0 && due.amount < 0 || callerIndex === 1 && due.amount > 0) dueStr = `${dueStr}${counter}) You owe ${other.name} $${Math.abs(due.pair.amount)}\n`;
          else dueStr = `${dueStr}${counter}) You don't owe ${other.name} anything.\n`;
        }
      }

      twiml.message(dueStr);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      return res.end(twiml.toString());
    } 

    // checking for valid transactions
    else if (!prefix.includes(command)) {
     var splitContent = content.split(' ');
     
     var amount;
     var payer;
     var box;
     var ower;
     var caller;

     // if only an amount was provided
     if (!(/\s/.test(content)) && /^\d+$/.test(content)) {
        var rawSplit = content.split('/');

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

        if (box.dues.length === 0) {
          twiml.message(`It looks like no one else has joined youe box yet. Use this code to have your friends join: ${box.code}`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }

        var owers = await User.find({ box: payer.box });
        if (owers.length === 0) {
          twiml.message(`It looks like you're not in a there are no other people in your box yet.`);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          return res.end(twiml.toString());
        }

        var amount = (parseFloat(rawSplit[0]) / owers.length).toFixed(2);

        async function recordTransaction() {
          for (var ower of owers) {
            if (ower.number === payer.number) continue; // skip over themself
 
            var direction = 1;
            var index = -1
            for (var i = 0; i < box.dues.length; i++){  
              // console.log(box.dues[i].pair, `${payer.number}:${ower.number}`);
              // console.log(box.dues[i].pair, `${ower.number}:${payer.number}`);
              if (box.dues[i].pair === `${payer.number}:${ower.number}`) index = i;
              else if (box.dues[i].pair === `${ower.number}:${payer.number}`) {
                index = i;
                direction = -1;
              }

            if (index === -1) {
              console.log('Pairing not found.');
              continue;
            }
            
            var dues = [...box.dues];
            dues[index] = { pair: box.dues[index].pair, amount: (box.dues[index].amount + (amount * direction)) };
            box.dues = dues;
            await box.save();

            var transaction = await Transaction.create({ box: box.code });
            var text = `${payer.name} payed ${amount} for ${ower.name} on ${new Date(transaction.createdAt).toLocaleString()}`;
            transaction.raw = content;
            transaction.text = text;
            await transaction.save();
            }
          }
          return;
        }

        await recordTransaction();

        twiml.message(`Transaction recorded.`);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        return res.end(twiml.toString());
     }

      // An owers name and amount was passed
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

      // a payer, a ower and an amount was passed (caller, payer, and ower must all be apart of the same room)
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
  