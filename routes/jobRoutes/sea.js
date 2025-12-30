const { 
  SE_Job, SE_Equipments, Container_Info,  
  Stamps, Job_notes, Loading_Program, Bl,
  Delivery_Order, Item_Details, Dimensions,
} = require("../../functions/Associations/jobAssociations/seaExport");
const { Charge_Head } = require("../../functions/Associations/incoiceAssociations");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { Vouchers, Voucher_Heads, Office_Vouchers } = require("../../functions/Associations/voucherAssociations");
const { Employees } = require("../../functions/Associations/employeeAssociations");
// const { Vendors, Vendor_Associations } = require("../../functions/Associations/vendorAssociations");
const { Clients, Client_Associations } = require("../../functions/Associations/clientAssociation");
const { Voyage } = require("../../functions/Associations/vesselAssociations");
const { Commodity, Vessel, Charges, Invoice }=require("../../models");
const routes = require('express').Router();
const Sequelize = require('sequelize');
const moment = require("moment");
const { format } = require("morgan");
const Op = Sequelize.Op;

const getJob = (id) => {
  const finalResult = SE_Job.findOne({
    where:{id:id},
    include:[
      { model:SE_Equipments },
      { model:Clients, attributes:['name'] }
    ]
  })
  return finalResult 
}

