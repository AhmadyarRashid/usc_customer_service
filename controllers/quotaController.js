const db = require("../helpers/db");
const { getResponseObject } = require("../helpers/response");
const constants = require("../config/constants");
const winston = require("../config/winston");

module.exports.get_user_quota = async function (req, res) {
    const { cnic } = req.params;
    try {
        const userFamilyId = await db.executeQuery(`select family_id from users where cnic = ?`, [cnic]);
        if (userFamilyId.length > 0) {  // if user exists
            const { family_id } = userFamilyId[0];
            if (family_id) {
                const date = new Date();
                const month = date.getMonth() + 1;
                const year = date.getFullYear();
                const availableQuota = await db.executeQuery(`select product_id as id, available_quota as quota from user_quota where month = ? and year = ?`, [month, year]);
                if (availableQuota.length < 1) { // if new month quota is not initialized
                    for (let i = 0; i < constants.subsidyProducts.length; i++) {
                        const { id, quota } = constants.subsidyProducts[i];
                        await db.executeQuery(
                            `insert into user_quota (family_id, product_id, available_quota, month, year) values (?,?,?,?,?)`
                            , [family_id, id, quota, month, year]
                        );
                    }
                    const userQuota = await db.executeQuery(
                        `select product_id as id, available_quota as quota from user_quota where month = ? and year = ?`,
                        [month, year]
                    );
                    res.status(200).send(getResponseObject('Fetched successfully', 200, 1, userQuota));
                } else {
                    res.status(200).send(getResponseObject('Fetched successfully', 200, 1, availableQuota));
                }
            } else {
                res.status(400).send(getResponseObject('Family Id not found', 400, 0));
            }
        } else {
            res.status(400).send(getResponseObject('CNIC not found', 400, 0));
        }
    } catch (error) {
        console.log(error);
        res.send(getResponseObject(error.message, 500, 0));
    }
};

module.exports.update_user_quota = async (req, res) => {
    const { cnic } = req.params;
    const issuedItem = req.body;

    if (cnic && cnic.length !== 13) {
        res.status(400).send(getResponseObject('Wrong Cnic format', 400, 0));
    } else {
        try {
            const userFamilyId = await db.executeQuery(`select family_id from users where cnic = ?`, [cnic]);
            if (userFamilyId.length > 0) {  // if user exists
                const { family_id } = userFamilyId[0];
                if (family_id) {
                    for (let i = 0; i < issuedItem.length; i++) {
                        const { id, qty } = issuedItem[i];
                        await db.executeQuery(
                            `update user_quota set available_quota = available_quota - ? where family_id = ? and product_id = ?`,
                            [qty, family_id, id]
                        );
                    }
                    res.status(200).send(getResponseObject('Update successfully', 200, 1));
                } else {
                    res.status(400).send(getResponseObject('Family Id not found', 400, 0));
                }
            } else {
                res.status(400).send(getResponseObject('CNIC not found', 400, 0));
            }
        } catch (error) {
            console.log(error);
            res.send(getResponseObject(error.message, 500, 0));
        }
    }
};

module.exports.upate_family_id = async (req, res) => {
    const { familyId } = req.body;
    const { cnic } = req.params;

    try {
        const userDetail = await db.executeQuery(`select family_id from users where cnic = ?`, [cnic]);
        if (userDetail.length < 1) {
            res.send(getResponseObject('User not register yet. Please send your cnic number to 5566.', 400, 0));
        } else {
            await db.executeQuery(`update users set family_id = ? where cnic = ?`, [familyId, cnic]);
            res.status(200).send(getResponseObject('Update successfully', 200, 1));
        }
    } catch (error) {
        console.log(error);
        res.send(getResponseObject(error.message, 500, 0));
    }
};