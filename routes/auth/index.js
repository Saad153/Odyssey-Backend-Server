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

routes.post("/login", async(req, res)=>{
    const { contact, password, username } = req.body
    const users = await Employees.findOne({
      // where:{ [Op.or]: [{username: username}, {contact:contact}] }, 
      where: {
        username: username
      },
      include:[
        { model:Access_Levels, attributes:['access_name'], required: false }
    ]})
    console.log(username, password)
    console.log(users)
    if(users){
      if(password==users.password){
        const payload = { designation:users.designation, username:`${users.name}`,loginId:`${users.id}`, access:makeAccessList(users.Access_Levels)}
        jwt.sign(payload, 'qwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm', {expiresIn:"12h"},
          (err,token) => {
            if(err) return res.json({message: err})
            return res.json({
              message:"Success",
              token: "BearerSplit"+token
            })
          }
        )
      } else { return res.json({message:"Invalid"}) }

    } else { return res.json({message:"Invalid"}) }
});

routes.get("/verifyLogin", verify, (req, res) => { res.json({isLoggedIn:true, username:req.body.username}) });

module.exports = routes;