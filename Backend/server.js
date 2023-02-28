const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const Datastore = require('nedb');
const axios = require('axios')
const uri = 'https://bux.digital/v1/pay/?';
const ecashaddr = require('ecashaddrjs');
const app = express();


const usersDB = new Datastore({ filename: './database/users.db', autoload: true });
const invoiceDB = new Datastore({ filename: './database/invoice.db', autoload: true });
const paidDB = new Datastore({ filename: './database/paid.db', autoload: true });

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../Frontend')));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

app.post('/login', (req, res) => {
  console.log(true)
  // Get the email and password from the request body
  const { username, password } = req.body;

  // Find the user in the database
  usersDB.findOne({ username, password }, (err, user) => {
    if (err) {
      // Return an error message if there's an error with the database
      res.status(500).json({ error: 'Server error' });
    } else if (!user) {
      // Return an error message if the username or password is incorrect
      res.status(401).json({ error: 'Invalid username or password' });
    } else {
      // Generate a JWT token with a payload that includes the user's ID and username
      const token = jwt.sign({ userId: user._id, username }, 'secret-key');

      // Return the token as part of the response
      res.json({ token });
    }
  });
});

// Route that handles sign-up requests
app.post('/signup', (req, res) => {
  // Get the username and password from the request body
  const user = req.body;
  user.mainBalance = 0;
  user.bonusBalance = 0;
  console.log(user)
  const username = user.username;

  // Check if the username and password are valid
  // You can use a database to verify the user's credentials and prevent duplicate usernames
  if (user.username && user.password) {
    // Check if the username already exists in the database
    usersDB.findOne({ username }, (err, data) => {
      if (err) {
        // Return an error message if there's an error with the database
        res.status(500).json({ error: 'Server error' });
      } else if (data) {
        // Return an error message if the username already exists
        res.status(400).json({ error: 'Username already exists' });
      } else {
        usersDB.insert(user, (err, user) => {
          if (err) {
            // Return an error message if there's an error with the database
            res.status(500).json({ error: 'Server error' });
          } else {
            // Generate a JWT token with a payload that includes the user's ID and username
            const token = jwt.sign({ userId: user._id, username }, 'secret-key');

            // Return the token as part of the response
            res.json({ token });
          }
        });
      }
    });
  } else {
    // Return an error message if the sign-up fails
    res.status(400).json({ error: 'Invalid username or password' });
  }
});

// Protected route that requires authentication
app.get('/api/protected', (req, res) => {
  // Get the token from the request headers
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  // Verify the token
  jwt.verify(token, 'secret-key', (err, decoded) => {
    if (err) {
      // Return an error message if the token is invalid
      res.status(401).json({ error: 'Invalid token' });
    } else {
      // Return some protected data if the token is valid
      console.log(decoded.userId)
      usersDB.findOne({ _id: decoded.userId }, (err, user) => {
        if (err) {
          // Return an error message if there's an error with the database
          res.status(500).json({ error: 'Server error' });
        } else if (!user) {
          // Return an error message if the user is not found
          res.status(404).json({ error: 'User not found' });
        } else {
          // Return the user's information as part of the response
          console.log(user)
          res.json({ user });
        }
      })
    }
  });
});

app.post('/deposit', async (req, res) => {
  console.log(req.body)


  const code = Math.random().toString(36).substring(7);
  const invoiceId = Math.random().toString(36).substring(7);
  const params = {
    merchant_name: 'iCore Pay',
    invoice: invoiceId,
    order_key: code,
    merchant_addr: 'etoken:qp483wunuvy7nnnv5fr2ev8d60q9ras0yvz9ct0gzz',
    amount: req.body.amount,
    success_url: 'http://44.200.51.117:3000/',
    cancel_url: 'http://44.200.51.117:3000/',
    ipn_url: 'http://44.200.51.117:3000/ipn',
    return_json: true
  };
  console.log(params);

  // create the invoice URI by appending the params to the base URI
  // encode the key-value pairs of the params object as query parameters
  const queryParams = Object.keys(params).map((key) => {
    if (Array.isArray(params[key])) {
      return `${key}=${encodeURIComponent(JSON.stringify(params[key]))}`;
    }
    return `${key}=${encodeURIComponent(params[key])}`;
  }).join('&');
  // append the query parameters to the URI
  const getUrl = `${uri}${queryParams}`;
  console.log('url', getUrl);

  try {
    const response = await axios.get(getUrl, { mode: 'no-cors' });
    console.log(response.data);
    response.data.user = req.body.user
    invoiceDB.insert(response.data)
    let payURL = response.data.paymentUrl;
    res.json({ payURL });
  } catch (error) {
    console.log(error.code);
  }
})

async function postIpn(req, res) {
  const ipAddress = req.connection.remoteAddress;
  console.log("IP Address: ", ipAddress);
  const allowIps = [
    '::ffff:208.113.133.143',
    '::ffff:45.79.36.250',
    '::ffff:127.0.0.1'
  ]
  let isTrue = 0
  allowIps.map(ip => {
    if (ip === ipAddress) {
      isTrue++
    }
  })
  if (isTrue === 0) {
    console.log('error wrong IP Address')
  } else {
    const ipn = req.body;
    console.log('IPN: ', ipn)
    const url = `https://ecash.badger.cash:8332/tx/${ipn.txn_id}?slp=true`;
    const result = await axios.get(url);
    const txData = result.data;
    const outputs = txData.outputs;
    const buxTokenId = "7e7dacd72dcdb14e00a03dd3aff47f019ed51a6f1f4e4f532ae50692f62bc4e5";
    const buxDecimals = 4;
    const isBuxTransaction = txData.slpToken.tokenId === buxTokenId;
    let recipientArray = [];
    if (isBuxTransaction) {
      for (let i = 1; i < outputs.length; i++) {
        const isSlpOutput = outputs[i].slp;
        if (isSlpOutput) {
          const buxAmount = +(outputs[i].slp.value) / 10 ** buxDecimals;
          recipientArray.push({
            address: convertAddress(outputs[i].address, "etoken"),
            buxAmount: buxAmount
          });
        }
      }
    }

    // function returns address with desired prefix
    function convertAddress(address, targetPrefix) {
      const { prefix, type, hash } = ecashaddr.decode(address);
      if (prefix === targetPrefix) {
        return address;
      } else {
        const convertedAddress = ecashaddr.encode(targetPrefix, type, hash);
        return convertedAddress;
      }
    };

    ipn.recipientArray = recipientArray;
    ipn.ipAddress = ipAddress;
    // validate that transaction settles new order
    invoiceDB.find({ paymentId: ipn.payment_id }, (err, docs) => {
      if (err) {
        // Error message if the paymentID doesn't match
        console.log("Error fetching data from the database: ", err);
      } else {
        paidDB.insert(ipn)
        console.log(ipn.amount1[0])
        usersDB.update({ username: docs[0].user }, { $inc: { mainBalance: 1, bonusBalance: 2 } }, {}, function (err, numReplaced) {
          if (err) {
            // Handle error
            console.log(err);
          } else {
            console.log(`${numReplaced} document(s) updated`);
          }
        });
      }
    });

    // Send a response
    res.send("OK");
  }
}

app.post("/ipn", postIpn);
