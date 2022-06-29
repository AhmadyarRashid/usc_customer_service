const db = require("../helpers/db");

const codeGenerator = async (code, table) => {
    return new Promise(async (resolve) => {
        setTimeout(async () => {
            let PO_code = code + ((new Date()).getFullYear()-2000) + "";
            let month = (new Date()).getMonth() + 1;

            if (month < 10) {
                PO_code += "0" + month
            } else {
                PO_code += month
            }

            let doc = await db.executeQuery(`SELECT MAX(id) as id FROM ${table}`);
            if (doc) {
                console.log("PREVIOUS ID=====>", doc[0].id)
                let id = doc[0].id + 1;
                if (id < 10) {
                    PO_code += "00" + id;
                } else if (id < 100) {
                    PO_code += "0" + id;
                } else {
                    PO_code += id;
                }

                resolve(PO_code);
            } else {
                resolve(PO_code += "001");
            }
        }, 0);
    });
}

const MidCodeGenerator = async (code, table) => {
    return new Promise(async (resolve) => {
        setTimeout(async () => {
            let PO_code = code + (new Date()).getFullYear() + "";
            let month = (new Date()).getMonth() + 1;

            if (month < 10) {
                PO_code += "0" + month
            } else {
                PO_code += month
            }

            const query = `SELECT 
            MAX(mid_no_gs) as pre_gs,
            MAX(mid_no_gns) as pre_gns,
            SUBSTRING(MAX(mid_no_gs),8,2) as month_gs,
            SUBSTRING(MAX(mid_no_gns),8,2) as month_gns , 
            SUBSTRING(MAX(mid_no_gs),10) as gs,
            SUBSTRING(MAX(mid_no_gns),10) as gns 
            FROM ${table}`;

            let doc = await db.executeQuery(query);
            if (doc) {
                let { pre_gs, pre_gns, month_gs, month_gns } = doc[0];

                let up_month;
                if (Number(month_gs) > Number(month_gns)) {
                    up_month = Number(month_gs);
                } else {
                    up_month = Number(month_gns);
                }

                if (Number(up_month) != Number(month)) {
                    PO_code += "001";
                    resolve(PO_code);
                } else {
                    integrateId(PO_code, resolve, pre_gs, pre_gns);
                }
            }
        }, 0);
    });
}

const integrateId = (PO_code, resolve, pre_gs, pre_gns) => {
    let id = 0;
    console.log(pre_gns);
    try {
        if (Number(pre_gs.substring(4)) > Number(pre_gns.substring(4))) {
            id = Number(pre_gs.substring(9)) + 1;
        } else {
            id = Number(pre_gns.substring(9)) + 1;
        }
    }catch(e){
        if(pre_gs == null && pre_gns == null){
            id = 1;
        }else if(pre_gs == null && pre_gns != null){
            id = Number(pre_gns.substring(9)) + 1;
        }else if(pre_gs != null && pre_gns == null){
            id = Number(pre_gs.substring(9)) + 1;
        }else{
            
        }
    }
    
    if (id < 10) {
        PO_code += "00" + id;
    } else if (id < 100) {
        PO_code += "0" + id;
    } else {
        PO_code += id;
    }

    console.log('in func', PO_code);
    resolve(PO_code);
}

const QcCodeGenerator = async (code) => {
    return new Promise(async (resolve) => {
        setTimeout(async () => {
            let PO_code = code + (new Date()).getFullYear() + "";
            let month = (new Date()).getMonth();

            if (month < 10) {
                PO_code += "0" + month
            } else {
                PO_code += month
            }

            let doc = await db.executeQuery(`SELECT SUBSTRING(MAX(qc_no),10) as gs FROM material_entry_details`);
            if (doc) {
                let { gs } = doc[0];
                let id = 0;
                id = Number(gs) + 1;

                if (id < 10) {
                    PO_code += "00" + id;
                } else if (id < 100) {
                    PO_code += "0" + id;
                } else {
                    PO_code += id;
                }

                resolve(PO_code);
            }
        }, 0);
    });
}


module.exports = { codeGenerator, MidCodeGenerator, QcCodeGenerator }
