const db = require("../helpers/db");
const { getResponseObject } = require("../helpers/response");
const constants = require("../config/constants");
const winston = require("../config/winston");
const { subsidyProducts, bispSubsidyProducts } = require("../config/constants");

module.exports.get_user_quota = async function (req, res) {
    const { cnic } = req.params;
    try {
        const userId = await db.executeQuery(`select id from users where cnic = ? and is_bisp_verified = 1`, [cnic]);
        if (userId.length > 0) {  // if user exists
            const { id: user_id } = userId[0];
            const date = new Date();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const availableQuota = await db.executeQuery(`
                select product_id as id, available_quota as quota from user_quota where month = ? and year = ? and user_id = ?`, 
                [month, year, user_id]);
            if (availableQuota.length < 1) { // if new month quota is not initialized
                for (let i = 0; i < bispSubsidyProducts.length; i++) {
                    const { id, quota } = bispSubsidyProducts[i];
                    await db.executeQuery(
                        `insert into user_quota (user_id, product_id, available_quota, month, year) values (?,?,?,?,?)`
                        , [user_id, id, quota, month, year]
                    );
                }
                const userQuota = await db.executeQuery(
                    `select product_id as id, available_quota as quota from user_quota where month = ? and year = ? and user_id = ?`,
                    [month, year, user_id]
                );
                res.status(200).send(getResponseObject('Fetched successfully', 200, 1, userQuota));
            } else {
                res.status(200).send(getResponseObject('Fetched successfully', 200, 1, availableQuota));
            }
        } else {
            res.status(400).send(getResponseObject('Please register your CNIC by send cnic number to 5566.', 400, 0));
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
            const userResponse = await db.executeQuery(`select id from users where cnic = ? and is_bisp_verified = 1`, [cnic]);
            const date = new Date();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            if (userResponse.length > 0) {  // if user exists
                const { id: user_id } = userResponse[0];
                if (user_id) {
                    const availableQuotaResponse = await db.executeQuery(`select * from user_quota where user_id = ? and month = ? and year = ?`, [user_id, month, year]);

                    let isValid = true;
                    let errorMessage = 'Your available qty of ';

                    for(let i = 0; i < availableQuotaResponse.length; i++) {
                        const product_id = availableQuotaResponse[i]['product_id'];
                        const quota = availableQuotaResponse[i]['available_quota']
                        const isExceedQty = issuedItem.some(item => {
                            if(item.id == product_id && item.qty > quota) {
                                return true;
                            }
                            return false;
                        });

                        if(isExceedQty) {
                            isValid = false;
                            errorMessage += `${subsidyProducts[product_id]['name']} is ${availableQuotaResponse[i]['available_quota']}, `
                        }
                    }

                    if(isValid) {
                        for (let i = 0; i < issuedItem.length; i++) {
                            const { id, qty } = issuedItem[i];
                            await db.executeQuery(
                                `update user_quota set available_quota = available_quota - ? where user_id = ? and product_id = ?`,
                                [qty, user_id, id]
                            );
                        }
                        res.status(200).send(getResponseObject('Update successfully', 200, 1));
                    } else {
                        res.status(400).send(getResponseObject('Quota Exceed limit', 400, 0, errorMessage));
                    }
                } else {
                    res.status(400).send(getResponseObject('User Id not found', 400, 0));
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

module.exports.get_user_general_quota = async function (req, res) {
    const { cnic } = req.params;
    if (cnic && cnic.length !== 13) {
        res.status(400).send(getResponseObject('wrong cnic format', 400, 0));
        return;
    }
    try {
        const userIdResponse = await db.executeQuery(`select id from users where cnic = ?;`, [cnic]);
        let userId = -1;
        if (userIdResponse.length > 0) {
            userId = userIdResponse[0]['id'];
        } else {
            const insertResponse = await db.executeQuery(`insert into users (cnic, mobile_no, otp, created_date, status, is_bisp_verified) values (?,?,?,?,?,?)`,
             [String(cnic), null, null, new Date(), false, false]);
            userId = insertResponse['insertId']; 
        }
        const date = new Date();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const availableQuota = await db.executeQuery(`
            select product_id as id, available_quota as quota from user_quota where month = ? and year = ? and user_id = ?`, 
            [month, year, userId]);
        if (availableQuota.length < 1) { // if new month quota is not initialized
            for (let i = 0; i < subsidyProducts.length; i++) {
                const { id, quota } = subsidyProducts[i];
                await db.executeQuery(
                    `insert into user_quota (user_id, product_id, available_quota, month, year) values (?,?,?,?,?)`
                    , [userId, id, quota, month, year]
                );
            }
            const userQuota = await db.executeQuery(
                `select product_id as id, available_quota as quota from user_quota where month = ? and year = ? and user_id = ?`,
                [month, year, userId]
            );
            res.status(200).send(getResponseObject('Fetched successfully', 200, 1, userQuota));
        } else {
            res.status(200).send(getResponseObject('Fetched successfully', 200, 1, availableQuota));
        }
    } catch (error) {
        console.log(error);
        res.send(getResponseObject(error.message, 500, 0));
    }
};

module.exports.update_user_general_quota = async (req, res) => {
    const { cnic } = req.params;
    const issuedItem = req.body;

    if (cnic && cnic.length !== 13) {
        res.status(400).send(getResponseObject('wrong cnic format', 400, 0));
    } else {
        try {
            const userResponse = await db.executeQuery(`select id from users where cnic = ?`, [cnic]);
            const date = new Date();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            if (userResponse.length > 0) {  // if user exists
                const { id: user_id } = userResponse[0];
                if (user_id) {
                    const availableQuotaResponse = await db.executeQuery(`select * from user_quota where user_id = ? and month = ? and year = ?`, [user_id, month, year]);

                    let isValid = true;
                    let errorMessage = 'Your available qty of ';

                    for(let i = 0; i < availableQuotaResponse.length; i++) {
                        const product_id = availableQuotaResponse[i]['product_id'];
                        const quota = availableQuotaResponse[i]['available_quota']
                        const isExceedQty = issuedItem.some(item => {
                            if(item.id == product_id && item.qty > quota) {
                                return true;
                            }
                            return false;
                        });

                        if(isExceedQty) {
                            isValid = false;
                            errorMessage += `${subsidyProducts[product_id]['name']} is ${availableQuotaResponse[i]['available_quota']}, `
                        }
                    }

                    if(isValid) {
                        for (let i = 0; i < issuedItem.length; i++) {
                            const { id, qty } = issuedItem[i];
                            await db.executeQuery(
                                `update user_quota set available_quota = available_quota - ? where user_id = ? and product_id = ?`,
                                [qty, user_id, id]
                            );
                        }
                        res.status(200).send(getResponseObject('Update successfully', 200, 1));
                    } else {
                        res.status(400).send(getResponseObject('Quota Exceed limit', 400, 0, errorMessage));
                    }
                } else {
                    res.status(400).send(getResponseObject('User Id not found', 400, 0));
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