routes.get("/getJobNumbers", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    const whereCondition = search
      ? {
          [Op.or]: [
            { jobNo: { [Op.iLike]: `%${search}%` } },
            { '$Client.name$': { [Op.iLike]: `%${search}%` } },
            { '$consignee.name$': { [Op.iLike]: `%${search}%` } },
            { '$Bl.hbl$': { [Op.iLike]: `%${search}%` } },
            { '$Bl.mbl$': { [Op.iLike]: `%${search}%` } }
          ]
        }
      : {};

    const { rows, count } = await SE_Job.findAndCountAll({
      attributes: ['id', 'jobNo', 'fileNo'],
      where: whereCondition,
      distinct: true,
      limit,
      offset,
      order: [['id', 'DESC']],
      include: [
        {
          model: Clients,
          attributes: ['name'],
          required: false
        },
        {
          model: Clients,
          as: 'consignee',
          attributes: ['name'],
          required: false
        },
        {
          model: Bl,
          attributes: ['hbl', 'mbl'],
          required: false
        }
      ]
    });

    res.json({
      status: 'success',
      data: rows,
      pagination: {
        totalRecords: count,
        currentPage: page,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

routes.get("/getValues", async(req, res) => {
  console.log("============Request Made=====================")
  let makeResult = (result, resultTwo) => {
    let finalResult = {shipper:[], consignee:[], notify:[], client:[], sLine:[]};
    result.forEach((x) => {
      if(x.types.includes('Shipper')){
        finalResult.shipper.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
      if(x.types.includes('Consignee')){
        finalResult.consignee.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
      if(x.types.includes('Notify')){
        finalResult.notify.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
      if(x.types.includes('Shipping Line')){
        // console.log(x)
        finalResult.sLine.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
    })
    let tempClient = [];
    // console.log(resultTwo.length)
    resultTwo.forEach((x)=>{
      if(x.nongl!='1'){
        tempClient.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
    })
    finalResult.client = tempClient;
    // finalResult.client = resultTwo.map((x)=>{
    //     return {name:`${x.name} (${x.code})`, id:x.id, types:x.types}
    // });
    return finalResult
  };

  let makeResultTwo = (result) => {
    console.log(result.length)
    let finalResult = { transporter:[], forwarder:[], overseasAgent:[], localVendor:[], chaChb:[], sLine:[], airLine:[] };
    result.forEach((x) => {
      if(x.types.includes('Air Line')){
        finalResult.airLine.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
      if(x.types.includes('Transporter')){
        finalResult.transporter.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
      if(x.types.includes('Forwarder/Coloader')){
        finalResult.forwarder.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
      if(x.types.includes('Overseas Agent')){
        finalResult.overseasAgent.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
      if(x.types.includes('CHA/CHB')){
        finalResult.chaChb.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
      if(x.types.includes('Local Vendor') && x.nongl!='1'){
        finalResult.localVendor.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
      if(x.types.includes('Shipping Line')){
        finalResult.sLine.push({name:`${x.name} (${x.code})`, id:x.id, types:x.types})
      }
    })
    return finalResult
  };

  try {
    const resultOne = await Clients.findAll({ 
      where:{
        active:true
      },
      attributes:['id','name', 'types', 'code', 'nongl'],
      order: [['createdAt', 'DESC']]
    })
    const result = await Clients.findAll({ 
      where: {
        types: {
          [Op.or]:[
            { [Op.substring]: 'Shipper' },
            { [Op.substring]: 'Consignee' },
            { [Op.substring]: 'Shipping Line' },
            { [Op.substring]: 'Notify' }]
        },
        active:true
      },
      attributes:['id','name', 'types', 'code'],
      order: [['createdAt', 'DESC']]
    })
    const resultThree = await Clients.findAll({ 
      where: {
        types: {
          [Op.or]:[
            { [Op.substring]: 'Transporter' },
            { [Op.substring]: 'Forwarder/Coloader' },
            { [Op.substring]: 'Local Vendor' },
            { [Op.substring]: 'CHA/CHB' },
            { [Op.substring]: 'Overseas Agent' },
            { [Op.substring]: 'Air Line' },
            { [Op.substring]: 'Shipping Line' }
          ]
        },
        active:true
      },
      attributes:['id','name', 'types', 'code', 'nongl'],
      order: [['createdAt', 'DESC']]
    })
    let tempCommodity = [];
    const resultTwo = await Commodity.findAll({
      order: [['createdAt', 'DESC']],
      attributes:['id','name', 'hs']
    });
    await resultTwo.forEach((x)=>{
      if(x.hs){
        tempCommodity.push({...x.dataValues, name:`${x.dataValues.name} (${x.dataValues.hs})`})
      } else {
        tempCommodity.push(x.dataValues)
      }
    })
    const resultFour = await Vessel.findAll({
      order: [['createdAt', 'DESC']],
      attributes:['id', 'name', 'code', 'carrier'],
      include:[{
          model:Voyage
      }]
    });
    const Sr = await Employees.findAll({where:{represent: {[Op.substring]: 'sr'} }, attributes:['id', 'name']});
    let tempChargeList = [];
    const charges = await Charges.findAll({});
    await charges.forEach((x) => {
      tempChargeList.push({...x.dataValues, label:`(${x.dataValues.code}) ${x.dataValues.short}`, value:x.dataValues.code});
    });
    // console.log(result.dataValues)
    let temp = result.filter(x => x.types.includes('Shipping Line'));
    res.json({
      status:'success',
      result:{
        res: temp,
        party:makeResult(result, resultOne),
        vendor:makeResultTwo(resultThree),
        commodity:tempCommodity,
        vessel:resultFour,
        sr:Sr,
        chargeList:tempChargeList
      }
    });
  }
  catch (error) {
    console.error(error)
    res.json({status:'error', result:error});
  }
});

routes.post("/getNotes", async(req, res) => {
  try {
    const result = await Job_notes.findAll({
      where:{type: req.body.type, recordId:req.body.id},
      order:[["createdAt", "DESC"]],
    });
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getAllNotes", async(req, res) => {
  try {
    const result = await Job_notes.findAll({
      // where:{type:"SE", recordId:req.body.id},
      order:[["createdAt", "DESC"]],
    });
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.post('/updateNotes', async(req, res) => {
  try {
    const result =  await Job_notes.update({opened : req.body.data.opened}, 
    {where : {recordId : req.body.data.recordId}})
    res.json({ status: "success", result:result})
  }
  catch (err) {
    res.json({ status: "error", result:err.message})
  }
});

routes.post("/addNote", async(req, res) => {
  try {
      const result = await Job_notes.create(req.body);
      res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.post("/create", async(req, res) => {

  const createEquip = (list, id) => {
    let result = [];
    list.forEach((x) => {
      if(x.size!=''&&x.qty!='', x.dg!='', x.teu!=''){
        delete x.id
        result.push({...x, SEJobId:id, teu:`${x.teu}`})
      }
    })
    return result;
  }
  try {

    let data = req.body.data
    delete data.id
    data.customCheck = data.customCheck.toString();
    data.transportCheck = data.transportCheck.toString();
    if(data.operation=="AE"||data.operation=="AI"){
      data.vesselId = null
      data.subType = "AIR"

    } else {
      data.airLineId=null
    }
    // console.log("Data Operation:",data.operation)
    // const check = await SE_Job.findOne({
    //   order:[['jobId','DESC']], attributes:["jobId"],
    //   where:{operation:data.operation, companyId:data.companyId.toString()}
    // });
    const check = await SE_Job.findOne({
      order: [['jobId', 'DESC']],
      attributes: ['jobId'],
      where: {
        operation: data.operation,
        companyId: data.companyId.toString(),
        jobNo: {
          [Op.like]: '%/26'
        }
      }
    });
    console.log(data)
    const result = await SE_Job.create({
      ...data,
      jobId:check==null?1:parseInt(check.jobId)+1,
      jobNo:`${data.companyId=="1"?"SNS":data.companyId=="2"?"CLS":"ACS"}-${data.operation}${data.operation=="SE"?"J":data.operation=="SI"?"J":""}-${check==null?1:parseInt(check.jobId)+1}/26`
    }).catch((x)=>console.log(x.message))
    await SE_Equipments.bulkCreate(createEquip(data.equipments,  result.id)).catch((x)=>console.log(x))
    res.json({status:'success', result:await getJob(result.id)});
  }
  catch (error) {
    console.error(error)
    res.json({status:'error', result:error});
  }
});

// routes.post("/edit", async(req, res) => {
//     const createEquip = (list, id) => {
//         let result = [];
//         list.forEach((x)=>{
//             if(x.size!=''&&x.qty!='', x.dg!='', x.teu!=''){
//                 delete x.id
//                 result.push({...x, SEJobId:id, teu:`${x.teu}`})
//             }
//         })
//         return result;
//     }
//     try {
//         let data = req.body.data
//         data.customCheck = data.customCheck.toString();
//         data.transportCheck = data.transportCheck.toString();
//         data.approved = data.approved.toString();
//         const check = await SE_Job.findOne({
//           where: {
//             id: data.id
//           }
//         })
//         if(check.dataValues.approved){
//           res.json({status:'approved', result:await getJob(data.id)});
//         }
//         await SE_Job.update(data,{where:{id:data.id}}).catch((x)=>console.log(1));
//         await SE_Equipments.destroy({where:{SEJobId:data.id}}).catch((x)=>console.log(2))
//         await SE_Equipments.bulkCreate(createEquip(data.equipments, data.id)).catch((x)=>console.log(x))
//         res.json({status:'success', result:await getJob(data.id)});
//     }  
//     catch (error) {
//         console.log(error)
//       res.json({status:'error', result:error.message});
//     }
// });

routes.post("/edit", async (req, res) => {
  const createEquip = (list, id) => {
    let result = [];
    list.forEach((x) => {
      if (x.size != "" && x.qty != "" && x.dg != "" && x.teu != "") {
        delete x.id;
        result.push({ ...x, SEJobId: id, teu: `${x.teu}` });
      }
    });
    return result;
  };

  try {
    let data = req.body.data;
    data.customCheck = data.customCheck.toString();
    data.transportCheck = data.transportCheck.toString();
    data.approved = data.approved.toString();

    const check = await SE_Job.findOne({
      where: {
        id: data.id,
      },
    });
    console.log("Data Approved: ", data.approved)
    // if (check.dataValues.approved == 'true') {
    //   return res.json({ status: "approved", result: await getJob(data.id) });
    // }

    await SE_Job.update(data, { where: { id: data.id } }).catch((x) => console.log(1));
    await SE_Equipments.destroy({ where: { SEJobId: data.id } }).catch((x) => console.log(2));
    await SE_Equipments.bulkCreate(createEquip(data.equipments, data.id)).catch((x) => console.log(x));

    return res.json({ status: "success", result: await getJob(data.id) });

  } catch (error) {
    console.log(error);
    return res.json({ status: "error", result: error.message });
  }
});

routes.get("/get", async(req, res) => {
  try {
    // console.log(req.headers)
    const result = await SE_Job.findAll({
      where:{
        companyId:req.headers.companyid,
        operation:req.headers.operation
      },
      include:[
        //{model:Voyage},
        {model:Employees, as:'created_by', attributes:['name'] },
        {
          model:Bl,
          attributes:['hbl', 'mbl']
        },
        {
          model:Clients,
          attributes:['name']
        }
      ],
      attributes:['id', 'createdAt','approved', 'jobNo', 'nomination', 'freightType', 'pol', 'pod', 'fd', 'weight', 'transportCheck', 'customCheck'],
      order:[["createdAt", "DESC"]],
    }).catch((x)=>console.log(x))
    // console.log(result)
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getJobById", async(req, res) => {
    try {
        const result = await SE_Job.findOne({
          where:{id:req.headers.id},
          include:[
            {
              model:SE_Equipments
            },
            {
              model:Clients,
              attributes:['name']
            }
          ],
          order:[["createdAt", "DESC"]],
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getSEJobIds", async(req, res) => {
    try {
      const result = await SE_Job.findAll({
        attributes:['id']
      });
      res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getSEJobById", async(req, res) => {
    try {
      const result = await SE_Job.findOne({
        where:{id:req.headers.id},
        include:[
          {model:Bl, attributes:['id', 'hbl', 'hblDate', 'mbl', 'mblDate']},
          {model:Voyage},
          {model:SE_Equipments},
          {
            model:Clients,
            attributes:['name']
          }
        ],
        order:[["createdAt", "DESC"]],
      });
      res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getJobsWithoutBl", async(req, res) => {

  const attr = [
    'name', 'address1', 'address1', 'person1', 'mobile1',
    'person2', 'mobile2', 'telephone1', 'telephone2', 'infoMail'
  ];

  try {
  const result = await SE_Job.findAll({
    where:{id:req.headers.id},
    attributes:[
      'id', 'jobNo', 'pol',
      'pod', 'fd', 'jobDate',
      'shipDate', 'cutOffDate',
      'delivery', 'freightType',
      'operation', 'flightNo','VoyageId',
      'cwtLine', 'cwtClient', 'weight', 'pcs'
    ],
    order:[["createdAt", "DESC"]],
    include:[
      {
        model:Bl,
        required: false,
      },
      { model:SE_Equipments, attributes:['qty', 'size'] },
      { model:Clients,  attributes:attr },
      { model:Clients, as:'consignee', attributes:attr },
      { model:Clients, as:'shipper', attributes:attr },
      { model:Clients, as:'overseas_agent', attributes:attr },
      { model:Commodity, as:'commodity' },
      { model:Vessel, as:'vessel', attributes:['name'] },
      { model:Clients, as:'air_line', attributes:['name'] },
      { model:Clients, as:'shipping_line', attributes:['name'] },
      { model:Voyage, attributes:['voyage'] },
    ],
  });
  res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.post("/createBl", async(req, res) => {
  try {
    let data = req.body;
    delete data.id;
    const check = await Bl.findOne({
      where:{ mbl: data.mbl },
      attributes:["mbl", "hbl", "SEJobId"] 
    });
    // console.log(check.dataValues)
    if (!check){
      let obj = {
        pkgUnit:data.unit, 
        pcs:data.pkgs, 
        weightUnit:data.wtUnit, 
        vol:data.cbm, 
        shpVol:data.cbm,
        weight:data.gross,
        cwtClient:data.chargableWt
      }
      if(data.operation=="SI" || data.operation=="AI" || data.operation=="SE"){

        // console.log("Here")
        await SE_Job.update({
          ...obj
        }, {where:{id:data.SEJobId}});
      }
      const result = await Bl.create({...data,
      }).catch((x)=>console.log(x))
      // Creating Items for AE
      if(data.Item_Details.length>0){
        let tempItems = [];
        data.Item_Details.forEach((x)=>{
          x.id==null?delete x.id:null;
          tempItems.push({...x, BlId:result.id})
        })
        await Item_Details.bulkCreate(tempItems)
      }
      await data.Container_Infos.forEach((x, i)=>{
        data.Container_Infos[i] = {...x, BlId:result.id}
      })
      await Container_Info.bulkCreate(data.Container_Infos).catch((x)=>console.log(x))
      if(data.Dimensions.length>0){
        data.Dimensions.forEach((x, i)=>{
          x.id==null?delete x.id:null;
          data.Dimensions[i] = {...x, BlId:result.id}
        })
        await Dimensions.bulkCreate(data.Dimensions).catch((x)=>console.log(x))
      }
      res.json({status:'success', result:result.id });
    }else {
      console.log("Job ID:", check.dataValues.SEJobId)
      const job = await SE_Job.findOne({
        where: {
          id: check.dataValues.SEJobId
        },
        attributes:["jobNo"]
      })
      console.log(job.dataValues)
      res.json({status:'warning', result:`Mbl or Hbl Already Exists in Job: ${job.dataValues.jobNo}` });
    }
  }
  catch (error) {
    console.error(error)
    res.json({status:'error', result:error});
  }
});

routes.post("/editBl", async(req, res) => {
  try {
    let data = req.body;
    let obj = {
      pkgUnit:data.unit, 
      pcs:data.pkgs, 
      weightUnit:data.wtUnit, 
      vol:data.cbm, 
      shpVol:data.cbm,
      weight:data.gross,
      cwtClient:data.chargableWt
    };
    if(data.operation=="SI" || data.operation=="AI" || data.operation=="SE"){
      await SE_Job.update({
        ...obj
      }, {where:{id:data.SEJobId}});
    };
    await Bl.update(data, {where:{id:data.id}});
    data.Container_Infos.forEach((x, i)=>{
      data.Container_Infos[i] = {
        ...x, BlId:data.id, 
        pkgs:x.pkgs.toString(),
        gross:x.gross.toString(),
        net:x.net.toString(),
        tare:x.tare.toString(),
        cbm:x.cbm?.toString(),
      }
    });
    const result = await Container_Info.bulkCreate(data.Container_Infos,{
      updateOnDuplicate: [
        "pkgs", "no", "seal", "size", "rategroup", "gross", "net", "tare", "wtUnit", "cbm", "pkgs", "unit", "temp", "loadType", "remarks", "detention",  "demurge", "plugin", "dg", "number", "date", "top", "right", "left", "front", "back"
      ],
    });
    // Creating Items for AE
    if(data.Item_Details.length>0){
      let tempItems = [];
      data.Item_Details.forEach((x)=>{
        x.id==null?delete x.id:null;
        tempItems.push({...x, BlId:req.body.id})
      })
      await Item_Details.bulkCreate(tempItems,{
        updateOnDuplicate: [
          "noOfPcs", "unit", "grossWt", "kh_lb", "r_class", "itemNo", "chargableWt", "rate_charge", "total", "lineWeight"
        ],
      })
    };
    if(data.Dimensions.length>0){
      let tempItems = [];
      data.Dimensions.forEach((x)=>{
        x.id==null?delete x.id:null;
        tempItems.push({...x, BlId:req.body.id})
      })
      await Dimensions.bulkCreate(tempItems,{
        updateOnDuplicate: [
          "length", "width", "height", "qty", "vol", "weight"
        ],
      })//.catch((x)=>console.log(x.message))
    };
    await Stamps.destroy({ where:{id:data.deleteArr} });
    await Container_Info.destroy({ where:{id:req.body.deletingContinersList} });
    await Item_Details.destroy({ where:{id:req.body.deletingItemList} });
    await Dimensions.destroy({ where:{id:req.body.deletingDimensionsList} });
    await data.stamps?.map((x) => Stamps.upsert({...x, BlId:req.body.id}));
    res.json({status:'success', result: result});   
  } 
  catch (error) {
    res.json({status:'error', result:error});  
  } 
}); 

routes.post("/findJobByNo", async(req, res) => {
  try {
    const attr = [
      'name', 'address1', 'address1', 'person1', 'mobile1',
      'person2', 'mobile2', 'telephone1', 'telephone2', 'infoMail'
    ];
    const result = await SE_Job.findAll({
      where:{jobNo:req.body.no},
      attributes:[
        'jobNo', 'pol', 'por',
        'flightNo','id', 
        'pod', 'fd', 'jobDate',
        'shipDate', 'cutOffDate',
        'delivery', 'freightType',
        'freightPaybleAt','VoyageId',
      ],
      order:[["createdAt", "DESC"]],
      include:[
        { model:SE_Equipments, attributes:['qty', 'size'] },
        { model:Clients,  attributes:attr },
        { model:Clients, as:'consignee', attributes:attr },
        { model:Clients, as:'shipper', attributes:attr },
        { model:Clients, as:'overseas_agent', attributes:attr },
        { model:Commodity, as:'commodity' },
        { model:Vessel,  as:'vessel', attributes:['name'] },
        { model:Clients, as:'air_line', attributes:['name'] },
        { model:Clients, as:'shipping_line', attributes:['name'] },
        { model:Voyage, attributes:['voyage'] },
      ]
    });
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getAllBls", async(req, res) => {
    try {
      const result = await Bl.findAll({
        include:[
          { model:SE_Job, attributes:["jobNo"] },
          { model:Container_Info }
        ]
      });
      res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getBlById", async(req, res) => {
  try {
    const result = await Bl.findOne({
      where:{id:req.headers.id},
      include:[
        {
          model:SE_Job,
          attributes:["jobNo"]
        },
        {model: Stamps},
        {model: Container_Info},
        {model: Item_Details},
        {model: Dimensions},
    ]});
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get("/getStamps", async(req, res) => {
  try {
    const result = await Stamps.findAll({
        where:{BlId:req.headers.id},
    });
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
}); 

routes.post("/deleteJob", async(req, res) => {
  try {
    await Bl.destroy({
      where:{
        SEJobId: req.body.id
      }
    })
    const result = await SE_Job.destroy({
      where:{id:req.body.id},
    });
    
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
}); 

routes.get("/getLoadingProgram", async(req, res) => {
  try {
    const result = await Loading_Program.findOne({
      where:{SEJobId:req.headers.id},
    });
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
}); 

routes.post("/upsertLoadingProgram", async(req, res) => {
  try {
    const result = await Loading_Program.upsert(req.body)
    .catch((x)=>console.log(x))
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
}); 

routes.get("/getJobByValues", async (req, res) => {
    let value = req.headers;
    let obj = {
      createdAt: {
        [Op.gte]: moment(value.from).toDate(),
        [Op.lte]: moment(value.to).add(1, 'days').toDate(),
      }
    };
    let newObj = {};
    if (value.client) {
      obj.ClientId = value.client;
    }
    if (value.final_destination) {
      obj.fd = value.final_destination;
    }
    if (value.shipping_air_line) {
      obj.shippingLineId = value.shipping_air_line;
    }
    if (value.consignee) {
      obj.consigneeId = value.consignee;
    }
    if (value.oversease_agent) {
      obj.overseasAgentId = value.oversease_agent;
    }
    if (value.vessel) {
      obj.vesselId = value.vessel;
    }
    if (value.clearing_agent) {
      obj.customAgentId = value.clearing_agent;
    }
    if (value.vendor) {
      obj.localVendorId = value.vendor;
    }
     if(value.air_line) {
      obj.airLineId = value.air_line;
    }
    if(value.hbl) {
      newObj.hbl = value.hbl;
    }
    if(value.mbl) {
      newObj.mbl = value.mbl;
    }
    try {
      const jobs = await SE_Job.findAll({
        where: obj,
        include:[
          { model:Bl, where: newObj, 
          include:[{model:Container_Info , attributes:["gross", 'net', "tare", "no"]},
          {model:Item_Details , attributes:["grossWt", 'chargableWt', "rate_charge"]} 
          ]},
          { model: Clients, attributes:     ["name"] },
          { model: Charge_Head, attributes: ["type", "amount"]},
          { model: Clients, attributes:     ["name"], as : "local_vendor"},
          { model: Clients, attributes:     ["name"], as : "shipping_line"},
          { model: Clients, attributes:     ["name"], as :"air_line"},
          { model: Vessel , attributes:     ["name"], as :"vessel" },
          { model: Commodity, attributes:   ["name"], as :"commodity" },
          { model: Employees, attributes:   ["name"], as :"sales_representator" },
          { model: Clients, attributes:     ["name"], as :"shipper" },
          { model: Clients, attributes:     ["name"], as :"consignee" },
      ]});
      res.status(200).json({ result: jobs });
    } catch (err) {
      res.status(200).json({ result: err.message });
    }
});

routes.get("/getValuesJobList", async (req, res) => {

  let makeResult = (result, resultTwo) => {
    let finalResult = { consignee: [], client: [], sLine: [] };
    result.forEach((x) => {
      if (x.types.includes("Consignee")) {
        finalResult.consignee.push({
          name: `${x.name} (${x.code})`,
          id: x.id,
          types: x.types,
        });
      }
      if (x.types.includes("Shipping Line")) {
        finalResult.sLine.push({
          name: `${x.name} (${x.code})`,
          id: x.id,
          types: x.types,
        });
      }
    });
    finalResult.client = resultTwo.map((x) => {
      return { name: `${x.name} (${x.code})`, id: x.id, types: x.types };
    });
    return finalResult;
  };

  let makeResultTwo = (result) => {
    let finalResult = {
      overseasAgent: [],
      chaChb: [],
      sLine: [],
      airLine: []
    };
    result.forEach((x) => {
      if (x.types.includes("Overseas Agent")) {
        finalResult.overseasAgent.push({
          name: `${x.name} (${x.code})`,
          id: x.id,
          types: x.types,
        });
      }
      if (x.types.includes("CHA/CHB")) {
        finalResult.chaChb.push({
          name: `${x.name} (${x.code})`,
          id: x.id,
          types: x.types,
        });
      }

      if (x.types.includes("Shipping Line")) {
        finalResult.sLine.push({
          name: `${x.name} (${x.code})`,
          id: x.id,
          types: x.types,
        });
      }
      if (x.types.includes("Air Line")) {
        finalResult.airLine.push({
          name: `${x.name} (${x.code})`,
          id: x.id,
          types: x.types,
        });
      } 
    });
    return finalResult;
  };

  try {
    const resultOne = await Clients.findAll({
      attributes: ["id", "name", "types", "code"],
      order: [["createdAt", "DESC"]],
    });
    const result = await Clients.findAll({
      where: {
        types: {
          [Op.or]: [{ [Op.substring]: "Consignee" },
          { [Op.substring]: "Shipping Line" }],
        },
      },
      attributes: ["id", "name", "types", "code"],
      order: [["createdAt", "DESC"]],
    });
    const resultThree = await Clients.findAll({
      where: {
        types: {
          [Op.or]: [
            { [Op.substring]: "CHA/CHB" },
            { [Op.substring]: "Overseas Agent" },
            { [Op.substring]: "Shipping Line" },
          ],
        },
      },
      attributes: ["id", "name", "types", "code"],
      order: [["createdAt", "DESC"]],
    });

    const vendor = await Clients.findAll({
      attributes: ["id", "name", "types", "code"],
      order: [["createdAt", "DESC"]],
    });
    const resultTwo = await Commodity.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "hs"],
    });

    const resultFour = await Vessel.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "code", "carrier"],
      include: [
        {
          model: Voyage,
        },
      ],
    });
    const Sr = await Employees.findAll({
      where: { represent: { [Op.substring]: "sr" } },
      attributes: ["id", "name"],
    });
    res.json({
      status: "success",
      result: {
        vendor: vendor,
        party: makeResult(result, resultOne),
        vendor_details: makeResultTwo(resultThree),
        commodity: resultTwo,
        vessel: resultFour,
        sr: Sr,
      },
    });
  } catch (error) {
    res.json({ status: "error", result: error });
  }
});

routes.get("/getDeliveryOrder", async(req, res) => {
  try {
    const result = await Delivery_Order.findOne({
        where:{SEJobId:req.headers.id},
    }).catch((x)=>console.log(x))
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
}); 

routes.post("/upsertDeliveryOrder", async(req, res) => {

  let result
  try {
    if(!req.body.doNo){
      const check = await Delivery_Order.findOne({order: [ [ 'no', 'DESC' ]], attributes:["no"], where:{operation:req.body.operation, companyId:req.body.companyId}})
      .catch((e) => console.log(e));
      result = await Delivery_Order.upsert({
        ...req.body, 
        no:check==null?1:parseInt(check.no)+1, 
        doNo:`${req.body.companyId==1?'SNS':req.body.companyId==2?'CLS':'ACS'}-DO${check==null?1:parseInt(check.no)+1}-${moment().format("YY")}`
      }).catch((x)=>console.log(x))
    } else {
    let check;
    !req.body.id?
      check = await Delivery_Order.findOne({order: [ [ 'no', 'DESC' ]], attributes:["no"], where:{operation:req.body.operation, companyId:req.body.companyId}}):
      null
    result = await Delivery_Order.upsert({
      ...req.body, 
      no:!req.body.id? check==null?1:parseInt(check.no)+1 : req.body.no, 
      doNo:req.body.doNo
    }).catch((x)=>console.log(x))
  }
  res.json({status:'success', result: result});
  }
  catch (error) {
    console.log(error.message)
    res.json({status:'error', result:error.message});
  }
});

routes.get("/getawb", async(req, res) => {
  try {
    const result = await SE_Job.findAll({
      where: {[Op.or]: [
        { operation: "AE" },
        { operation: "AI" }
      ]},
      attributes:["jobNo", "operation", "id"],
      include:[{
        model:Bl,
        attributes:["mbl"]
      }]
    })
    res.status(200).json({ result: result });
  } catch (err) {
    res.status(200).json({ result: err.message });
  }
});

routes.post("/getCounts", async (req, res) => {
  try {
    let data = req.body.data;
    let temp = []
    // console.log("First Job ID:", data[0]); // or console.log("Data:", data);
    for(let job of data){
      const charges = await Charge_Head.findAll({
        where: {
          SEJobId: job.id
        }
      })
      const invoiceSet = new Set();
      const billSet = new Set();

      let iLength = 0;
      let bLength = 0;

      charges.forEach(charge => {
        const invoiceId = charge.dataValues.invoice_id;
        if (invoiceId) {
          if (invoiceId.includes("I") && !invoiceSet.has(invoiceId)) {
            invoiceSet.add(invoiceId);
            iLength++;
          }
          if (invoiceId.includes("B") && !billSet.has(invoiceId)) {
            billSet.add(invoiceId);
            bLength++;
          }
        }
      });
      // console.log(iLength, bLength)
      temp.push({
        ...job,
        iLength: iLength,
        bLength: bLength
      })
    }


    return res.json({ status: "success", result: temp });
  } catch (e) {
    console.error(e);
    return res.json({ status: "error", result: e.toString() });
  }
});

const createMap = (arr, key) => new Map(arr.map(item => [item[key], item]));

function formatAddress(raw) {
  // Handle null, undefined, or non-string safely
  if (!raw || typeof raw !== "string") {
    raw = "";
  }

  // Split by newlines and tabs
  let parts = raw
    .split(/\r?\n|\t/) // split on newlines or tabs
    .map(p => p.trim()) // trim extra spaces
    .filter(p => p.length > 0); // remove empty ones

  // Add TEL null placeholders if none exist
  if (!parts.some(p => /^TEL/i.test(p))) {
    parts.push("TEL null", "TEL null");
  }

  // Pad with "null" to reach 10 lines
  while (parts.length < 10) {
    parts.push("null");
  }

  // Wrap each in <p>
  return parts.map(p => `<p>${p}</p>`).join("");
}


routes.post("/UploadSEJobs", async (req, res) => {
  try{
    console.log("Jobs Length:", req.body.length)

    let jobs = []

    for(let job of req.body){

      console.log(job.JobNumber)

      const Client = await Clients.findOne({
        where: {
          climaxId: job.ClientId
        }
      })
      const OverseasAgent = await Clients.findOne({
        where: {
          climaxId: job.OverseasAgentId
        }
      })
      const LocalAgent = await Clients.findOne({
        where: {
          climaxId: job.LocalAgentId
        }
      })
      const CustomClearance = await Clients.findOne({
        where: {
          climaxId: job.CustomClearanceId
        }
      })
      const Transporter = await Clients.findOne({
        where: {
          climaxId: job.TransporterId
        }
      })
      const Forwarder = await Clients.findOne({
        where: {
          climaxId: job.ForwarderId
        }
      })
      const ShippingLine = await Clients.findOne({
        where: {
          climaxId: job.ShippingLineId
        }
      })
      const Consignee = await Clients.findOne({
        where: {
          climaxId: job.ConsigneeId
        }
      })
      const Shipper = await Clients.findOne({
        where: {
          climaxId: job.ShipperId
        }
      })
      const commodity = await Commodity.findOne({
        where: {
          climaxId: job.CommodityId
        }
      })
      // const vessel = vesselMap.get(job.VesselId)
      const vessel = await Vessel.findOne({
        where: {
          climaxId: job.VesselId
        }
      })
      let voyage
      vessel ? voyage = await Voyage.findOne({
        where: {
          VesselId: vessel.id,
          voyage: job.VoyageNo
        }
      }) : null

      let j = {
        jobNo: job.JobNumber,
        jobId: job.JobNumber.split("/")[0].split("-").pop(),
        // title: 1,
        customerRef: job.CustomerRefNo,
        fileNo: job.FileNumber,
        shipStatus: job.ShipmentStatusId == 1 ? "Shipped" : "Booked" ,
        teu: job.TEUS,
        bkg: job.BookingWeight,
        pcs: job.NoOfPackages,
        vol: job.Volume,
        volWeight: job.Weight,
        pol: job.PortOfLoadingCode,
        pod: job.PortOfDischargeCode,
        fd: job.PortOfFinalDestCode,
        dg: job.DGNonDGId == 1 ? "DG" : "non-DG",
        subType: job.SubTypeId == 3 ? "FCL" : "LCL",
        billVol: "",
        shpVol: job.Volume,
        weight: job.Weight,
        weightUnit: job.WTUnitId,
        costCenter: job.CostCenter?.LOVCode,
        jobType: job.JobTypeId == 1 ? "Direct" : job.JobTypeId == 2 ? "Coloaded" : "Cross Trade",
        jobKind: job.JobKindId == 1 ? "Current" : "Opening",
        container: "",
        // carrier: 1,
        freightType: job.FreightTypeId,
        nomination: 1,
        transportCheck: Transporter ? "" : "Transport"  ,
        customCheck: CustomClearance ? "" : "Custom Clearance",
        etd: job.PlannedETD,
        eta: job.PlannedETA,
        // cbkg: 1,
        aesDate: job.AESDateTime,
        eRcDate: job.ERecDateTime,
        eRlDate: job.ERLSDateTime,
        jobDate: job.JobDate,
        shipDate: job.SailingDate,
        doorMove: job.DoorMoveOnDate,
        cutOffDate: job.CutOffDateTime,
        siCutOoffDate: job.SICUTOFFDateTime,
        vgmCutOffDate: job.VGMCUTOFFDateTime,
        freightPaybleAt: job.FreightPayableAtCode,
        terminal: job?.Terminal?.LocationName,
        delivery: job.DeliveryTypeId,
        companyId: job.SubCompanyId == 2 ? 1 : 3,
        pkgUnit: job.WTUnitId,
        incoTerms: job.IncoTerms?.IncoCode,
        exRate: job.ExRateBuying,
        approved: job.ApprovedStatusId == 2 ? "true" : "false",
        canceled: false,
        cwtLine: "",
        cwtClient: "0",
        operation: "SE",
        arrivalDate: "",
        arrivalTime: "",
        departureDate: "",
        departureTime: "",
        createdAt: job.AddOn,
        updatedAt: job.EditOn?job.EditOn:job.AddOn,
        ClientId: Client?.id,
        VoyageId: voyage?.id,
        salesRepresentatorId: '3d237d09-d8ba-47f1-8764-22cff8e11639',
        overseasAgentId: OverseasAgent?.id,
        shippingLineId: ShippingLine?.id,
        localVendorId: LocalAgent?.id,
        customAgentId: CustomClearance?.id,
        transporterId: Transporter?.id,
        createdById: '4d7f7cfb-7ace-4655-b6ee-f9ed52f81799',
        commodityId: commodity?.id,
        consigneeId: Consignee?.id,
        forwarderId: Forwarder?.id,
        shipperId: Shipper?.id,
        vesselId: vessel.id,
        climaxId: job.Id,
      }

      const savedJob = await SE_Job.create(j)

      jobs.push(j)

      
      if(job.SExp_SeaExportJob_Equipment?.length > 0){
        for(let equip of job.SExp_SeaExportJob_Equipment){
          await SE_Equipments.create({
            size: equip.EquipCode,
            qty: equip.Quantity,
            dg: equip.dDGNonDGId == 2 ? "non-DG" : "DG",
            gross: equip.Gen_EquipmentSizeType.PerUnitWeight,
            teu: equip.Gen_EquipmentSizeType.Teus,
            createdAt: job.AddOn,
            updatedAt: job.EditOn?job.EditOn:job.AddOn,
            SEJobId: savedJob.id,
          }, {silent: true})
        }
      }

      if(job.SExp_BL){
        let bl = job.SExp_BL
        // console.log(bl.Id)
        // console.log(formatAddress(bl.SExp_BL_Detail.Shipper))
  
        let BL = {
          operation: "SE",
          hbl: bl.HBLNo,
          // no: 1,
          hblDate: bl.HBLDate,
          hblIssue: "",
          mbl: bl.MBLNo,
          mblDate: bl.MBLDate,
          status: bl.StatusId == 1 ? "Draft" : "Final", //find reference from climax then add
          blReleaseStatus: "Original", //find reference from climax then add
          blhandoverType: "By Hand", //find reference from climax then add
          releaseInstruction: "", //find reference from climax then add
          remarks: "", //find reference from climax then add
          sailingDate: bl.SailingDate,
          shipDate: job.SailingDate,
          shipperContent: formatAddress(bl.SExp_BL_Detail.Shipper),
          consigneeContent: formatAddress(bl.SExp_BL_Detail.Consignee),
          notifyOneContent: formatAddress(bl.SExp_BL_Detail.NotifyParty1),
          notifyTwoContent: formatAddress(bl.SExp_BL_Detail.NotifyParty2),
          deliveryContent: formatAddress(bl.SExp_BL_Detail.DeliveryAgent),
          marksContent: formatAddress(bl.SExp_BL_Detail.MarksAndNumber),
          marksContentTwo: "",
          noOfPckgs: bl.SExp_BL_Detail.NoOfPkgs,
          descOfGoodsContent: formatAddress(bl.SExp_BL_Detail.GoodsDescription),
          descOfGoodsContentTwo: "",
          grossWeightContent: formatAddress(bl.SExp_BL_Detail.GrossWeight),
          measurementContent: formatAddress(bl.SExp_BL_Detail.Measurement),
          AgentStamp: bl.SExp_BL_Detail.AgentStamp,
          hs: bl.SExp_BL_Detail.HSCode,
          onBoardDate: "",
          IssuePlace: bl.SExp_BL_Detail.PlaceOfIssue,
          IssueDate: bl.SExp_BL_Detail.PlaceOfIssueDate,
          poDeliveryTwo: bl.SExp_BL_Detail.PortOfDelivery,
          podTwo: bl.SExp_BL_Detail.PortOfDischarge,
          polTwo: bl.SExp_BL_Detail.PortOfLoading,
          agentM3: job.AgentM3,
          coloadM3: job.ColoadM3,
          noBls: bl.SExp_BL_Detail.NoOfOriginalBL,
          formE: bl.FormENumber,
          formEDate: bl.FormEDate,
          date1: "",
          date2: "",
          declareCarriage: "",
          declareCustoms: "",
          insurance: "",
          handlingInfo: "",
          toOne: "",
          toTwo: "",
          toThree: "",
          byOne: "",
          byTwo: "",
          byFirstCarrier: "",
          currency: "",
          charges: "",
          wtValPPC: "",
          wtVatCOLL: "",
          othersPPC: "",
          othersCOLL: "",
          ppWeightCharges: "0",
          ccWeightCharges: "0",
          ppvaluationCharges: "0",
          ccvaluationCharges: "0",
          ppTax: "0",
          ccTax: "0",
          ppOtherDueChargeAgent: "0",
          ccOtherDueChargeAgent: "0",
          ppOtherDueChargeCarrier: "0",
          ccOtherDueChargeCarrier: "0",
          ppTotal: "0",
          ccTotal: "0",
          applyToCWT: "0",
          createdAt: bl.AddOn,
          updatedAt: bl.EditOn?bl.EditOn:bl.AddOn,
          SEJobId: savedJob.id,
          // notifyPartyOneId: 1,
          // notifyPartyTwoId: 1,
        }
  
        const savedBl = await Bl.create(BL)
  
        if(bl.SExp_BL_Equipment?.length > 0){
          for(let e of bl.SExp_BL_Equipment){
            await Container_Info.create({
              no: e.ContainerNo,
              seal: e.SealNo,
              size: e.EquipCode,
              rategroup: e.RateGroup,
              gross: e.GrossWt,
              net: e.NetWt,
              tare: e.GrossWt - e.NetWt,
              wtUnit: e.WTUnitId == 2 ? "KGS" : "",
              cbm: e.CBM,
              pkgs: e.NoOfPackages,
              unit: e.UNPacking?.PackName || null,
              temp: e.Temperature,
              loadType: e.LoadTypeId == 2 ? "FULL" : "EMPTY",
              remarks: e.Remarks,
              detention: "",
              demurge: "",
              plugin: "",
              dg: e.dDGNonDGId == 2 ? "non-DG" : "DG",
              number: e.dFormENumber,
              date: bl.AddOn,
              top: e.OOG_TOP,
              right: e.OOG_RIGHT,
              left: e.OOG_LEFT,
              front: e.OOG_FRONT,
              back: e.OOG_BACK,
              createdAt: bl.AddOn,
              updatedAt: bl.EditOn?bl.EditOn:bl.AddOn,
              BlId: savedBl.id,
            })
          }
        }
  
        if(bl.SExp_BL_Stamp){
          for(let s of bl.SExp_BL_Stamp){
            await Stamps.create({
              code: s.Gen_Stamps?.StampCode,
              stamps: s.Gen_Stamps?.StampName,
              stamp_group: s.StampGroupId,
              createdAt: bl.AddOn,
              updatedAt: bl.EditOn?bl.EditOn:bl.AddOn,
              BlId: savedBl.id,
            })
          }
        }
      }


      const accounts = await Child_Account.findAll({ include: [
        { model: Child_Account, as: 'parent' }
      ] });
      const accountMap = new Map();
      accounts.forEach((a) => {
        const companyId = a.Parent_Account?.CompanyId;
        if (companyId) {
          accountMap.set(`${a.title}`, { id: a.id, subCategory: a.subCategory });
        }
      });
      const companyId = job.SubCompanyId == 2 ? 1 : 3;

      if(job.SeaExportJob_ChargesPayb){
        await UploadChargesPayb(job.SeaExportJob_ChargesPayb, job, savedJob, accountMap, companyId)
      }

      if(job.SeaExportJob_ChargesRecv){
        await UploadChargesRecv(job.SeaExportJob_ChargesRecv, job, savedJob, accountMap, companyId)
      }
    }

    res.json({ status: "success", result: jobs });
  }catch(e){
    console.log(e)
    res.json({ status: "error", result: e.toString() });
  }
})

routes.post("/UploadSIJobs", async (req, res) => {
  try{
    console.log("Jobs Length:", req.body.length)

    let jobs = []

    for(let job of req.body){

      console.log(job.JobNumber)

      const Client = await Clients.findOne({
        where: {
          climaxId: job.ClientId
        }
      })
      const OverseasAgent = await Clients.findOne({
        where: {
          climaxId: job.OverseasAgentId
        }
      })
      const LocalAgent = await Clients.findOne({
        where: {
          climaxId: job.LocalAgentId
        }
      })
      const CustomClearance = await Clients.findOne({
        where: {
          climaxId: job.CustomClearanceId
        }
      })
      const Transporter = await Clients.findOne({
        where: {
          climaxId: job.TransporterId
        }
      })
      const Forwarder = await Clients.findOne({
        where: {
          climaxId: job.ForwarderId
        }
      })
      const ShippingLine = await Clients.findOne({
        where: {
          climaxId: job.ShippingLineId
        }
      })
      const Consignee = await Clients.findOne({
        where: {
          climaxId: job.ConsigneeId
        }
      })
      const Shipper = await Clients.findOne({
        where: {
          climaxId: job.ShipperId
        }
      })
      const commodity = await Commodity.findOne({
        where: {
          climaxId: job.CommodityId
        }
      })
      // const vessel = vesselMap.get(job.VesselId)
      const vessel = await Vessel.findOne({
        where: {
          climaxId: job.VesselId
        }
      })
      let voyage
      vessel ? voyage = await Voyage.findOne({
        where: {
          VesselId: vessel.id,
          voyage: job.VoyageNo
        }
      }) : null

      let j = {
        jobNo: job.JobNumber,
        jobId: job.JobNumber.split("/")[0].split("-").pop(),
        // title: 1,
        customerRef: job.CustomerRefNo,
        fileNo: job.FileNumber,
        shipStatus: job.ShipmentStatusId == 1 ? "Shipped" : "Booked" ,
        teu: job.TEUS,
        bkg: job.BookingWeight,
        pcs: job.NoOfPackages,
        vol: job.Volume,
        volWeight: job.Weight,
        pol: job.PortOfLoadingCode,
        pod: job.PortOfDischargeCode,
        fd: job.PortOfFinalDestCode,
        dg: job.DGNonDGId == 1 ? "DG" : "non-DG",
        subType: job.SubTypeId == 3 ? "FCL" : "LCL",
        billVol: "",
        shpVol: job.Volume,
        weight: job.Weight,
        weightUnit: job.WTUnitId,
        costCenter: job.CostCenter?.LOVCode,
        jobType: job.JobTypeId == 1 ? "Direct" : job.JobTypeId == 2 ? "Coloaded" : "Cross Trade",
        jobKind: job.JobKindId == 1 ? "Current" : "Opening",
        container: "",
        // carrier: 1,
        freightType: job.FreightTypeId,
        nomination: 1,
        transportCheck: Transporter ? "" : "Transport"  ,
        customCheck: CustomClearance ? "" : "Custom Clearance",
        etd: job.PlannedETD,
        eta: job.PlannedETA,
        // cbkg: 1,
        aesDate: job.AESDateTime,
        eRcDate: job.ERecDateTime,
        eRlDate: job.ERLSDateTime,
        jobDate: job.JobDate,
        shipDate: job.SailingDate,
        doorMove: job.DoorMoveOnDate,
        cutOffDate: job.CutOffDateTime,
        siCutOoffDate: job.SICUTOFFDateTime,
        vgmCutOffDate: job.VGMCUTOFFDateTime,
        freightPaybleAt: job.FreightPayableAtCode,
        terminal: job?.Terminal?.LocationName,
        delivery: job.DeliveryTypeId,
        companyId: job.SubCompanyId == 2 ? 1 : 3,
        pkgUnit: job.WTUnitId,
        incoTerms: job.IncoTerms?.IncoCode,
        exRate: job.ExRateBuying,
        approved: job.ApprovedStatusId == 2 ? "true" : "false",
        canceled: false,
        cwtLine: "",
        cwtClient: "0",
        operation: "SI",
        arrivalDate: "",
        arrivalTime: "",
        departureDate: "",
        departureTime: "",
        createdAt: job.AddOn,
        updatedAt: job.EditOn?job.EditOn:job.AddOn,
        ClientId: Client?.id,
        VoyageId: voyage?.id,
        salesRepresentatorId: '3d237d09-d8ba-47f1-8764-22cff8e11639',
        overseasAgentId: OverseasAgent?.id,
        shippingLineId: ShippingLine?.id,
        localVendorId: LocalAgent?.id,
        customAgentId: CustomClearance?.id,
        transporterId: Transporter?.id,
        createdById: '4d7f7cfb-7ace-4655-b6ee-f9ed52f81799',
        commodityId: commodity?.id,
        consigneeId: Consignee?.id,
        forwarderId: Forwarder?.id,
        shipperId: Shipper?.id,
        vesselId: vessel.id,
        climaxId: job.Id,
      }

      const savedJob = await SE_Job.create(j)

      jobs.push(j)

      
      if(job.SImp_SeaImportJob_Equipment?.length > 0){
        for(let equip of job.SImp_SeaImportJob_Equipment){
          await SE_Equipments.create({
            size: equip.EquipCode,
            qty: equip.Quantity,
            dg: equip.dDGNonDGId == 2 ? "non-DG" : "DG",
            gross: equip.Gen_EquipmentSizeType.PerUnitWeight,
            teu: equip.Gen_EquipmentSizeType.Teus,
            createdAt: job.AddOn,
            updatedAt: job.EditOn?job.EditOn:job.AddOn,
            SEJobId: savedJob.id,
          }, {silent: true})
        }
      }

      if(job.SImp_BL){
        let bl = job.SImp_BL
        // console.log(bl.Id)
        // console.log(formatAddress(bl.SExp_BL_Detail.Shipper))
  
        let BL = {
          operation: "SI",
          hbl: bl.HBLNo,
          // no: 1,
          hblDate: bl.HBLDate,
          hblIssue: "",
          mbl: bl.MBLNo,
          mblDate: bl.MBLDate,
          status: bl.StatusId == 1 ? "Draft" : "Final", //find reference from climax then add
          blReleaseStatus: "Original", //find reference from climax then add
          blhandoverType: "By Hand", //find reference from climax then add
          releaseInstruction: "", //find reference from climax then add
          remarks: "", //find reference from climax then add
          sailingDate: bl.SailingDate,
          shipDate: job.SailingDate,
          shipperContent: formatAddress(bl.SImp_BL_Detail.Shipper),
          consigneeContent: formatAddress(bl.SImp_BL_Detail.Consignee),
          notifyOneContent: formatAddress(bl.SImp_BL_Detail.NotifyParty1),
          notifyTwoContent: formatAddress(bl.SImp_BL_Detail.NotifyParty2),
          deliveryContent: formatAddress(bl.SImp_BL_Detail.DeliveryAgent),
          marksContent: formatAddress(bl.SImp_BL_Detail.MarksAndNumber),
          marksContentTwo: "",
          noOfPckgs: bl.SImp_BL_Detail.NoOfPkgs,
          descOfGoodsContent: formatAddress(bl.SImp_BL_Detail.GoodsDescription),
          descOfGoodsContentTwo: "",
          grossWeightContent: formatAddress(bl.SImp_BL_Detail.GrossWeight),
          measurementContent: formatAddress(bl.SImp_BL_Detail.Measurement),
          AgentStamp: bl.SImp_BL_Detail.AgentStamp,
          hs: bl.SImp_BL_Detail.HSCode,
          onBoardDate: "",
          IssuePlace: bl.SImp_BL_Detail.PlaceOfIssue,
          IssueDate: bl.SImp_BL_Detail.PlaceOfIssueDate,
          poDeliveryTwo: bl.SImp_BL_Detail.PortOfDelivery,
          podTwo: bl.SImp_BL_Detail.PortOfDischarge,
          polTwo: bl.SImp_BL_Detail.PortOfLoading,
          agentM3: job.AgentM3,
          coloadM3: job.ColoadM3,
          noBls: bl.SImp_BL_Detail.NoOfOriginalBL,
          formE: bl.FormENumber,
          formEDate: bl.FormEDate,
          date1: "",
          date2: "",
          declareCarriage: "",
          declareCustoms: "",
          insurance: "",
          handlingInfo: "",
          toOne: "",
          toTwo: "",
          toThree: "",
          byOne: "",
          byTwo: "",
          byFirstCarrier: "",
          currency: "",
          charges: "",
          wtValPPC: "",
          wtVatCOLL: "",
          othersPPC: "",
          othersCOLL: "",
          ppWeightCharges: "0",
          ccWeightCharges: "0",
          ppvaluationCharges: "0",
          ccvaluationCharges: "0",
          ppTax: "0",
          ccTax: "0",
          ppOtherDueChargeAgent: "0",
          ccOtherDueChargeAgent: "0",
          ppOtherDueChargeCarrier: "0",
          ccOtherDueChargeCarrier: "0",
          ppTotal: "0",
          ccTotal: "0",
          applyToCWT: "0",
          createdAt: bl.AddOn,
          updatedAt: bl.EditOn?bl.EditOn:bl.AddOn,
          SEJobId: savedJob.id,
          // notifyPartyOneId: 1,
          // notifyPartyTwoId: 1,
        }
  
        const savedBl = await Bl.create(BL)
      }


      const accounts = await Child_Account.findAll({ include: [
        { model: Child_Account, as: 'parent' }
      ] });
      const accountMap = new Map();
      accounts.forEach((a) => {
        const companyId = a.Parent_Account?.CompanyId;
        if (companyId) {
          accountMap.set(`${a.title}`, { id: a.id, subCategory: a.subCategory });
        }
      });
      const companyId = job.SubCompanyId == 2 ? 1 : 3;

      if(job.SeaExportJob_ChargesPayb){
        await UploadChargesPayb(job.SeaExportJob_ChargesPayb, job, savedJob, accountMap, companyId)
      }

      if(job.SeaExportJob_ChargesRecv){
        await UploadChargesRecv(job.SeaExportJob_ChargesRecv, job, savedJob, accountMap, companyId)
      }
    }

    res.json({ status: "success", result: jobs });
  }catch(e){
    console.log(e)
    res.json({ status: "error", result: e.toString() });
  }
})

const safeFindOne = async (model, id) => {
  if (!id) return null;
  return await model.findOne({ where: { climaxId: id } });
};

const UploadChargesPayb = async (Charge, job, savedJob, accountMap, companyId) => {
  for(let CP of Charge){
    const charge = await Charges.findOne({where:{code:CP.ChargesId}})
    let party = await Clients.findOne({where:{climaxId:CP.VendorId}})
    // if(!party){
    //   party = await Clients.findOne({where:{climaxId:CP.CustomerId}})
    // }
    let invoice_id
    let invoiceType
    let partyType
    let invoice
    if(CP.GL_JobBill_Charges){
      invoice_id = CP.GL_JobBill_Charges?.JobBill?.Invoice?.InvoiceNumber
      invoiceType = "Job Bill"
      partyType = "vendor"
      invoice = await Invoice.findOne({where:{climaxId:CP.GL_JobBill_Charges.JobBill.Invoice.Id.toString()}})
    }else if(CP.GL_AgentInvoice_Charges){
      invoice_id = CP.GL_AgentInvoice_Charges?.Agent_Invoice?.Invoice?.InvoiceNumber
      invoiceType = "Agent Invoice"
      partyType = "agent"
      invoice = await Invoice.findOne({where:{climaxId:CP.GL_AgentInvoice_Charges.Agent_Invoice.Invoice.Id.toString()}}) 
    }
    let ChargeP = {
      charge: charge?.id,
      particular: charge?.name,
      invoice_id: invoice_id,
      description: CP.Description,
      name: CP.Vendor.PartyName,
      partyId: party.id,
      invoiceType: invoiceType,
      type: "Payble",
      basis: CP.Charges.PerUnitFixedId = 1 ? "Per Unit" : "Per Shipment",
      pp_cc: CP.PPCCId == 1 ? "PP" : "CC",
      size_type: CP.EquipCode,
      dg_type: job.DGNonDGId == 1 ? "DG" : "non-DG",
      qty: CP.Quantity,
      rate_charge: CP.Rate,
      currency: CP.Currency.CurrencyCode,
      amount: "1",
      discount: CP.DiscountAmount,
      taxPerc: 0,
      tax_apply: CP.TaxAmount > 0 ? true : false,
      tax_amount: CP.TaxAmount,
      net_amount: CP.NetAmount,
      ex_rate: CP.ExchRateLine,
      local_amount: CP.LocalAmount,
      status: 1,
      approved_by: "",
      approved_date: "",
      partyType: partyType,
      InvoiceId: invoice?.id,
      SEJobId: savedJob.id,
    }

    const savedCP = await Charge_Head.create(ChargeP)

    if(CP.GL_JobBill_Charges?.JobBill?.Invoice){

      let CAID = 0;

      const accountKey = `${CP.GL_JobBill_Charges?.JobBill?.Invoice.GL_Voucher.GL_Voucher_Detail[0].GL_COA?.AccountName}`;

      if (accountMap.has(accountKey)) {
        CAID = accountMap.get(accountKey).id;
      } else {
        console.warn(`⚠️ No matching account for: ${vh.GL_COA?.AccountName}`);
      }

      let savedInvoice = await Invoice.findOne({where:{climaxId:CP.GL_JobBill_Charges.JobBill.Invoice.Id.toString()}})

      if(!savedInvoice){
        let i = CP.GL_JobBill_Charges.JobBill.Invoice
        let invoiceiType = "Job Bill"
        let invoicePayType = "Payble"
        let invoiceOperation = "AE"
        let partyCode = 0


        if(i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("RECEIVABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("ASSETS") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LIABILITIES") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LAIBILITY")){
          partyCode = i.GL_Voucher.GL_Voucher_Detail[0].COAAccountId
          // partyName = i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.AccountName
        }else{
          partyCode = i.GL_Voucher.GL_Voucher_Detail[1].COAAccountId
          // partyName = i.GL_Voucher.GL_Voucher_Detail[1].GL_COA.AccountName
        }
        // console.log("Party Code:", partyCode)
        const account = await Child_Account.findOne({
          where: { id: partyCode.toString() },
        })

        let ipartyType = ''

        if(CP.VendorId == job.ClientId){
          ipartyType = "client"
        }else if(CP.VendorId == job.ConsigneeId){
          ipartyType = "client" 
        }else if(CP.VendorId == job.ShipperId){
          ipartyType = "client"
        }else if(CP.VendorId == job.OverseasAgentId){
          ipartyType = "agent"
        }else{
          ipartyType = "vendor"
        }

        let CA = null

        if(account){
          // console.log("Account Found:", account.title, account.id)
          CA = await Client_Associations.findOne({
            where: {
              ChildAccountId: account.id
            }
          })
        }

        let inv = {
          invoice_No: i.InvoiceNumber,
          invoice_Id: i.InvoiceNumber.split("-")[2].split("/")[0].replace(/^0+/, ""),
          type: invoiceiType,
          payType: invoicePayType,
          status: '1',
          operation: invoiceOperation,
          currency: i.GL_Currencies.CurrencyCode,
          ex_rate: i.ExchangeRate,
          party_Id: CA.ClientId,
          party_Name: account.title,
          paid: 0,
          recieved: 0,
          roundOff: '0',
          total: i.InvoiceAmount,
          approved: '1',
          companyId: companyId,
          partyType: ipartyType,
          note: i.Remarks,
          createdAt: moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
          updatedAt: i.invoiceDate?moment(i.invoiceDate):moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
          SEJobId: savedJob.id,
          climaxId: i.Id
        }
        savedInvoice = await Invoice.create(inv, { silent: true })

        if(!invoice){
          savedCP.update({InvoiceId:savedInvoice.id})
        }

        let p
        let temp = await Client_Associations.findOne({
          where: {
            // CompanyId: companyId,
            ChildAccountId: CAID
          }
        })
        if(temp){
          p = await Clients.findOne({
            where: {
              id: temp.ClientId
            }
          })
        }

        let vch = await Vouchers.create({
          voucher_No: i.GL_Voucher.VoucherNo.split("-")[2].split("/")[0].replace(/^0+/, ""),
          voucher_Id: i.GL_Voucher.VoucherNo,
          type: i.GL_Voucher.GL_VoucherType.VoucherType,
          vType: i.GL_Voucher.GL_VoucherType.TypeCode,
          currency: i.GL_Voucher.GL_Currencies?.CurrencyCode ?? "PKR",
          exRate: i.GL_Voucher.ExchangeRate,
          chequeNo: i.GL_Voucher.GL_Voucher_Detail[0].ChequeNumber,
          chequeDate: i.GL_Voucher.GL_Voucher_Detail[0].ChequeDate,
          voucherNarration: i.GL_Voucher.Narration,
          costCenter: "KHI",
          onAccount: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
          partyId: p.id,
          partyName: p.name,
          partyType: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
          tranDate: i.GL_Voucher.VoucherDate,
          createdBy: i.GL_Voucher.AddLog,
          createdAt: i.GL_Voucher.AddOn,
          updatedAt: i.GL_Voucher.EditOn?i.GL_Voucher.EditOn:i.GL_Voucher.AddOn,
          CompanyId: companyId,
          invoice_Id: savedInvoice.id
        }, { silent: true });

        for(let vh of i.GL_Voucher.GL_Voucher_Detail){
          let Voucher_Head = {
            defaultAmount: vh.DebitLC == 0 ? vh.CreditLC : vh.DebitLC,
            amount: vh.DebitVC == 0 ? vh.CreditVC : vh.DebitVC,
            type: vh.DebitLC == 0 ? "credit" : "debit",
            narration: vh.NarrationVD,
            accountType: vh.GL_COA.GL_COASubCategory.SubCategory,
            createdAt: vch.AddOn,
            updatedAt: vch.EditOn?vch.EditOn:vch.AddOn || moment().format("YYYY-MM-DD"),
            VoucherId: vch.id,
            ChildAccountId: accountMap.get(`${vh.GL_COA.AccountName}`).id,
          }
          await Voucher_Heads.create(Voucher_Head, { silent: true });
        }
      }
    }

    if(CP.GL_AgentInvoice_Charges?.Agent_Invoice?.Invoice){

      let CAID = 0;

      const accountKey = `${CP.GL_AgentInvoice_Charges?.Agent_Invoice?.Invoice.GL_Voucher.GL_Voucher_Detail[0].GL_COA?.AccountName}`;

      if (accountMap.has(accountKey)) {
        CAID = accountMap.get(accountKey).id;
      } else {
        console.warn(`⚠️ No matching account for: ${vh.GL_COA?.AccountName}`);
      }

      let savedInvoice = await Invoice.findOne({where:{climaxId:CP.GL_AgentInvoice_Charges.Agent_Invoice.Invoice.Id.toString()}})

      if(!savedInvoice){
        let i = CP.GL_AgentInvoice_Charges.Agent_Invoice.Invoice
        let invoiceiType = "Agent Bill"
        let invoicePayType = "Payble"
        let invoiceOperation = "AE"
        let partyCode = 0


        if(i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("RECEIVABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("ASSETS") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LIABILITIES") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LAIBILITY")){
          partyCode = i.GL_Voucher.GL_Voucher_Detail[0].COAAccountId
          // partyName = i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.AccountName
        }else{
          partyCode = i.GL_Voucher.GL_Voucher_Detail[1].COAAccountId
          // partyName = i.GL_Voucher.GL_Voucher_Detail[1].GL_COA.AccountName
        }

        const account = await Child_Account.findOne({
          where: { id: partyCode.toString() },
        })

        let ipartyType = ''

        if(CP.VendorId == job.ClientId){
          ipartyType = "client"
        }else if(CP.VendorId == job.ConsigneeId){
          ipartyType = "client" 
        }else if(CP.VendorId == job.ShipperId){
          ipartyType = "client"
        }else if(CP.VendorId == job.OverseasAgentId){
          ipartyType = "agent"
        }else{
          ipartyType = "vendor"
        }

        let CA = null

        if(account){
          CA = await Client_Associations.findOne({
            where: {
              ChildAccountId: account.id
            }
          })
        }


        let inv = {
          invoice_No: i.InvoiceNumber,
          invoice_Id: i.InvoiceNumber.split("-")[2].split("/")[0].replace(/^0+/, ""),
          type: invoiceiType,
          payType: invoicePayType,
          status: '1',
          operation: invoiceOperation,
          currency: i.GL_Currencies.CurrencyCode,
          ex_rate: i.ExchangeRate,
          party_Id: ipartyType == "client" ? CA.ClientId : CA.VendorId,
          party_Name: account.title,
          paid: 0,
          recieved: 0,
          roundOff: '0',
          total: i.InvoiceAmount,
          approved: '1',
          companyId: companyId,
          partyType: ipartyType,
          note: i.Remarks,
          createdAt: moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
          updatedAt: i.invoiceDate?moment(i.invoiceDate):moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
          SEJobId: savedJob.id,
          climaxId: i.Id
        }
        savedInvoice = await Invoice.create(inv, { silent: true })

        if(!invoice){
          savedCP.update({InvoiceId:savedInvoice.id})
        }

        let p
        let temp = await Client_Associations.findOne({
          where: {
            // CompanyId: companyId,
            ChildAccountId: CAID
          }
        })
        if(temp){
          p = await Clients.findOne({
            where: {
              id: temp.ClientId
            }
          })
        }

        let vch = await Vouchers.create({
          voucher_No: i.GL_Voucher.VoucherNo.split("-")[2].split("/")[0].replace(/^0+/, ""),
          voucher_Id: i.GL_Voucher.VoucherNo,
          type: i.GL_Voucher.GL_VoucherType.VoucherType,
          vType: i.GL_Voucher.GL_VoucherType.TypeCode,
          currency: i.GL_Voucher.GL_Currencies?.CurrencyCode ?? "PKR",
          exRate: i.GL_Voucher.ExchangeRate,
          chequeNo: i.GL_Voucher.GL_Voucher_Detail[0].ChequeNumber,
          chequeDate: i.GL_Voucher.GL_Voucher_Detail[0].ChequeDate,
          voucherNarration: i.GL_Voucher.Narration,
          costCenter: "KHI",
          onAccount: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
          partyId: p.id,
          partyName: p.name,
          partyType: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
          tranDate: i.GL_Voucher.VoucherDate,
          createdBy: i.GL_Voucher.AddLog,
          createdAt: i.GL_Voucher.AddOn,
          updatedAt: i.GL_Voucher.EditOn?i.GL_Voucher.EditOn:i.GL_Voucher.AddOn,
          CompanyId: companyId,
          invoice_Id: savedInvoice.id
        }, { silent: true });

        for(let vh of i.GL_Voucher.GL_Voucher_Detail){
          let Voucher_Head = {
            defaultAmount: vh.DebitLC == 0 ? vh.CreditLC : vh.DebitLC,
            amount: vh.DebitVC == 0 ? vh.CreditVC : vh.DebitVC,
            type: vh.DebitLC == 0 ? "credit" : "debit",
            narration: vh.NarrationVD,
            accountType: vh.GL_COA.GL_COASubCategory.SubCategory,
            createdAt: vch.AddOn,
            updatedAt: vch.EditOn?vch.EditOn:vch.AddOn || moment().format("YYYY-MM-DD"),
            VoucherId: vch.id,
            ChildAccountId: accountMap.get(`${vh.GL_COA.AccountName}`).id,
          }
          await Voucher_Heads.create(Voucher_Head, { silent: true });
        }
      }
    }
  }
}

// const UploadChargesRecv = async (Charge, job, savedJob, accountMap, companyId) => {
//   for(let CP of Charge){
//     const charge = await Charges.findOne({where:{code:CP.ChargesId}})
//     let party = await Clients.findOne({where:{climaxId:CP.Customer.Id}})
//     if(!party){
//       party = await Clients.findOne({where:{climaxId:CP.Customer.Id}})
//     }
//     let invoice_id
//     let invoiceType
//     let partyType
//     let invoice
//     if(CP.GL_JobInvoice_Charges){
//       invoice_id = CP.GL_JobInvoice_Charges?.JobInvoice?.Invoice?.InvoiceNumber
//       invoiceType = "Job Invoice"
//       partyType = "client"
//       invoice = await Invoice.findOne({where:{climaxId:CP.GL_JobInvoice_Charges.JobInvoice.Invoice.Id.toString()}})
//     }else if(CP.GL_Agent_Invoice_Charges){
//       invoice_id = CP.GL_Agent_Invoice_Charges?.Agent_Invoice?.Invoice?.InvoiceNumber
//       invoiceType = "Agent Invoice"
//       partyType = "agent"
//       invoice = await Invoice.findOne({where:{climaxId:CP.GL_Agent_Invoice_Charges.Agent_Invoice.Invoice.Id.toString()}})
      
//     }
//     let ChargeP = {
//       charge: charge?.id,
//       particular: charge?.name,
//       invoice_id: invoice_id,
//       description: CP.Description,
//       name: CP.Customer.PartyName,
//       partyId: party.id,
//       invoiceType: invoiceType,
//       type: "Recievable",
//       basis: CP.Charges.PerUnitFixedId = 1 ? "Per Unit" : "Per Shipment",
//       pp_cc: CP.PPCCId == 1 ? "PP" : "CC",
//       size_type: CP.EquipCode,
//       dg_type: job.DGNonDGId == 1 ? "DG" : "non-DG",
//       qty: CP.Quantity,
//       rate_charge: CP.Rate,
//       currency: CP.Currency.CurrencyCode,
//       amount: "1",
//       discount: CP.DiscountAmount,
//       taxPerc: 0,
//       tax_apply: CP.TaxAmount > 0 ? true : false,
//       tax_amount: CP.TaxAmount,
//       net_amount: CP.NetAmount,
//       ex_rate: CP.ExchRateClient,
//       local_amount: CP.LocalAmount,
//       status: 1,
//       approved_by: "",
//       approved_date: "",
//       partyType: partyType,
//       InvoiceId: invoice?.id,
//       SEJobId: savedJob.id,
//     }

//     const savedCP = await Charge_Head.create(ChargeP)

//     if(CP.GL_JobInvoice_Charges?.JobInvoice?.Invoice){

//       let CAID = 0;

//       const accountKey = `${CP.GL_JobInvoice_Charges?.JobInvoice?.Invoice.GL_Voucher.GL_Voucher_Detail[0].GL_COA?.AccountName}`;

//       if (accountMap.has(accountKey)) {
//         CAID = accountMap.get(accountKey).id;
//       } else {
//         console.warn(`⚠️ No matching account for: ${vh.GL_COA?.AccountName}`);
//       }

//       let savedInvoice = await Invoice.findOne({where:{climaxId:CP.GL_JobInvoice_Charges.JobInvoice.Invoice.Id.toString()}})

//       if(!savedInvoice){
//         let i = CP.GL_JobInvoice_Charges.JobInvoice.Invoice
//         let invoiceiType = "Job Invoice"
//         let invoicePayType = "Recievable"
//         let invoiceOperation = "AI"
//         let partyCode = 0


//         if(i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("RECEIVABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("ASSETS") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LIABILITIES") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LAIBILITY")){
//           partyCode = i.GL_Voucher.GL_Voucher_Detail[0].COAAccountId
//           // partyName = i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.AccountName
//         }else{
//           partyCode = i.GL_Voucher.GL_Voucher_Detail[1].COAAccountId
//           // partyName = i.GL_Voucher.GL_Voucher_Detail[1].GL_COA.AccountName
//         }

//         const account = await Child_Account.findOne({
//           where: { id: partyCode.toString() },
//         })

//         let ipartyType = ''

//         if(CP.CustomerId == job.ClientId){
//           ipartyType = "client"
//         }else if(CP.CustomerId == job.ConsigneeId){
//           ipartyType = "client" 
//         }else if(CP.CustomerId == job.ShipperId){
//           ipartyType = "client"
//         }else if(CP.CustomerId == job.OverseasAgentId){
//           ipartyType = "agent"
//         }else{
//           ipartyType = "vendor"
//         }

//         let CA = null

//         if(account){
//           // console.log("Account Found:", account.title, account.id)
//           CA = await Client_Associations.findOne({
//             where: {
//               ChildAccountId: account.id
//             }
//           })
//         }

//         let inv = {
//           invoice_No: i.InvoiceNumber,
//           invoice_Id: i.InvoiceNumber.split("-")[2].split("/")[0].replace(/^0+/, ""),
//           type: invoiceiType,
//           payType: invoicePayType,
//           status: '1',
//           operation: invoiceOperation,
//           currency: i.GL_Currencies.CurrencyCode,
//           ex_rate: i.ExchangeRate,
//           party_Id: CA?.ClientId,
//           party_Name: account.title,
//           paid: 0,
//           recieved: 0,
//           roundOff: '0',
//           total: i.InvoiceAmount,
//           approved: '1',
//           companyId: companyId,
//           partyType: ipartyType,
//           note: i.Remarks,
//           createdAt: moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
//           updatedAt: i.invoiceDate?moment(i.invoiceDate):moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
//           SEJobId: savedJob.id,
//           climaxId: i.Id
//         }
//         if(!inv.party_Id){
//           console.log(i.InvoiceNumber, ipartyType, inv.party_Id)
//         }
//         savedInvoice = await Invoice.create(inv, { silent: true })

//         if(!invoice){
//           savedCP.update({InvoiceId:savedInvoice.id})
//         }

//         let p
//         let temp = await Client_Associations.findOne({
//           where: {
//             // CompanyId: companyId,
//             ChildAccountId: CAID
//           }
//         })
//         if(temp){
//           p = await Clients.findOne({
//             where: {
//               id: temp.ClientId
//             }
//           })
//         }

//         let vch = await Vouchers.create({
//           voucher_No: i.GL_Voucher.VoucherNo.split("-")[2].split("/")[0].replace(/^0+/, ""),
//           voucher_Id: i.GL_Voucher.VoucherNo,
//           type: i.GL_Voucher.GL_VoucherType.VoucherType,
//           vType: i.GL_Voucher.GL_VoucherType.TypeCode,
//           currency: i.GL_Voucher.GL_Currencies?.CurrencyCode ?? "PKR",
//           exRate: i.GL_Voucher.ExchangeRate,
//           chequeNo: i.GL_Voucher.GL_Voucher_Detail[0].ChequeNumber,
//           chequeDate: i.GL_Voucher.GL_Voucher_Detail[0].ChequeDate,
//           voucherNarration: i.GL_Voucher.Narration,
//           costCenter: "KHI",
//           onAccount: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
//           partyId: p.id,
//           partyName: p.name,
//           partyType: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
//           tranDate: i.GL_Voucher.VoucherDate,
//           createdBy: i.GL_Voucher.AddLog,
//           createdAt: i.GL_Voucher.AddOn,
//           updatedAt: i.GL_Voucher.EditOn?i.GL_Voucher.EditOn:i.GL_Voucher.AddOn,
//           CompanyId: companyId,
//           invoice_Id: savedInvoice.id
//         }, { silent: true });

//         for(let vh of i.GL_Voucher.GL_Voucher_Detail){
//           let Voucher_Head = {
//             defaultAmount: vh.DebitLC == 0 ? vh.CreditLC : vh.DebitLC,
//             amount: vh.DebitVC == 0 ? vh.CreditVC : vh.DebitVC,
//             type: vh.DebitLC == 0 ? "credit" : "debit",
//             narration: vh.NarrationVD,
//             accountType: vh.GL_COA.GL_COASubCategory.SubCategory,
//             createdAt: vch.AddOn,
//             updatedAt: vch.EditOn?vch.EditOn:vch.AddOn || moment().format("YYYY-MM-DD"),
//             VoucherId: vch.id,
//             ChildAccountId: accountMap.get(`${vh.GL_COA.AccountName}`).id,
//           }
//           await Voucher_Heads.create(Voucher_Head, { silent: true });
//         }
//       }
//     }

//     if(CP.GL_AgentInvoice_Charges?.Agent_Invoice?.Invoice){

//       let CAID = 0;

//       const accountKey = `${CP.GL_AgentInvoice_Charges?.Agent_Invoice?.Invoice.GL_Voucher.GL_Voucher_Detail[0].GL_COA?.AccountName}`;

//       if (accountMap.has(accountKey)) {
//         CAID = accountMap.get(accountKey).id;
//       } else {
//         console.warn(`⚠️ No matching account for: ${vh.GL_COA?.AccountName}`);
//       }

//       let savedInvoice = await Invoice.findOne({where:{climaxId:CP.GL_AgentInvoice_Charges.Agent_Invoice.Invoice.Id.toString()}})

//       if(!savedInvoice){
//         let i = CP.GL_AgentInvoice_Charges.Agent_Invoice.Invoice
//         let invoiceiType = "Agent Invoice"
//         let invoicePayType = "Recievable"
//         let invoiceOperation = "AI"
//         let partyCode = 0


//         if(i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("RECEIVABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("ASSETS") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LIABILITIES") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LAIBILITY")){
//           partyCode = i.GL_Voucher.GL_Voucher_Detail[0].COAAccountId
//           // partyName = i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.AccountName
//         }else{
//           partyCode = i.GL_Voucher.GL_Voucher_Detail[1].COAAccountId
//           // partyName = i.GL_Voucher.GL_Voucher_Detail[1].GL_COA.AccountName
//         }

//         const account = await Child_Account.findOne({
//           where: { code: partyCode.toString() },
//         })

//         let ipartyType = ''

//         if(CP.VendorId == job.ClientId){
//           ipartyType = "client"
//         }else if(CP.VendorId == job.ConsigneeId){
//           ipartyType = "client" 
//         }else if(CP.VendorId == job.ShipperId){
//           ipartyType = "client"
//         }else if(CP.VendorId == job.OverseasAgentId){
//           ipartyType = "agent"
//         }else{
//           ipartyType = "vendor"
//         }

//         let CA = null

//         if(account){
//           if(ipartyType == "client"){
//             CA = await Client_Associations.findOne({
//               where: {
//                 ChildAccountId: account.id
//               }
//             })
//           }else{
//             CA = await Vendor_Associations.findOne({
//               where: {
//                 ChildAccountId: account.id
//               }
//             })
//           }
          
//           if(!CA){
//             CA = await Client_Associations.findOne({
//               where: {
//                 ChildAccountId: account.id
//               }
//             })
//             if(!CA){
//               CA = await Vendor_Associations.findOne({
//               where: {
//                 ChildAccountId: account.id
//               }
//             })
//             }
//           }
//         }


//         let inv = {
//           invoice_No: i.InvoiceNumber,
//           invoice_Id: i.InvoiceNumber.split("-")[2].split("/")[0].replace(/^0+/, ""),
//           type: invoiceiType,
//           payType: invoicePayType,
//           status: '1',
//           operation: invoiceOperation,
//           currency: i.GL_Currencies.CurrencyCode,
//           ex_rate: i.ExchangeRate,
//           party_Id: CA.ClientId,
//           party_Name: account.title,
//           paid: 0,
//           recieved: 0,
//           roundOff: '0',
//           total: i.InvoiceAmount,
//           approved: '1',
//           companyId: companyId,
//           partyType: ipartyType,
//           note: i.Remarks,
//           createdAt: moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
//           updatedAt: i.invoiceDate?moment(i.invoiceDate):moment(i.invoiceDate) || moment().format("YYYY-MM-DD"),
//           SEJobId: savedJob.id,
//           climaxId: i.Id
//         }
//         savedInvoice = await Invoice.create(inv, { silent: true })

//         if(!invoice){
//           savedCP.update({InvoiceId:savedInvoice.id})
//         }

//         let p
//         if(i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LIABILITIES") || i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("LAIBILITY")){
//           // console.log("------Vendor------")
//           let temp = await Vendor_Associations.findOne({
//             where: {
//               CompanyId: companyId,
//               ChildAccountId: CAID
//             }
//           })
//           if(temp){
//             p = await Clients.findOne({
//               where: {
//                 id: temp.VendorId
//               }
//             })
//           }
//           if(!p){
//             let temp = await Client_Associations.findOne({
//               where: {
//                 CompanyId: companyId,
//                 ChildAccountId: CAID
//               }
//             })
//             if(temp){
//               p = await Clients.findOne({
//                 where: {
//                   id: temp.ClientId
//                 }
//               })
//             }
//           }
//         }else{
//           // console.log("------Client------")
//           let temp = await Client_Associations.findOne({
//             where: {
//               CompanyId: companyId,
//               ChildAccountId: CAID
//             }
//           })
//           if(temp){
//             p = await Clients.findOne({
//               where: {
//                 id: temp.ClientId
//               }
//             })
//           }
//           if(!p){
//             let temp = await Vendor_Associations.findOne({
//               where: {
//                 CompanyId: companyId,
//                 ChildAccountId: CAID
//               }
//             })
//             if(temp){
//               p = await Clients.findOne({
//                 where: {
//                   id: temp.VendorId
//                 }
//               })
//             }
//           }
//         }
//         if(!p){
//           // console.log(party)
//           console.warn(`⚠️ No matching party for: ${i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.AccountName} CAID: ${CAID} CompanyId: ${companyId} Parent: ${i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName}`);
//         }

//         let vch = await Vouchers.create({
//           voucher_No: i.GL_Voucher.VoucherNo.split("-")[2].split("/")[0].replace(/^0+/, ""),
//           voucher_Id: i.GL_Voucher.VoucherNo,
//           type: i.GL_Voucher.GL_VoucherType.VoucherType,
//           vType: i.GL_Voucher.GL_VoucherType.TypeCode,
//           currency: i.GL_Voucher.GL_Currencies?.CurrencyCode ?? "PKR",
//           exRate: i.GL_Voucher.ExchangeRate,
//           chequeNo: i.GL_Voucher.GL_Voucher_Detail[0].ChequeNumber,
//           chequeDate: i.GL_Voucher.GL_Voucher_Detail[0].ChequeDate,
//           voucherNarration: i.GL_Voucher.Narration,
//           costCenter: "KHI",
//           onAccount: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
//           partyId: p.id,
//           partyName: p.name,
//           partyType: i.GL_Voucher.GL_Voucher_Detail[0].GL_COA.GL_COA.AccountName.includes("PAYABLE") ? 'vendor' : 'client',
//           tranDate: i.GL_Voucher.VoucherDate,
//           createdBy: i.GL_Voucher.AddLog,
//           createdAt: i.GL_Voucher.AddOn,
//           updatedAt: i.GL_Voucher.EditOn?i.GL_Voucher.EditOn:i.GL_Voucher.AddOn,
//           CompanyId: companyId,
//           invoice_Id: savedInvoice.id
//         }, { silent: true });

//         for(let vh of i.GL_Voucher.GL_Voucher_Detail){
//           let Voucher_Head = {
//             defaultAmount: vh.DebitLC == 0 ? vh.CreditLC : vh.DebitLC,
//             amount: vh.DebitVC == 0 ? vh.CreditVC : vh.DebitVC,
//             type: vh.DebitLC == 0 ? "credit" : "debit",
//             narration: vh.NarrationVD,
//             accountType: vh.GL_COA.GL_COASubCategory.SubCategory,
//             createdAt: vch.AddOn,
//             updatedAt: vch.EditOn?vch.EditOn:vch.AddOn || moment().format("YYYY-MM-DD"),
//             VoucherId: vch.id,
//             ChildAccountId: accountMap.get(`${vh.GL_COA.AccountName}`).id,
//           }
//           await Voucher_Heads.create(Voucher_Head, { silent: true });
//         }
//       }
//     }
//   }
// }

const UploadChargesRecv = async (Charge, job, savedJob, accountMap, companyId) => {
  for (let CP of Charge) {

    const charge = await Charges.findOne({ where: { code: CP.ChargesId } });

    let party = await Clients.findOne({
      where: { climaxId: CP.Customer.Id }
    });

    let invoice_id;
    let invoiceType;
    let partyType;
    let invoice;

    /* ---------------- Invoice Detection ---------------- */

    if (CP.GL_JobInvoice_Charges) {
      invoice_id = CP.GL_JobInvoice_Charges?.JobInvoice?.Invoice?.InvoiceNumber;
      invoiceType = "Job Invoice";
      partyType = "client";
      invoice = await Invoice.findOne({
        where: {
          climaxId: CP.GL_JobInvoice_Charges?.JobInvoice?.Invoice?.Id.toString()
        }
      });
    }
    else if (CP.GL_AgentInvoice_Charges) {
      invoice_id = CP.GL_AgentInvoice_Charges?.Agent_Invoice?.Invoice?.InvoiceNumber;
      invoiceType = "Agent Invoice";
      partyType = "agent";
      invoice = await Invoice.findOne({
        where: {
          climaxId: CP.GL_AgentInvoice_Charges.Agent_Invoice.Invoice.Id.toString()
        }
      });
    }

    /* ---------------- Charge Head ---------------- */

    const ChargeP = {
      charge: charge?.id,
      particular: charge?.name,
      invoice_id,
      description: CP.Description,
      name: CP.Customer.PartyName,
      partyId: party.id,
      invoiceType,
      type: "Recievable",
      basis: CP.Charges.PerUnitFixedId == 1 ? "Per Unit" : "Per Shipment",
      pp_cc: CP.PPCCId == 1 ? "PP" : "CC",
      size_type: CP.EquipCode,
      dg_type: job.DGNonDGId == 1 ? "DG" : "non-DG",
      qty: CP.Quantity,
      rate_charge: CP.Rate,
      currency: CP.Currency.CurrencyCode,
      amount: "1",
      discount: CP.DiscountAmount,
      taxPerc: 0,
      tax_apply: CP.TaxAmount > 0,
      tax_amount: CP.TaxAmount,
      net_amount: CP.NetAmount,
      ex_rate: CP.ExchRateClient,
      local_amount: CP.LocalAmount,
      status: 1,
      approved_by: "",
      approved_date: "",
      partyType,
      InvoiceId: invoice?.id,
      SEJobId: savedJob.id
    };

    const savedCP = await Charge_Head.create(ChargeP);

    /* ======================================================
       JOB INVOICE (RECEIVABLE)
    ====================================================== */

    if (CP.GL_JobInvoice_Charges?.JobInvoice?.Invoice) {

      const i = CP.GL_JobInvoice_Charges.JobInvoice.Invoice;

      const accountKey =
        i.GL_Voucher.GL_Voucher_Detail[0].GL_COA?.AccountName;

      const CAID = accountMap.get(accountKey)?.id;

      let savedInvoice = await Invoice.findOne({
        where: { climaxId: i.Id.toString() }
      });

      if (!savedInvoice) {

        const account = await Child_Account.findOne({
          where: {
            id: i.GL_Voucher.GL_Voucher_Detail[0].COAAccountId.toString()
          }
        });

        const CA = account
          ? await Client_Associations.findOne({
              where: { ChildAccountId: account.id }
            })
          : null;

        const inv = {
          invoice_No: i.InvoiceNumber,
          invoice_Id: i.InvoiceNumber.split("-")[2].split("/")[0].replace(/^0+/, ""),
          type: "Job Invoice",
          payType: "Recievable",
          status: "1",
          operation: "AI",
          currency: i.GL_Currencies.CurrencyCode,
          ex_rate: i.ExchangeRate,
          party_Id: CA?.ClientId,
          party_Name: account?.title,
          paid: 0,
          recieved: 0,
          roundOff: "0",
          total: i.InvoiceAmount,
          approved: "1",
          companyId,
          partyType: "client",
          note: i.Remarks,
          createdAt: moment(i.invoiceDate),
          updatedAt: moment(i.invoiceDate),
          SEJobId: savedJob.id,
          climaxId: i.Id
        };

        savedInvoice = await Invoice.create(inv, { silent: true });

        if (!invoice) {
          await savedCP.update({ InvoiceId: savedInvoice.id });
        }

        const temp = CAID
          ? await Client_Associations.findOne({
              where: { ChildAccountId: CAID }
            })
          : null;

        const p = temp
          ? await Clients.findOne({ where: { id: temp.ClientId } })
          : null;

        const vch = await Vouchers.create({
          voucher_No: i.GL_Voucher.VoucherNo.split("-")[2].split("/")[0].replace(/^0+/, ""),
          voucher_Id: i.GL_Voucher.VoucherNo,
          type: i.GL_Voucher.GL_VoucherType.VoucherType,
          vType: i.GL_Voucher.GL_VoucherType.TypeCode,
          currency: i.GL_Voucher.GL_Currencies?.CurrencyCode ?? "PKR",
          exRate: i.GL_Voucher.ExchangeRate,
          chequeNo: i.GL_Voucher.GL_Voucher_Detail[0].ChequeNumber,
          chequeDate: i.GL_Voucher.GL_Voucher_Detail[0].ChequeDate,
          voucherNarration: i.GL_Voucher.Narration,
          costCenter: "KHI",
          onAccount: "client",
          partyId: p?.id,
          partyName: p?.name,
          partyType: "client",
          tranDate: i.GL_Voucher.VoucherDate,
          createdBy: i.GL_Voucher.AddLog,
          createdAt: i.GL_Voucher.AddOn,
          updatedAt: i.GL_Voucher.EditOn ?? i.GL_Voucher.AddOn,
          CompanyId: companyId,
          invoice_Id: savedInvoice.id
        }, { silent: true });

        for (let vh of i.GL_Voucher.GL_Voucher_Detail) {
          await Voucher_Heads.create({
            defaultAmount: vh.DebitLC == 0 ? vh.CreditLC : vh.DebitLC,
            amount: vh.DebitVC == 0 ? vh.CreditVC : vh.DebitVC,
            type: vh.DebitLC == 0 ? "credit" : "debit",
            narration: vh.NarrationVD,
            accountType: vh.GL_COA.GL_COASubCategory.SubCategory,
            createdAt: vch.createdAt,
            updatedAt: vch.updatedAt,
            VoucherId: vch.id,
            ChildAccountId: accountMap.get(vh.GL_COA.AccountName)?.id
          }, { silent: true });
        }
      }
    }
  }
};


routes.post("/UploadAEJobs", async (req, res) => {
  try{
    // console.log("Jobs Length:", req.body)

    let jobs = []

    for(let job of req.body){

      console.log(job.JobNumber)

      const Client = await safeFindOne(Clients, job.ClientId);
      const AirLine = await safeFindOne(Clients, job.AirLineId);
      const OverseasAgent = await safeFindOne(Clients, job.OverseasAgentId);
      const LocalAgent = await safeFindOne(Clients, job.LocalAgentId);
      const CustomClearance = await safeFindOne(Clients, job.CustomClearanceId);
      const Transporter = await safeFindOne(Clients, job.TransporterId);
      const Forwarder = await safeFindOne(Clients, job.ForwarderId);
      const ShippingLine = await safeFindOne(Clients, job.ShippingLineId);
      const Consignee = await safeFindOne(Clients, job.ConsigneeId);
      const Shipper = await safeFindOne(Clients, job.ShipperId);
      const commodity = await safeFindOne(Commodity, job.CommodityId);
      // const vessel = await safeFindOne(Vessel, job.VesselId);
      // let voyage
      // vessel ? voyage = await Voyage.findOne({
      //   where: {
      //     VesselId: vessel.id,
      //     voyage: job.VoyageNo
      //   }
      // }) : null

      let j = {
        jobNo: job.JobNumber,
        jobId: job.JobNumber.split("/")[0].split("-").pop(),
        // title: 1,
        customerRef: job.CustomerRefNo,
        fileNo: job.FileNumber,
        shipStatus: job.ShipmentStatusId == 1 ? "Shipped" : "Booked" ,
        teu: job.TEUS,
        bkg: job.BookingWeight,
        pcs: job.NoOfPackages,
        vol: job.Volume,
        volWeight: job.Weight,
        pol: job.PortOfLoading?.UNLocCode,
        pod: job.PortOfDischarge?.UNLocCode,
        fd: job.PortOfFinalDest?.UNLocCode,
        dg: job.DGNonDGId == 1 ? "DG" : "non-DG",
        subType: job.SubTypeId == 3 ? "FCL" : "LCL",
        billVol: "",
        shpVol: job.Volume,
        weight: job.Weight,
        weightUnit: job.WTUnitId,
        costCenter: job.CostCenter?.LOVCode,
        jobType: job.JobTypeId == 1 ? "Direct" : job.JobTypeId == 2 ? "Coloaded" : "Cross Trade",
        jobKind: job.JobKindId == 1 ? "Current" : "Opening",
        container: "",
        // carrier: 1,
        freightType: job.FreightTypeId,
        nomination: 1,
        transportCheck: Transporter ? "" : "Transport"  ,
        customCheck: CustomClearance ? "" : "Custom Clearance",
        etd: job.PlannedETD,
        eta: job.PlannedETA,
        // cbkg: 1,
        aesDate: job.AESDateTime,
        eRcDate: job.ERecDateTime,
        eRlDate: job.ERLSDateTime,
        jobDate: job.JobDate,
        shipDate: job.SailingDate,
        doorMove: job.DoorMoveOnDate,
        cutOffDate: job.CutOffDateTime,
        siCutOoffDate: job.SICUTOFFDateTime,
        vgmCutOffDate: job.VGMCUTOFFDateTime,
        freightPaybleAt: job.FreightPayableAt?.UNLocName,
        terminal: job?.Terminal?.LocationName,
        delivery: job.DeliveryTypeId,
        companyId: job.SubCompanyId == 2 ? 1 : 3,
        pkgUnit: job.WTUnitId,
        incoTerms: job.IncoTerms?.IncoCode,
        exRate: job.ExRateBuying,
        approved: job.ApprovedStatusId == 2 ? "true" : "false",
        canceled: false,
        cwtLine: "",
        cwtClient: "0",
        operation: "AE",
        arrivalDate: "",
        arrivalTime: "",
        departureDate: "",
        departureTime: "",
        createdAt: job.AddOn,
        updatedAt: job.EditOn?job.EditOn:job.AddOn,
        ClientId: Client?.id,
        // VoyageId: voyage?.id,
        salesRepresentatorId: '3d237d09-d8ba-47f1-8764-22cff8e11639',
        overseasAgentId: OverseasAgent?.id,
        shippingLineId: ShippingLine?.id,
        localVendorId: LocalAgent?.id,
        customAgentId: CustomClearance?.id,
        transporterId: Transporter?.id,
        createdById: '4d7f7cfb-7ace-4655-b6ee-f9ed52f81799',
        commodityId: commodity?.id,
        consigneeId: Consignee?.id,
        forwarderId: Forwarder?.id,
        shipperId: Shipper?.id,
        airLineId: AirLine?.id,
        climaxId: job.Id,
      }

      const savedJob = await SE_Job.create(j)

      jobs.push(j)
      if(job.SExp_BL){
        
        let bl = job.SExp_BL
  
        let BL = {
          operation: "AE",
          hbl: bl.HAWBNo,
          // no: 1,
          hblDate: bl.HAWBDate,
          hblIssue: "",
          mbl: bl.MAWBNo,
          mblDate: bl.MAWBDate,
          status: bl.StatusId == 1 ? "Draft" : "Final", //find reference from climax then add
          blReleaseStatus: "Original", //find reference from climax then add
          blhandoverType: "By Hand", //find reference from climax then add
          releaseInstruction: "", //find reference from climax then add
          remarks: "", //find reference from climax then add
          sailingDate: bl.SailingDate,
          shipDate: job.SailingDate,
          shipperContent: formatAddress(bl.Shipper),
          consigneeContent: formatAddress(bl.Consignee),
          notifyOneContent: formatAddress(bl.NotifyParty1),
          notifyTwoContent: formatAddress(bl.NotifyParty2),
          deliveryContent: formatAddress(bl.DeliveryAgent),
          marksContent: formatAddress(bl.MarksAndNumber),
          marksContentTwo: "",
          noOfPckgs: bl.NoOfPkgs,
          descOfGoodsContent: formatAddress(bl.GoodsDescription),
          descOfGoodsContentTwo: "",
          grossWeightContent: formatAddress(bl.GrossWeight1),
          measurementContent: "",
          AgentStamp: "",
          hs: "",
          onBoardDate: "",
          IssuePlace: bl.PlaceOfIssue,
          IssueDate: bl.PlaceOfIssueDate,
          poDeliveryTwo: "",
          podTwo: "",
          polTwo: "",
          agentM3: job.AgentInstruction,
          coloadM3: "",
          noBls: bl.NoOfOriginalBL,
          formE: bl.FormENumber,
          formEDate: bl.FormEDate,
          date1: "",
          date2: "",
          declareCarriage: "",
          declareCustoms: "",
          insurance: "",
          handlingInfo: "",
          toOne: "",
          toTwo: "",
          toThree: "",
          byOne: "",
          byTwo: "",
          byFirstCarrier: "",
          currency: "",
          charges: "",
          wtValPPC: "",
          wtVatCOLL: "",
          othersPPC: "",
          othersCOLL: "",
          ppWeightCharges: "0",
          ccWeightCharges: "0",
          ppvaluationCharges: "0",
          ccvaluationCharges: "0",
          ppTax: "0",
          ccTax: "0",
          ppOtherDueChargeAgent: "0",
          ccOtherDueChargeAgent: "0",
          ppOtherDueChargeCarrier: "0",
          ccOtherDueChargeCarrier: "0",
          ppTotal: "0",
          ccTotal: "0",
          applyToCWT: "0",
          createdAt: bl.AddOn,
          updatedAt: bl.EditOn?bl.EditOn:bl.AddOn,
          SEJobId: savedJob.id,
          // notifyPartyOneId: 1,
          // notifyPartyTwoId: 1,
        }
  
        const savedBl = await Bl.create(BL)
      }

      const accounts = await Child_Account.findAll({ include: [
        { model: Child_Account, as: 'parent' }
      ] });
      const accountMap = new Map();
      accounts.forEach((a) => {
        // const companyId = a.Child_Account?.CompanyId;
        accountMap.set(`${a.title}`, { id: a.id, subCategory: a.subCategory });
      });
      const companyId = job.SubCompanyId == 2 ? 1 : 3;

      if(job.SeaExportJob_ChargesPayb){
        await UploadChargesPayb(job.SeaExportJob_ChargesPayb, job, savedJob, accountMap, companyId)
      }

      if(job.SeaExportJob_ChargesRecv){
        await UploadChargesRecv(job.SeaExportJob_ChargesRecv, job, savedJob, accountMap, companyId)
      }
    }

    res.json({ status: "success", result: jobs });
  }catch(e){
    console.log(e)
    res.json({ status: "error", result: e.toString() });
  }
})

routes.post("/UploadAIJobs", async (req, res) => {
  try{
    // console.log("Jobs Length:", req.body)

    let jobs = []

    for(let job of req.body){

      console.log(job.JobNumber)

      const Client = await safeFindOne(Clients, job.ClientId);
      const AirLine = await safeFindOne(Clients, job.AirLineId);
      const OverseasAgent = await safeFindOne(Clients, job.OverseasAgentId);
      const LocalAgent = await safeFindOne(Clients, job.LocalAgentId);
      const CustomClearance = await safeFindOne(Clients, job.CustomClearanceId);
      const Transporter = await safeFindOne(Clients, job.TransporterId);
      const Forwarder = await safeFindOne(Clients, job.ForwarderId);
      const ShippingLine = await safeFindOne(Clients, job.ShippingLineId);
      const Consignee = await safeFindOne(Clients, job.ConsigneeId);
      const Shipper = await safeFindOne(Clients, job.ShipperId);
      const commodity = await safeFindOne(Commodity, job.CommodityId);
      // const vessel = await safeFindOne(Vessel, job.VesselId);
      // let voyage
      // vessel ? voyage = await Voyage.findOne({
      //   where: {
      //     VesselId: vessel.id,
      //     voyage: job.VoyageNo
      //   }
      // }) : null

      let j = {
        jobNo: job.JobNumber,
        jobId: job.JobNumber.split("/")[0].split("-").pop(),
        // title: 1,
        customerRef: job.CustomerRefNo,
        fileNo: job.FileNumber,
        shipStatus: job.ShipmentStatusId == 1 ? "Shipped" : "Booked" ,
        teu: job.TEUS,
        bkg: job.BookingWeight,
        pcs: job.NoOfPackages,
        vol: job.Volume,
        volWeight: job.Weight,
        pol: job.PortOfLoading?.UNLocCode,
        pod: job.PortOfDischarge?.UNLocCode,
        fd: job.PortOfFinalDest?.UNLocCode,
        dg: job.DGNonDGId == 1 ? "DG" : "non-DG",
        subType: job.SubTypeId == 3 ? "FCL" : "LCL",
        billVol: "",
        shpVol: job.Volume,
        weight: job.Weight,
        weightUnit: job.WTUnitId,
        costCenter: job.CostCenter?.LOVCode,
        jobType: job.JobTypeId == 1 ? "Direct" : job.JobTypeId == 2 ? "Coloaded" : "Cross Trade",
        jobKind: job.JobKindId == 1 ? "Current" : "Opening",
        container: "",
        // carrier: 1,
        freightType: job.FreightTypeId,
        nomination: 1,
        transportCheck: Transporter ? "" : "Transport"  ,
        customCheck: CustomClearance ? "" : "Custom Clearance",
        etd: job.PlannedETD,  
        eta: job.PlannedETA,
        // cbkg: 1,
        aesDate: job.AESDateTime,
        eRcDate: job.ERecDateTime,
        eRlDate: job.ERLSDateTime,
        jobDate: job.JobDate,
        shipDate: job.SailingDate,
        doorMove: job.DoorMoveOnDate,
        cutOffDate: job.CutOffDateTime,
        siCutOoffDate: job.SICUTOFFDateTime,
        vgmCutOffDate: job.VGMCUTOFFDateTime,
        freightPaybleAt: job.FreightPayableAt?.UNLocName,
        terminal: job?.Terminal?.LocationName,
        delivery: job.DeliveryTypeId,
        companyId: job.SubCompanyId == 2 ? 1 : 3,
        pkgUnit: job.WTUnitId,
        incoTerms: job.IncoTerms?.IncoCode,
        exRate: job.ExRateBuying,
        approved: job.ApprovedStatusId == 2 ? "true" : "false",
        canceled: false,
        cwtLine: "",
        cwtClient: "0",
        operation: "AI",
        arrivalDate: "",
        arrivalTime: "",
        departureDate: "",
        departureTime: "",
        createdAt: job.AddOn,
        updatedAt: job.EditOn?job.EditOn:job.AddOn,
        ClientId: Client?.id,
        // VoyageId: voyage?.id,
        salesRepresentatorId: '3d237d09-d8ba-47f1-8764-22cff8e11639',
        overseasAgentId: OverseasAgent?.id,
        shippingLineId: ShippingLine?.id,
        localVendorId: LocalAgent?.id,
        customAgentId: CustomClearance?.id,
        transporterId: Transporter?.id,
        createdById: '4d7f7cfb-7ace-4655-b6ee-f9ed52f81799',
        commodityId: commodity?.id,
        consigneeId: Consignee?.id,
        forwarderId: Forwarder?.id,
        shipperId: Shipper?.id,
        airLineId: AirLine?.id,
        climaxId: job.Id,
      }

      const savedJob = await SE_Job.create(j)

      jobs.push(j)
      if(job.SExp_BL){
        
        let bl = job.SExp_BL
  
        let BL = {
          operation: "AI",
          hbl: bl.HAWBNo,
          // no: 1,
          hblDate: bl.HAWBDate,
          hblIssue: "",
          mbl: bl.MAWBNo,
          mblDate: bl.MAWBDate,
          status: bl.StatusId == 1 ? "Draft" : "Final", //find reference from climax then add
          blReleaseStatus: "Original", //find reference from climax then add
          blhandoverType: "By Hand", //find reference from climax then add
          releaseInstruction: "", //find reference from climax then add
          remarks: "", //find reference from climax then add
          sailingDate: bl.SailingDate,
          shipDate: job.SailingDate,
          shipperContent: formatAddress(bl.Shipper),
          consigneeContent: formatAddress(bl.Consignee),
          notifyOneContent: formatAddress(bl.NotifyParty1),
          notifyTwoContent: formatAddress(bl.NotifyParty2),
          deliveryContent: formatAddress(bl.DeliveryAgent),
          marksContent: formatAddress(bl.MarksAndNumber),
          marksContentTwo: "",
          noOfPckgs: bl.NoOfPkgs,
          descOfGoodsContent: formatAddress(bl.GoodsDescription),
          descOfGoodsContentTwo: "",
          grossWeightContent: formatAddress(bl.GrossWeight1),
          measurementContent: "",
          AgentStamp: "",
          hs: "",
          onBoardDate: "",
          IssuePlace: bl.PlaceOfIssue,
          IssueDate: bl.PlaceOfIssueDate,
          poDeliveryTwo: "",
          podTwo: "",
          polTwo: "",
          agentM3: job.AgentInstruction,
          coloadM3: "",
          noBls: bl.NoOfOriginalBL,
          formE: bl.FormENumber,
          formEDate: bl.FormEDate,
          date1: "",
          date2: "",
          declareCarriage: "",
          declareCustoms: "",
          insurance: "",
          handlingInfo: "",
          toOne: "",
          toTwo: "",
          toThree: "",
          byOne: "",
          byTwo: "",
          byFirstCarrier: "",
          currency: "",
          charges: "",
          wtValPPC: "",
          wtVatCOLL: "",
          othersPPC: "",
          othersCOLL: "",
          ppWeightCharges: "0",
          ccWeightCharges: "0",
          ppvaluationCharges: "0",
          ccvaluationCharges: "0",
          ppTax: "0",
          ccTax: "0",
          ppOtherDueChargeAgent: "0",
          ccOtherDueChargeAgent: "0",
          ppOtherDueChargeCarrier: "0",
          ccOtherDueChargeCarrier: "0",
          ppTotal: "0",
          ccTotal: "0",
          applyToCWT: "0",
          createdAt: bl.AddOn,
          updatedAt: bl.EditOn?bl.EditOn:bl.AddOn,
          SEJobId: savedJob.id,
          // notifyPartyOneId: 1,
          // notifyPartyTwoId: 1,
        }
  
        const savedBl = await Bl.create(BL)
      }

      const accounts = await Child_Account.findAll({ include: [
        { model: Child_Account, as: 'parent' }
      ] });
      const accountMap = new Map();
      accounts.forEach((a) => {
        const companyId = a.Parent_Account?.CompanyId;
        if (companyId) {
          accountMap.set(`${a.title}`, { id: a.id, subCategory: a.subCategory });
        }
      });
      const companyId = job.SubCompanyId == 2 ? 1 : 3;

      if(job.SeaExportJob_ChargesPayb){
        await UploadChargesPayb(job.SeaExportJob_ChargesPayb, job, savedJob, accountMap, companyId)
      }

      if(job.SeaExportJob_ChargesRecv){
        await UploadChargesRecv(job.SeaExportJob_ChargesRecv, job, savedJob, accountMap, companyId)
      }
    }

    res.json({ status: "success", result: jobs });
  }catch(e){
    console.log(e)
    res.json({ status: "error", result: e.toString() });
  }
})

module.exports = routes;