const { Op } = require("sequelize");
const routes = require('express').Router();
const { Commodity } = require("../../models");
const { createHistory } = require('../../functions/history');

routes.post("/create", async(req, res) => {
    let tempData = {...req.body.data};
    delete tempData.isHazmat;
    tempData.isHazmat = req.body.data.isHazmat.length>0?1:0;
    try {
      const result = await Commodity.create(tempData);
      createHistory(req.body.employeeId, 'Commodity', 'Create', result.name);
      res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/get", async(req, res) => {
    try {
      const result = await Commodity.findAll({
        order: [['createdAt', 'DESC']]
      });
      res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/edit", async(req, res) => {
    let tempData = {...req.body.data};
    delete tempData.isHazmat;
    tempData.isHazmat = req.body.data.isHazmat.length>0?1:0;
    try {
      await Commodity.update(tempData,{
        where:{id:tempData.id}
      });
      const result = await Commodity.findOne({where:{id:tempData.id}})
      createHistory(req.body.employeeId, 'Commodity', 'Edit', result.name);
      res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/uploadCommodities", async (req, res) => {
  let  i = 0
    try{
        console.log(req.body.Commodities.length)
        for(let c of req.body.Commodities){
          i++
            await Commodity.create({
              name: c.HsDescription,
              hs: c.HsCode,
              cargoType: '',
              commodityGroup: '',
              isHazmat: '',
              packageGroup: '',
              hazmatCode: '',
              hazmatClass: '',
              chemicalName: '',
              unoCode: '',
              active: '',
              climaxId: c.HsCode
            })
        }
        res.status(200).json({status:'success'});
    }catch(e){
        console.error(e)
        console.error(i)
        res.status(400).json({status:'error', result:e});
    }
})

module.exports = routes;