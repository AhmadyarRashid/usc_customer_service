const db = require("../helpers/db");

function itemSequentialOrderNumber(category_id, material_type_id, sub_type_id) {
  return new Promise((resolve, reject) => {
    db.executeQuery(
      `Select item_order From item_master where category_id=? and material_type_id=? and sub_type_id=?
        order BY item_order DESC LIMIT 1`,
      category_id,
      material_type_id,
      sub_type_id
    )
      .then(rows => {
        return resolve(generateNewNumber(rows[0].item_order));
      })
      .catch(err => {
        console.log(err);
        return reject(null);
      });
  });
}

function generateNewNumber(lastNumber) {
  var newNumber = (parseInt(lastNumber) + 1).toString();
  if (newNumber.length === 1) {
    return "00" + newNumber;
  }
  if (newNumber.length === 2) {
    return "0" + newNumber;
  } else return newNumber;
}

function getSubTypeNumber(material_type_id) {
  return new Promise((resolve, reject) => {
    db.executeQuery(
      `Select sub_type_number From sub_types where material_type_id=? order BY sub_type_number DESC LIMIT 1`,
      material_type_id
    )
      .then(rows => {
        if (rows.length > 0) {
          var newNumber = (parseInt(rows[0].sub_type_number) + 1).toString();
          if (newNumber.length === 1) {
            newNumber = "0" + newNumber;
          }
          return resolve(newNumber);
        } else {
          return resolve("01");
        }
      })
      .catch(err => {
        console.log(err);
        return reject(null);
      });
  });
}

function getCategoryNumber() {
  return new Promise((resolve, reject) => {
    db.executeQuery(`Select category_id From categories order BY category_id DESC LIMIT 1`)
      .then(rows => {
        if (rows.length > 0) {
          var newNumber = (parseInt(rows[0].category_id) + 1).toString();
          if (newNumber.length === 1) {
            newNumber = "0" + newNumber;
          }
          return resolve(newNumber);
        } else {
          return resolve("01");
        }
      })
      .catch(err => {
        console.log(err);
        return reject(null);
      });
  });
}

function getMaterialTypeNumber(category_id) {
  return new Promise((resolve, reject) => {
    db.executeQuery(
      `Select material_type_number From material_types where category_id=? order BY material_type_number DESC LIMIT 1`,
      category_id
    )
      .then(rows => {
        if (rows.length > 0) {
          var newNumber = (parseInt(rows[0].material_type_number) + 1).toString();
          if (newNumber.length === 1) {
            newNumber = "0" + newNumber;
          }
          return resolve(newNumber);
        } else {
          return resolve("01");
        }
      })
      .catch(err => {
        console.log(err);
        return reject(null);
      });
  });
}

module.exports = { itemSequentialOrderNumber, getSubTypeNumber, getMaterialTypeNumber, getCategoryNumber };
