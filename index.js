const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Dbconnect = require("./Dbconnect/dbConnect");
const transactionRoutes = require('./Routes/Routes');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
Dbconnect();

app.use('/api', transactionRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
