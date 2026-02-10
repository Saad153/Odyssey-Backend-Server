const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require("../../models");
const moment = require("moment");
const routes = require('express').Router();
// const { History } = require("../../functions/Associations/historyAssociations");
const { Employees } = require("../../functions/Associations/employeeAssociations");
const { Clients, Client_Associations } = require("../../functions/Associations/clientAssociation");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { Voucher_Heads } = require('../../functions/Associations/voucherAssociations');
// const { Vendors, Vendor_Associations } = require("../../functions/Associations/vendorAssociations");

const validTypes = [
  "Slot Operator",
  "Buyer",
  "Terminal",
  "Depot",
  "Principal",
  "Stevedore",
  "Cartage",
  "Drayman",
  "Trucking",
  "Air Line",
  "Buying House",
  "Warehouse",
  "Delivery Agent",
  "Shipping Line",
  "CHA/CHB",
  "Transporter",
  "Indentor",
  "Commission Agent",
  "Overseas Agent",
  "Potential Customer",
  "Non operational Party",
  "Forwarder/Coloader",
  "Local Vendor"
];

const createChildAccounts = (list, name) => {
    let result = [];
    list.forEach((x)=>{
        result.push({title:name, ParentAccountId:x.id, subCategory:'Customer'})
    })
    return result;
}
const createAccountList = (parent, child, id) => {
    let result = [];
    parent.forEach((x, i)=>{
        result[i] = {
            ClientId:id,
            CompanyId:x.CompanyId,
            ParentAccountId:x.id,
            ChildAccountId:null
        }
        child.forEach((y, j)=>{
            if(y.ParentAccountId==x.id){
                result[i].ChildAccountId=child[j].id
            }
        })
    })
    return result;
}

routes.post("/addClient", async(req, res)=>{
    try{
        // console.log(req.body)
        const result = await Clients.create(req.body)
        console.log(result)
        res.json({
            status:'success', 
            result:result.dataValues
        });
    }catch(e){
        res.json({status:'error', result:e});
        console.error(e)
    }
})

routes.post("/createClientAssociations", async(req, res) => {
    try{
        const result1 = await Clients.findOne({
            attributes:['id', 'name'],
            where:{
                name: req.body.name
            }
        })
        const ChAcc = await Child_Account.findOne({
            where:{
                id: req.body.ChildAccountId
            },
            attributes:['id', 'title', 'ParentAccountId'],
        })
        // for(let x of result1){
        //     console.log(x.dataValues)

        // }
        // console.log(result1.dataValues.id)
        // console.log(req.body.companyId)
        // console.log(ChAcc.dataValues.ParentAccountId)
        // console.log(ChAcc.dataValues.id)
        const result = await Client_Associations.create({
            ClientId: result1.dataValues.id,
            CompanyId: req.body.companyId,
            ParentAccountId: ChAcc.dataValues.ParentAccountId,
            ChildAccountId: ChAcc.dataValues.id
        });        
        console.log(result.dataValues)
        res.json({status: 'success', result:result.dataValues});
    }catch(e){
        res.json({status:'error', result:e});
        console.error(e)
    }
})

routes.post("/createClient", async(req, res) => {
    
    try {
        let value = req.body;
        value.operations = value.operations.join(', ');
        value.types = value.types.join(', ');
        delete value.id
        const check = await Clients.findOne({
            where:{
                [Op.and]: [
                    { code: { [Op.ne]: 'CU-00633' } },
                    { code: { [Op.ne]: 'CC-00884' } },
                    { code: { [Op.ne]: 'CU-00647' } },
                    { code: { [Op.ne]: 'CU-00013' } },
                    { code: { [Op.ne]: 'CU-00721' } },
                    { code: { [Op.ne]: 'CU-00902' } },
                    { code: { [Op.ne]: 'CU-00146' } },
                    { code: { [Op.ne]: 'CC-11914' } },
                ]
            },
            attributes:['code'],
            order: [ [ 'createdAt', 'DESC' ]]
        })
        if(!check){
            check.code = 0
        }
        value.accountRepresentatorId = value.accountRepresentatorId==""?null:value.accountRepresentatorId;
        value.salesRepresentatorId = value.salesRepresentatorId==""?null:value.salesRepresentatorId;
        value.docRepresentatorId = value.docRepresentatorId==""?null:value.docRepresentatorId;
        value.authorizedById = value.authorizedById==""?null:value.authorizedById;
        value.nongl = null
        console.log(value)
        const check2 = await Clients.findOne({
            where: {
                name: value.name
            }
        })
        if(check2){
            return res.json({status:'exists', message:"Client Already Exists"});
        }
        const result = await Clients.create({...value, code : parseInt(check.code) + 1 })   
        console.log(result)
        
        const accounts = await Parent_Account.findAll({
            where: { title: { [Op.or]: [`${req.body.pAccountName}`] } }
        });
        const accountsList = await Child_Account.bulkCreate(createChildAccounts(accounts, result.name));
        await Client_Associations.bulkCreate(createAccountList(accounts, accountsList, result.id));
        res.json({
            status:'success', 
            result:result
        });
    }
    catch (error) {
        console.error(error)
        res.json({status:'error', result:error});
    }
});

