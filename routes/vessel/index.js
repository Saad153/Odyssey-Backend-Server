const Sequelize = require('sequelize');
const { Op } = require("sequelize");
const routes = require('express').Router();
const { Vessel } = require("../../models");
//const { Voyage } = require('./functions/Associations/vesselAssociations');
const { Voyage } = require('../../functions/Associations/vesselAssociations');

routes.post("/create", async(req, res) => {
    try {
      const value = req.body.data;
      const check = await Vessel.max("code")
      const result = await Vessel.create({...value, code:check? parseInt(check) + 1:1});
      res.json({status:'success', result:result});
    
    }
    catch (error) {
      console.log(error)
      res.json({status:'error', result:error});
    }
});

routes.get("/getVessels", async(req, res) => {
    try {
      const result = await Vessel.findAll({
        order: [['createdAt', 'DESC']]
      });
      res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/findVoyages", async(req, res) => {
  try {
    console.log(req.body)
    const result = await Voyage.findAll({
      where:{
          VesselId:req.body.id ,
      }
    });
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.post("/createVoyage", async(req, res) => {
  try {
    let data = req.body;
    delete data.id;
    const result = await Voyage.create(data);
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.post("/editVoyage", async(req, res) => {
  try {
    let data = req.body;
    const result = await Voyage.update(data,{
      where:{id:data.id}
    });
    res.json({status:'success', result:result});
  }
  catch (error) {
    console.log(error)
    res.json({status:'error', result:error});
  }
});

routes.get("/get", async(req, res) => {
    try {
      const result = await Vessel.findAll({
        order: [['createdAt', 'DESC']]
      });
      res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/edit", async(req, res) => {
    try {
      const value = req.body.data
      const exists = await Vessel.findOne({
        where:{
            id:{ [Op.ne]: req.body.data.id },
            name:{ [Op.eq]: req.body.data.name}
        }
      });
      if(exists){
          res.json({status:'exists', result:exists});
      } else {
          await Vessel.update( {...value, code : parseInt(value.code)},{
            where:{id:req.body.data.id}
          });
          const result = await Vessel.findOne({where:{id:req.body.data.id}})
          res.json({status:'success', result:result});
      }
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/uploadVoyages", async(req, res) => {
    try {
      const data = req.body
      // console.log(data)
      let Vessels = []
      for(let vessel of data){
        let temp = {
          code: parseInt(vessel.Id),
          name: vessel.VesselName,
          type: "Both",
          climaxId: parseInt(vessel.Id)
        }
        const ve = await Vessel.create(temp)
        for(let voyage of vessel.voyages){
          let temp1 = {
            voyage: voyage.VoyageNo,
            importOriginSailDate: voyage.OriginSailingDate,
            importArrivalDate: voyage.ArrivalDate,
            exportSailDate: voyage.SailingDate,
            destinationEta: voyage.DestinationETA,
            cutOffDate: voyage.CutOfDate,
            cutOffTime: voyage.CutOfTime,
            type: voyage.TypeId==3?"Export":voyage.TypeId==2?"Import":"Both",
            VesselId: ve.id,
            climaxId: voyage.Id
          }
          await Voyage.create(temp1)
        }
        Vessels.push(ve)
      }
      res.json({status:'success', result:Vessels});
    }
    catch (error) {
      console.error(error)
      res.json({status:'error', result:error});
    }
});



module.exports = routes;