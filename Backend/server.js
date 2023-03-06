const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const Datastore = require('nedb');
const axios = require('axios');
const ecashaddr = require('ecashaddrjs');

const uri = 'https://bux.digital/v1/pay/?';

const app = express();
const port = process.env.PORT || 3001;

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../Frontend')));

// Middleware to parse JSON request body
app.use(bodyParser.json());

// Connect to databases
const usersDB = new Datastore({ filename: './database/users.db', autoload: true });
const invoiceDB = new Datastore({ filename: './database/invoice.db', autoload: true });
const paidDB = new Datastore({ filename: './database/paid.db', autoload: true });

// API endpoint to handle user login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  usersDB.findOne({ username, password }, (err, user) => {
    if (err) {
      res.status(500).json({ error: 'Server error' });
    } else if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
    } else {
      const token = jwt.sign({ userId: user._id, username }, 'secret-key');
      res.json({ token });
    }
  });
});

// API endpoint to handle user sign-up
app.post('/signup', (req, res) => {
  const user = req.body;
  user.mainBalance = 0;
  user.bonusBalance = 0;

  if (user.username && user.password) {
    usersDB.findOne({ username: user.username }, (err, data) => {
      if (err) {
        res.status(500).json({ error: 'Server error' });
      } else if (data) {
        res.status(400).json({ error: 'Username already exists' });
      } else {
        usersDB.insert(user, (err, user) => {
          if (err) {
            res.status(500).json({ error: 'Server error' });
          } else {
            const token = jwt.sign({ userId: user._id, username: user.username }, 'secret-key');
            res.json({ token });
          }
        });
      }
    });
  } else {
    res.status(400).json({ error: 'Invalid username or password' });
  }
});

// API endpoint to handle protected routes
app.get('/api/protected', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  jwt.verify(token, 'secret-key', (err, decoded) => {
    if (err) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      usersDB.findOne({ _id: decoded.userId }, (err, user) => {
        if (err) {
          res.status(500).json({ error: 'Server error' });
        } else if (!user) {
          res.status(404).json({ error: 'User not found' });
        } else {
          res.json({ user });
        }
      });
    }
  });
});

// API endpoint to handle deposit requests
app.post('/deposit', async (req, res) => {
  console.log(req.body.data);
  const code = Math.random().toString(36).substring(7);
  const invoiceId = Math.random().toString(36).substring(7);
  const params = {
    merchant_name: 'iCore Pay',
    invoice: invoiceId,
    order_key: code,
    merchant_addr: req.body.data.token,
    amount: req.body.data.amount,
    success_url: 'http://44.200.51.117:3000/?success=' + req.body.data.amount,
    cancel_url: 'http://44.200.51.117:3000/?error=error',
    ipn_url: 'http://44.200.51.117:3000/ipn',
    return_json: true,
  };

  // create the invoice URI by appending the params to the base URI
  // encode the key-value pairs of the params object as query parameters
  const queryParams = Object.keys(params)
    .map((key) => {
      if (Array.isArray(params[key])) {
        return `${key}=${encodeURIComponent(JSON.stringify(params[key]))}`;
      }
      return `${key}=${encodeURIComponent(params[key])}`;
    })
    .join('&');
  // append the query parameters to the URI
  const getUrl = `${uri}${queryParams}`;

  usersDB.update(
    { username: req.body.data.user },
    {
      $inc: {
        mainBalance: parseFloat(req.body.data.amount),
        bonusBalance: 1,
      },
    },
    {},
    (err, numReplaced) => {
      if (err) {
        console.log(err);
        return;
      } else {
        console.log(`${numReplaced} document(s) updated`);
      }
    }
  );

  try {
    const response = await axios.get(getUrl, { mode: 'no-cors' });
    response.data.user = req.body.data.user;
    invoiceDB.insert(response.data);
    let payURL = response.data.paymentUrl;
    console.log(response.data)
    
    res.json({ payURL });
  } catch (error) {
    console.log(error.code);
  }
});

// async function postIpn(req, res) {
//   console.log(req.body)
//   try {
//     const ipAddress = req.connection.remoteAddress;
//     const allowIps = [
//       '::ffff:208.113.133.143',
//       '::ffff:45.79.36.250',
//       '::ffff:127.0.0.1',
//     ];
//     let isTrue = 0;

//     allowIps.forEach((ip) => {
//       if (ip === ipAddress) {
//         isTrue++;
//       }
//     });

//     if (isTrue === 0) {
//       console.log('error wrong IP Address');
//       res.status(400).send('Wrong IP Address');
//       return;
//     }

//     const ipn = req.body;
//     // const url = `https://ecash.badger.cash:8332/tx/${ipn.txn_id}?slp=true`;
//     // const result = await axios.get(url);
//     // const txData = result.data;
//     // const outputs = txData.outputs;
//     // const buxTokenId =
//     //   '7e7dacd72dcdb14e00a03dd3aff47f019ed51a6f1f4e4f532ae50692f62bc4e5';
//     // const buxDecimals = 4;
//     // const isBuxTransaction = txData.slpToken.tokenId === buxTokenId;
//     let recipientArray = [];

//     // if (isBuxTransaction) {
//     //   for (let i = 1; i < outputs.length; i++) {
//     //     const isSlpOutput = outputs[i].slp;
//     //     if (isSlpOutput) {
//     //       const buxAmount = +(outputs[i].slp.value) / 10 ** buxDecimals;
//     //       recipientArray.push({
//     //         address: convertAddress(outputs[i].address, 'etoken'),
//     //         buxAmount: buxAmount,
//     //       });
//     //     }
//     //   }
//     // }

//     // function convertAddress(address, targetPrefix) {
//     //   const { prefix, type, hash } = ecashaddr.decode(address);
//     //   if (prefix === targetPrefix) {
//     //     return address;
//     //   } else {
//     //     const convertedAddress = ecashaddr.encode(targetPrefix, type, hash);
//     //     return convertedAddress;
//     //   }
//     // }

//     // ipn.recipientArray = recipientArray;
//     // ipn.ipAddress = ipAddress;

//     invoiceDB.find({ paymentId: ipn.payment_id }, (err, docs) => {
//       if (err) {
//         console.log('Error fetching data from the database: ', err);
//         return;
//       } else if (!docs || docs.length === 0) {
//         console.log('Payment ID not found');
//         return;
//       } else {
//         paidDB.insert(ipn);
//         usersDB.update(
//           { username: docs[0].user },
//           {
//             $inc: {
//               mainBalance: parseFloat(ipn.amount1[0]),
//               bonusBalance: 1,
//             },
//           },
//           {},
//           (err, numReplaced) => {
//             if (err) {
//               console.log(err);
//               res.status(500).send('Error updating user balance');
//               return;
//             } else {
//               console.log(`${numReplaced} document(s) updated`);
//               res.send('OK');
//             }
//           }
//         );
//       }
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal Server Error');
//   }
// }

function postIpn(req, res) {
  console.log(req.body);
  res.send('Received POST request');
}

// API endpoint to handle IPN requests
app.post('/ipn', postIpn);

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
