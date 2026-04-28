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

// routes.post("/login", async(req, res)=>{
//     const { contact, password, username } = req.body
//     const users = await Employees.findOne({
//       where: {
//         username: username
//       },
//       include:[
//         { model:Access_Levels, attributes:['access_name'], required: false }
//     ]})
//     if(users){
//       if(password==users.password){
//         const payload = { designation:users.designation, username:`${users.name}`,loginId:`${users.id}`, access:makeAccessList(users.Access_Levels)}
//         jwt.sign(payload, 'qwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm', {expiresIn:"12h"},
//           (err,token) => {
//             if(err) return res.json({message: err})
//             return res.json({
//               message:"Success",
//               token: "BearerSplit"+token
//             })
//           }
//         )
//       } else { return res.json({message:"Invalid"}) }

//     } else { return res.json({message:"Invalid"}) }
// });


// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'qwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm';

routes.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

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

    // ✅ Legacy-compatible token format
    return res.status(200).json({
      message: 'Success',
      token: 'BearerSplit' + token,
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      message: 'Internal server error',
    });
  }
});


// routes.get("/verifyLogin", verify, (req, res) => { res.json({isLoggedIn:true, username:req.body.username}) });


routes.get("/verifyLogin", verify, (req, res) => {
  req.user = req.user || { username: 'Unknown' }; // Fallback for safety
  res.json({
    isLoggedIn: true,
    username: req.user.username,
  });
});


module.exports = routes;