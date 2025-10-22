const {Manifest_Jobs, Manifest} = require('../../functions/Associations/jobAssociations/seaExport') 
const routes = require('express').Router();
const Sequelize = require('sequelize');
const moment = require("moment");
const Op = Sequelize.Op;

routes.post("/create", async(req, res) => {
    const createEquip = (list, id) => {
        let result = [];
        list.forEach((x)=>{
                delete x.id
                let SEJobId = x?.awb.split(',')[1]
                let awb = x?.awb.split(',')[0]
                result.push({...x, ManifestId : id, SEJobId, awb})
        })
        return result;
    }

    try {
        let data = req.body
        delete data.id
        const check = await Manifest.findOne({order: [ [ 'no', 'DESC' ]], attributes:["no"]})
        .catch((e) => console.log(e));
        const result = await Manifest.create({
        ...data,
        no:check==null?1:parseInt(check.dataValues.no)+1,
        job_no:`${"MNS"}-${check==null?1:parseInt(check.dataValues.no)+1}/${moment().format("YY")}`
        }).catch((x)=>console.log(x.message))
       await Manifest_Jobs.bulkCreate(createEquip(data.Manifest_Jobs, result.id)).catch((x)=>console.log(x))
        res.json({status:'success', result: result});
    }
    catch (error) {
      res.json({status:'error', result:error.message});
    }
});

routes.post("/edit", async(req, res) => {

    try {
        let data = req.body
        const result = await Manifest.update( {...data},{
            where:{id: data.id}
          }).catch((x)=>console.log(x.message))
          data.Manifest_Jobs.forEach((x) => {
            return Manifest_Jobs.upsert({ ...x}) 
          })
        res.json({status:'success', result: result});
    }
    catch (error) {
      res.json({status:'error', result:error.message});
    }
});

routes.get('/get', async (req, res) =>{
    try{
    const result = await Manifest.findOne({where:{id: req.headers.id}, 
    include:[{model: Manifest_Jobs}]})
    res.json({status:"success", result:result})        
    }
    catch (error) {
    res.json({status:"error", result:error.message})        
    }
})

routes.get('/getAll', async (req, res) =>{
  try {
    const result = await Manifest.findAll({
      order: [[ 'createdAt', 'DESC' ]]
    })
    res.json({status:"success", result:result})        
  } catch (error) {
    res.json({status:"error", result:error.message})        
  }
})

routes.get('/searchJobs', async (req, res) => {
  let obj = {
    date: {
      [Op.gte]: moment(req.headers.from).toDate(),
      [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
    }
  }
  if(req.headers.flight){ obj.flight_no=req.headers.flight }
  try{
    const result = await Manifest.findAll({
      where:obj,
      order: [[ 'createdAt', 'ASC' ]]
    })
    res.json({status:"success", result:result})        
  }
  catch (error) {
    res.json({status:"error", result:error.message})        
  }
})

module.exports = routes