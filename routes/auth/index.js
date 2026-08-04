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

const { JWT_SECRET } = require('../../functions/secrets');

const sessionManager = require('../../functions/sessionManager');
const { createHistory, getClientIp } = require('../../functions/history');
const { isBcryptHash, hashPassword, verifyPassword } = require('../../functions/password');

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

    const validPassword = await verifyPassword(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Opportunistic migration: existing rows still hold plaintext passwords.
    // The first time one of those verifies successfully, upgrade it to a
    // bcrypt hash so plaintext never has to be re-compared (or re-stored)
    // again for that account - no bulk migration step needed.
    if (!isBcryptHash(user.password)) {
      await user.update({ password: await hashPassword(password) });
    }

    // ✅ Minimal, efficient payload
    const payload = {
      id: user.id,
      username: user.name,
      designation: user.designation,
      access: makeAccessList(user.Access_Levels),
      defaultCompanyId: user.defaultCompanyId,
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
    const clientIp = getClientIp(req);
    await createHistory(user.id, 'login', `User ${user.username} logged in.`, `IP: ${clientIp}`);
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


// No longer in index.js's PUBLIC_PATHS, so the global `verify` middleware
// already ran before this handler and would have responded 401 itself for
// a missing/invalid/expired token - reaching here means req.user is real.
routes.get("/verifyLogin", (req, res) => {
  res.json({
    isLoggedIn: true,
    username: req.user.username,
  });
});

// Logout clears the stored session for the authenticated user
routes.post('/logout', async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  sessionManager.clearSession(req.user.id);
  await createHistory(req.user.id, 'logout', `User ${req.user.username} logged out.`);
  return res.json({ message: 'Logged out' });
});


module.exports = routes;
