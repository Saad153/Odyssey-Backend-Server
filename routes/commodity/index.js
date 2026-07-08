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
      console.error(error)
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
      console.error(error)
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
        for(let c of req.body.Commodities){
          i++
            await Commodity.create({
              name: c.CommodityName,
              hs: c.HSCode,
              cargoType: 'GL',
              commodityGroup: '',
              isHazmat: c.IsHazmatProduct,
              packageGroup: '',
              hazmatCode: c.HazmatCode,
              hazmatClass: '',
              chemicalName: c.CommonChemicalName,
              unoCode: c.UNOCode,
              active: '',
              climaxId: c.Id
            })
        }
        res.status(200).json({status:'success'});
    }catch(e){
        console.error(e)
        console.error(i)
        res.status(400).json({status:'error', result:e});
    }
})

routes.post("/updateCommodity", async (req, res) => {
  try{
    const {Id, CommodityName} = req.body;
    const [affected] = await Commodity.update(
      {
        climaxId: Id
      },
      {
        where: { name: CommodityName },
      }
    );
    res.status(200).json({status:'success', result:affected});
  }catch(e){
    console.error(e)
    res.status(400).json({status:'error', result:e});
  }
})

module.exports = routes;