routes.post("/createClientInBulk", async(req, res) => {

    const createChildAccounts = (list, name) => {
        let result = [];
        list.forEach((x)=>{
            result.push({title:name+ `${x.title=="ACCOUNT RECEIVABLE"?" RECEIVABLE":" PAYABLE"}`, ParentAccountId:x.id, subCategory:'Customer'})
        })
        return result;
    }
    const createAccountList = (parent, child, id) => {
        let result = [];
        parent.forEach((x, i)=>{
            result[i] = {
                ClientId:id,
                CompanyId:x.CompanyId,
                ParentAccountId:x.id,
                ChildAccountId:null
            }
            child.forEach((y, j)=>{
                if(y.ParentAccountId==x.id){
                    result[i].ChildAccountId=child[j].id
                }
            })
        })
        return result;
    }

    try {
        await obj.forEach(async(val, i)=>{
            let value = {...val};
            value.accountRepresentatorId = null;
            value.salesRepresentatorId   = null;
            value.docRepresentatorId     = null;
            value.authorizedById         = null;
            value.createdBy              = "";
            const result = await Clients.create({...value}).catch((x)=>console.log(x))
            const accounts = await Parent_Account.findAll({
                where: {
                    CompanyId: { [Op.or]: [1, 2, 3] },
                    title: { [Op.or]: ['ACCOUNT RECEIVABLE', 'ACCOUNT PAYABLE'] }
                }
            }).catch((x)=>console.log("===========1=============", x))
            const accountsList = await Child_Account.bulkCreate(createChildAccounts(accounts, result.name)).catch((x)=>console.log("===========2===========", x))
            Client_Associations.bulkCreate(createAccountList(accounts, accountsList, result.id)).catch((x)=>console.log("===========3===========", x))
            console.log(i)
        });

        await res.json({status:'success'});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/editClient", async(req, res) => {

    try {
        let ids = [];
        let value = req.body.data;
        value.id = value.id
        value.operations = value.operations.join(', ');
        value.types = value.types.join(', ');

        await Clients.update({...value, code: parseInt(value.code)},{where:{id:value.id}});
        const pAccountList = await Parent_Account.findAll({where:{title:req.body.pAccountName}})
        const clientAssociation = await Client_Associations.findAll({
            where:{ClientId:value.id},
        });
        if(clientAssociation.length==0){
            console.log("No Client Associations")
            const accounts = await Parent_Account.findAll({
              where: { title: { [Op.or]: [`${req.body.pAccountName}`] } }
            });
            const accountsList = await Child_Account.bulkCreate(await createChildAccounts(accounts, value.name));
            await Client_Associations.bulkCreate(createAccountList(accounts, accountsList, value.id)).catch((x)=>console.log(x))
        } else {
            clientAssociation.forEach(async(x)=>{
                ids.push(x.ChildAccountId);
                let tempChildId = pAccountList.find((y)=>y.CompanyId==x.CompanyId).id
                await Client_Associations.update({ParentAccountId:tempChildId}, {where:{id:x.id}})
            });
            await Child_Account.update({ title:value.name }, { where:{ id:ids } });
        }
        res.json({status:'success'});
    }
    catch (error) {
        console.error(error)
      res.json({status:'error', result:error});
    }
});

routes.get("/getClients", async(req, res) => {
    try {
        const result = await Clients.findAll({
            // where:{[Op.or]:[{nongl:'0'}, {[Op.eq]:{nongl:null}}]},
            attributes:['id', 'name' , 'person1', 'mobile1', 'person2', 'mobile2', 'telephone1', 'telephone2', 'address1', 'address2', 'createdBy', 'code', 'active', 'types'],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getClientById", async(req, res) => {
    try {
        const result = await Clients.findOne({
            where:{id:req.headers.id},
            include:[{
                model:Client_Associations,
                required:false,
                attributes:['id'],
                include:[{
                    where:{CompanyId:1},
                    attributes:['id', 'title'],
                    model:Child_Account,
                    include:[{
                        model:Child_Account,
                        as: 'children'
                    }]
                }]
            }]
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
        console.error(error)
      res.json({status:'error', result:error});
    }
});

routes.get("/getNotifyParties", async(req, res) => {
    try {
        const result = await Clients.findAll({
            where:{
                types:{[Op.substring]: 'Notify'},
                
            },
            attributes:['id','name', 'address1', 'address1', 'person1', 'mobile1',
            'person2', 'mobile2', 'telephone1', 'telephone2', 'infoMail'],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getForCharges", async(req, res) => {
    try {
        let obj = req.headers.id===undefined?{[Op.and]:[{nongl:{[Op.eq]:null}}]}:{[Op.and]:[{ nongl:{[Op.eq]:'0'}, id:req.headers.id }]};
        const result = await Clients.findAll({
            where:obj,
            attributes:["id", "name", "person2", "person1", "mobile1", "mobile2", "address1", "address2", "types", "city", "types", "nongl"],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/experimentalQuery", async(req, res) => {
    try {
        const [results, metadata] = await db.sequelize.query(
            `
            SELECT
                Clients.name,
                Employees.name AS EmployeeName,
                Clients.bank
            FROM Clients
            LEFT OUTER JOIN Employees ON Clients.accountRepresentatorId=Employees.id;
            `
            );
        res.json({status:'success', result:results});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

// routes.get("/getClientExperimental", async(req, res) => {
//     try {
//         const result = await Clients.findOne({
//             attributes:['id', 'name'],
//             include:[
//                 {
//                     model:Employees, as:"account_representator",
//                     attributes:['id', 'name'],
//                 },
//                 {
//                     model:Employees, as:"sales_representator",
//                     attributes:['id', 'name'],
//                 },
//                 {
//                     model:Employees, as:"doc_representator",
//                     attributes:['id', 'name'],
//                 },
//                 {
//                     model:Employees, as:"authorizedBy",
//                     attributes:['id', 'name'],
//                 },
//                 {
//                     model:Client_Associations,
//                     attributes:['CompanyId', 'ParentAccountId', 'ChildAccountId'],
//                 },
//             ],
//             where:{id:req.headers.id}
//         });
//         res.json({status:'success', result:result});
//     }
//     catch (error) {
//       res.json({status:'error', result:error});
//     }
// });

routes.get("/getChildAccounts", async(req, res) => {
    try {
        const result = await Client_Associations.findOne({
            where: {
                id: req.headers.id
            },
        });
        const result1 = await Vendor_Associations.findOne({
            where: {
                id: req.headers.id
            }
        })
        if(result){
            console.log(result)
            res.json({status:'success', result:result});
        }
        if(result1){   
            console.log(result1)
            res.json({status:'success', result:result1});
        }
    }
    catch (error) {
        console.log(error)
      res.json({status:'error', result:error});
    }
})

routes.post("/findAccounts", async(req, res) => {
    try {
        console.log(req.body);
        const result = await Parent_Account.findAll({
            where: {
                CompanyId: {
                    [Op.or]: req.body.companies
                },
                title:'Accounts Recievable'
            },
            attributes:['id', 'title']
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getClientAssociations", async(req, res) => {
    try {
        // console.log(req.headers)
        const result = await Client_Associations.findAll({
            where: {
                CompanyId: req.headers.company
            },
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
        console.log(error)
        res.json({status:'error', result:error});
    }
});

routes.post("/deleteClient", async(req, res) => {
    try{
        console.log("Delete Client:", req.body.id)
        let clientId = req.body.id
        const result0 = await Clients.findOne({where: {
            id: clientId
        }})
        if(result0){
            const result1 = await Client_Associations.findOne({
                where: {
                    ClientId: result0.dataValues.id
                }
            })
            if(result1){
                const result2 = await Child_Account.findOne({
                    where: {
                        id: result1.dataValues.ChildAccountId
                    }
                })
                if(result2){
                    const result3 = await Voucher_Heads.findOne({
                        where: {
                            ChildAccountId: result2.dataValues.id
                        }
                    })
                    if(result3){
                        return res.json({status: 'transaction'})
                    } else {
                        await Child_Account.destroy({
                            where: {
                                id: result2.dataValues.id
                            }
                        })
                        await Client_Associations.destroy({
                            where: {
                                id: result1.dataValues.id
                            }
                        })
                        await Clients.destroy({
                            where: {
                                id: result0.dataValues.id
                            }
                        })
                    }
                } else {
                    await Client_Associations.destroy({
                        where: {
                            id: result1.dataValues.id
                        }
                    })
                    await Clients.destroy({
                        where: {
                            id: result0.dataValues.id
                        }
                    })
                }
            } else {
                await Clients.destroy({
                    where: {
                        id: result0.dataValues.id
                    }
                })
            }
        } else {
            return res.json({status: 'deleted'})
        }
        console.log(result0.dataValues)
        res.json({status: 'success'})
    }catch(e){
        console.error(e)
        res.json({status: 'error', message: e})
    }
})

routes.post("/bulkCreate", async (req, res) => {
  const parties = req.body;
  try {
    let i = 1
    const accounts = await Child_Account.findAll({
        include: {
            model: Child_Account,
            as: 'parent'
        }
    });

    console.log("Accounts Fetched", accounts[10].dataValues.id)

    for (let party of parties) {
        let ops = '';

        if (party.IsAirExport) ops += 'Air Export, ';
        if (party.IsAirImport) ops += 'Air Import, ';
        if (party.IsSeaExport) ops += 'Sea Export, ';
        if (party.IsSeaImport) ops += 'Sea Import, ';

        let type = '';

        if (party.IsShipper) type += 'Shipper, ';
        if (party.IsConsignee) type += 'Consignee, ';
        if (party.IsNotify) type += 'Notify, ';
        if (party.IsPotentialCustomer) type += 'Potential Customer, ';
        if (party.IsNonOperationalParty) type += 'Non operational Party, ';
        if (party.IsForwarder) type += 'Forwarder/Coloader, ';
        if (party.IsLocalAgent) type += 'Local Vendor, ';
        if (party.IsOverseasAgent) type += 'Overseas Agent, ';
        if (party.IsCommissionAgent) type += 'Commission Agent, ';
        if (party.IsIndentor) type += 'Indentor, ';
        if (party.IsTransporter) type += 'Transporter, ';
        if (party.IsCHACHB) type += 'CHA/CHB, ';
        if (party.IsShippingLine) type += 'Shipping Line, ';
        if (party.IsDeliveryAgent) type += 'Delivery Agent, ';
        if (party.IsWarehouse) type += 'Warehouse, ';
        if (party.IsBuyingHouse) type += 'Buying House, ';
        if (party.IsAirLine) type += 'Air Line, ';
        if (party.IsTrucking) type += 'Trucking, ';
        if (party.IsDrayman) type += 'Drayman, ';
        if (party.IsCartage) type += 'Cartage, ';
        if (party.IsStevedore) type += 'Stevedore, ';
        if (party.IsPrincipal) type += 'Principal, ';
        if (party.IsDepo) type += 'Depot, ';
        if (party.IsTerminalParty) type += 'Terminal, ';
        if (party.IsBuyer) type += 'Buyer, ';
        if (party.IsSlotOperator) type += 'Slot Operator, ';

        let COA1 = null
        // console.log(accounts[721].dataValues.id, party?.AccountId)
        // console.log(typeof(accounts[721].dataValues.id), typeof(party?.AccountId))
        accounts.forEach((account) => {
            if (account.dataValues.id == party?.AccountId) {
                COA1 = account.dataValues.id;
            }
        })
        const SNSClient = await Clients.create({
            climaxId: party.Id,
            code: i || null,
            name: party.PartyName,
            city: party.City?.UNLocName || null,
            telephone1: party.Telephone1 || null,
            telephone2: party.Telephone2 || null,
            address1: party.Address1 || null,
            address2: party.Address2 || null,
            website: party.WebSite || null,
            accountsMail: party.AccountsEmail || null,
            infoMail: party.Email || null,
            strn: party.STRN || null,
            ntn: party.NTNName || null,
            registerDate: party.DateOfRegistration || moment().format("YYYY-MM-DD"),
            operations: ops || null,
            types: type || null,
            bankAuthorizeDate: party.AuthorizationDate || moment().format("YYYY-MM-DD"),
            bank: party.BankName || null,
            branchName: party.BranchName || null,
            branchCode: party.BranchCode || null,
            accountNo: party.AccountNo || null,
            iban: party.IBAN || null,
            swiftCode: party.SwiftCode || null,
            routingNo: party.RoutingNo || null,
            ifscCode: party.IFCSCode || null,
            micrCode: party.MICRCode || null,
            currency: party.CurrencyId || "PKR",
            createdBy: party.AddLog || "System",
            active: true,
            nongl: COA1 != null ? '0' : '1'
        });
        if(COA1 != null){
            await Client_Associations.create({
                ClientId: SNSClient.id,
                // CompanyId: 1,
                // ParentAccountId: COA1.ChildAccountId,
                ChildAccountId: COA1
            })
            // await Client_Associations.create({
            //     ClientId: SNSClient.id,
            //     // CompanyId: 3,
            //     // ParentAccountId: COA1.ChildAccountId,
            //     ChildAccountId: COA1.id
            // })
        }
        // if(party.Account && (party.ParentAccount?.AccountName.includes("RECEIVABLE") || party.ParentAccount?.AccountName.includes("ASSETS") || party.Account.ParentAccountId == 4865|| party.Account.ParentAccountId == 4903) && COA1 && COA3){
        // if(type.includes("Shipper") || type.includes("Consignee") || type.includes("Notify")){

        //     const SNSClient = await Clients.create({
        //         climaxId: party.Id,
        //         code: i || null,
        //         name: party.PartyName,
        //         city: party.City?.UNLocName || null,
        //         telephone1: party.Telephone1 || null,
        //         telephone2: party.Telephone2 || null,
        //         address1: party.Address1 || null,
        //         address2: party.Address2 || null,
        //         website: party.WebSite || null,
        //         accountsMail: party.AccountsEmail || null,
        //         infoMail: party.Email || null,
        //         strn: party.STRN || null,
        //         ntn: party.NTNName || null,
        //         registerDate: party.DateOfRegistration || moment().format("YYYY-MM-DD"),
        //         operations: ops || null,
        //         types: type || null,
        //         bankAuthorizeDate: party.AuthorizationDate || moment().format("YYYY-MM-DD"),
        //         bank: party.BankName || null,
        //         branchName: party.BranchName || null,
        //         branchCode: party.BranchCode || null,
        //         accountNo: party.AccountNo || null,
        //         iban: party.IBAN || null,
        //         swiftCode: party.SwiftCode || null,
        //         routingNo: party.RoutingNo || null,
        //         ifscCode: party.IFCSCode || null,
        //         micrCode: party.MICRCode || null,
        //         currency: party.CurrencyId || "PKR",
        //         createdBy: party.AddLog || "System",
        //         active: true,
        //         nongl: party.Account ? '0' : '1'
        //     });
        //     if(party.Account){
        //         await Client_Associations.create({
        //             ClientId: SNSClient.id,
        //             CompanyId: 1,
        //             ParentAccountId: COA1.ParentAccountId,
        //             ChildAccountId: COA1.id
        //         })
        //         await Client_Associations.create({
        //             ClientId: SNSClient.id,
        //             CompanyId: 3,
        //             ParentAccountId: COA3.ParentAccountId,
        //             ChildAccountId: COA3.id
        //         })
        //     }
        // }
        // if(type.includes("Slot Operator") || type.includes("Buyer") || type.includes("Terminal") || type.includes("Depot") || type.includes("Principal") || type.includes("Stevedore") || type.includes("Cartage") || type.includes("Drayman") || type.includes("Trucking") || type.includes("Air Line") || type.includes("Buying House") || type.includes("Warehouse") || type.includes("Delivery Agent") || type.includes("Shipping Line") || type.includes("CHA/CHB") || type.includes("Transporter") || type.includes("Indentor") || type.includes("Commission Agent") || type.includes("Overseas Agent") || type.includes("Potential Customer") || type.includes("Non operational Party") || type.includes("Forwarder/Coloader") || type.includes("Local Vendor")){
        //     const SNSVendor = await Vendors.create({
        //         climaxId: party.Id,
        //         code: i || null,
        //         name: party.PartyName,
        //         city: party.City?.UNLocName || null,
        //         telephone1: party.Telephone1 || null,
        //         telephone2: party.Telephone2 || null,
        //         address1: party.Address1 || null,
        //         address2: party.Address2 || null,
        //         website: party.WebSite || null,
        //         accountsMail: party.AccountsEmail || null,
        //         infoMail: party.Email || null,
        //         strn: party.STRN || null,
        //         ntn: party.NTNName || null,
        //         registerDate: party.DateOfRegistration || moment().format("YYYY-MM-DD"),
        //         operations: ops || null,
        //         types: type || null,
        //         bankAuthorizeDate: party.AuthorizationDate || moment().format("YYYY-MM-DD"),
        //         bank: party.BankName || null,
        //         branchName: party.BranchName || null,
        //         branchCode: party.BranchCode || null,
        //         accountNo: party.AccountNo || null,
        //         iban: party.IBAN || null,
        //         swiftCode: party.SwiftCode || null,
        //         routingNo: party.RoutingNo || null,
        //         ifscCode: party.IFCSCode || null,
        //         micrCode: party.MICRCode || null,
        //         currency: party.CurrencyId || "PKR",
        //         createdBy: party.AddLog || "System",
        //         active: true,
        //         nongl: party.Account ? '0' : '1'
        //     });
        //     if(party.Account){
        //         await Vendor_Associations.create({
        //             VendorId: SNSVendor.id,
        //             CompanyId: 1,
        //             ParentAccountId: COA1.ParentAccountId,
        //             ChildAccountId: COA1.id
        //         })
        //         await Vendor_Associations.create({
        //             VendorId: SNSVendor.id,
        //             CompanyId: 3,
        //             ParentAccountId: COA3.ParentAccountId,
        //             ChildAccountId: COA3.id
        //         })
        //     }
        // }
        // if(!party.Account) {
        //     const SNSClient = await Clients.create({
        //         climaxId: party.Id,
        //         code: i || null,
        //         name: party.PartyName,
        //         city: party.City?.UNLocName || null,
        //         telephone1: party.Telephone1 || null,
        //         telephone2: party.Telephone2 || null,
        //         address1: party.Address1 || null,
        //         address2: party.Address2 || null,
        //         website: party.WebSite || null,
        //         accountsMail: party.AccountsEmail || null,
        //         infoMail: party.Email || null,
        //         strn: party.STRN || null,
        //         ntn: party.NTNName || null,
        //         registerDate: party.DateOfRegistration || moment().format("YYYY-MM-DD"),
        //         operations: ops || null,
        //         types: type || null,
        //         bankAuthorizeDate: party.AuthorizationDate || moment().format("YYYY-MM-DD"),
        //         bank: party.BankName || null,
        //         branchName: party.BranchName || null,
        //         branchCode: party.BranchCode || null,
        //         accountNo: party.AccountNo || null,
        //         iban: party.IBAN || null,
        //         swiftCode: party.SwiftCode || null,
        //         routingNo: party.RoutingNo || null,
        //         ifscCode: party.IFCSCode || null,
        //         micrCode: party.MICRCode || null,
        //         currency: party.CurrencyId || "PKR",
        //         createdBy: party.AddLog || "System",
        //         active: true,
        //         nongl: '1',
        //     });

        // }
      i++
    }

    return res.json({ status: 'success', result: 'Parties created successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', result: error.message });
  }
});

module.exports = routes;