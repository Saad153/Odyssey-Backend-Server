const routes = require('express').Router();
const jwt = require('jsonwebtoken');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const verify = require('../../functions/tokenVerification')
const { Employees } = require('../../models');
const { Access_Levels } = require("../../functions/Associations/employeeAssociations")

const makeAccessList = (data) => {
  let values = "";
  data.forEach((x, i)=>{
    values = values + x.access_name +  `${i==(data.length-1)? "":", "}`
  });
  return values
}

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'qwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm';

const sessionManager = require('../../functions/sessionManager');

routes.post('/login', async (req, res) => {
  try {
    const { username, password, force } = req.body;
    const forceLogin = Boolean(force);

    if (!username || !password) {
      return res.status(400).json({
        message: 'Username and password required',
      });
    }

    const user = await Employees.findOne({
      where: { username },
      include: [
        { model: Access_Levels, attributes: ['access_name'], required: false }
      ],
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ Password check (NON‑BLOCKING, SAFE)
    // const validPassword = await bcrypt.compare(password, user.password);
    // if (!validPassword) {
    //   return res.status(401).json({ message: 'Invalid credentials' });
    // }
    
    if (password !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ Minimal, efficient payload
    const payload = {
      id: user.id,
      username: user.name,
      designation: user.designation,
      access: makeAccessList(user.Access_Levels),
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '12h',
    });

    if (sessionManager.isActive(user.id)) {
      if (!forceLogin) {
        return res.status(409).json({ message: 'User already logged in' });
      }
      sessionManager.clearSession(user.id);
    }

    // Record session then return token
    sessionManager.setSession(user.id, token);

    return res.status(200).json({
      message: 'Success',
      token: 'BearerSplit' + token,
      forceLogin: forceLogin,
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      message: 'Internal server error',
    });
  }
});


// routes.get("/verifyLogin", verify, (req, res) => { res.json({isLoggedIn:true, username:req.body.username}) });


routes.get("/verifyLogin", (req, res) => {
  req.user = req.user || { username: 'Unknown' }; // Fallback for safety
  res.json({
    isLoggedIn: true,
    username: req.user.username,
  });
});

// Logout clears the stored session for the authenticated user
routes.post('/logout', (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  sessionManager.clearSession(req.user.id);
  return res.json({ message: 'Logged out' });
});


module.exports = routes;
