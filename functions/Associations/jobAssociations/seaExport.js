const { Loading_Program, Item_Details, Dimensions, Delivery_Order, Manifest, Manifest_Jobs, SE_Job, SE_Equipments, Commodity, Bl, Container_Info, Vessel, Job_notes, Stamps } = require("../../../models");
const { Employees } = require("../employeeAssociations");
const { Vendors   } = require("../vendorAssociations");
const { Voyage    } = require("../vesselAssociations");
const { Clients   } = require("../clientAssociation");
const { DataTypes } = require('sequelize');

SE_Job.hasMany(SE_Equipments, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
SE_Equipments.belongsTo(SE_Job);

Clients.hasMany(SE_Job, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
SE_Job.belongsTo(Clients);

Bl.hasMany(Container_Info, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Container_Info.belongsTo(Bl);

Bl.hasMany(Item_Details, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Item_Details.belongsTo(Bl);

SE_Job.hasOne(Bl, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Bl.belongsTo(SE_Job);

SE_Job.hasOne(Loading_Program, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Loading_Program.belongsTo(SE_Job);

Voyage.hasOne(SE_Job, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
SE_Job.belongsTo(Voyage);


// -------------------- zahida's code --------------------
Bl.hasMany(Stamps, {
    foriegnKey :{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Stamps.belongsTo(Bl);

SE_Job.hasMany(Job_notes, {
    foriegnKey :{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Job_notes.belongsTo(SE_Job);

SE_Job.hasOne(Delivery_Order, {
    foriegnKey :{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Delivery_Order.belongsTo(SE_Job);

Bl.hasMany(Dimensions, {
    foriegnKey :{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Dimensions.belongsTo(Bl);

Manifest.hasMany(Manifest_Jobs, {
    foriegnKey :{
        type: DataTypes.UUID,
        allowNull:false
    }
})
Manifest_Jobs.belongsTo(Manifest);

SE_Job.hasOne(Manifest_Jobs, {
    foriegnKey :{
        type: DataTypes.UUID,
        allowNull:false
    }
})
Manifest_Jobs.belongsTo(SE_Job);

SE_Job.belongsTo(Employees, {as:'sales_representator'});
Bl.belongsTo(Clients,       {as:'notifyPartyOne'     });
Bl.belongsTo(Clients,       {as:'notifyPartyTwo'     });
SE_Job.belongsTo(Vendors,   {as:'overseas_agent'     });
SE_Job.belongsTo(Vendors,   {as:'shipping_line'      });
//SE_Job.belongsTo(Vendors, { as: 'vendor_shipping_line' });
//SE_Job.belongsTo(Clients, { as: 'client_shipping_line' });
SE_Job.belongsTo(Vendors,   {as:'local_vendor'       });
SE_Job.belongsTo(Vendors,   {as:'custom_agent'       });
SE_Job.belongsTo(Vendors,   {as:'transporter'        });
SE_Job.belongsTo(Employees, {as:'created_by'         });
SE_Job.belongsTo(Commodity, {as:'commodity'          });
SE_Job.belongsTo(Clients,   {as:'consignee'          });
SE_Job.belongsTo(Vendors,   {as:'forwarder'          });
SE_Job.belongsTo(Vendors,   {as:'air_line'           });
SE_Job.belongsTo(Clients,   {as:'shipper'            });
SE_Job.belongsTo(Vessel,    {as:'vessel'             });

module.exports = { 
    Loading_Program, Job_notes, Delivery_Order, Item_Details, SE_Equipments, SE_Job, Bl,
    Container_Info, Stamps, Dimensions, Manifest, Manifest_Jobs, Commodity
}