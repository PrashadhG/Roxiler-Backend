const mongoose = require("mongoose");

function DBConnect(){
    mongoose.connect(process.env.DbConnect)
    .then((conn) => {
        console.log("Connected to DB");
    }).catch((error) => {
        console.error(error);
    })
}

module.exports = DBConnect;