const { Charges } = require("../../models");
const routes = require('express').Router();
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

routes.post("/create", async(req, res) => {
    try {
      // console.log(req.body.data)
      let data = req.body.data
      delete data.id
      console.log("check 1")
      const check = await Charges.max("code")
      console.log("check 2")
      console.log("Check",check)
      console.log("Data Code",data)
      let code  = 1
      check?code = parseInt(check)+1:null
      console.log("Code",code)
      // let exists = false
      // data.code? exists = await Charges.findOne({
        //     where:{code:data.code}
        // }):null
        // console.log("Exists",exists)
        // if(exists){
          //     res.json({status:'exists'});
          // } else {
            const result = await Charges.create({...data, code:code});
        console.log("check 3")
        console.log(result)
        res.json({status:'success', result:result })
      // }
    }
    catch (error) {
      console.log(error)
      res.json({status:'error', result:error});
    }
});

routes.post("/edit", async(req, res) => {
  console.log(req.body)
  let tempData = {...req.body.data};
  try {
    const exists = await Charges.findOne({
      where:{
        id:{ [Op.ne]: tempData.id },
        code:{ [Op.eq]: tempData.code}
      }
    });
    if(exists){
      res.json({status:'exists'});
    } else {
      await Charges.update(tempData,{
        where:{id:tempData.id}
      });
      const result = await Charges.findOne({where:{id:tempData.id}})
      res.json({status:'success', result:result});
    }
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

//getAllCharges
routes.get("/get", async(req, res) => {
  try {
    const result = await Charges.findAll();
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.post("/bulkCreate", async(req, res) => {
  try {
    // console.log(req.body)
    let data = req.body
    await Charges.bulkCreate(data);
    res.json({status:'success' })
  }
  catch (error) {
    console.log(error)
    res.json({status:'error', result:error});
  }
});

module.exports = routes;