const axios = require('axios');
const Transaction = require('../Schema/Transaction');

//Initialization
exports.initializeDatabase = async (req, res) => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json', {
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
        });
        const transactions = response.data;
        await Transaction.deleteMany({});
        await Transaction.insertMany(transactions);
        res.send({ message: 'Database initialized with seed data' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send({ error: error.message });
    }
};


//Pagenation and Search
exports.getTransactions = async (req, res) => {
    const pageSize = 10;
    const pageNumber = parseInt(req.query.page) || 1;
    const searchQuery = req.query.search || '';
    const monthQuery = req.query.month || null;  
    const startIndex = (pageNumber - 1) * pageSize;

    let searchCriteria = {
        $or: [
            { title: new RegExp(searchQuery, 'i') },
            { description: new RegExp(searchQuery, 'i') }
        ]
    };

    if (!isNaN(parseFloat(searchQuery))) {
        searchCriteria.$or.push({ price: parseFloat(searchQuery) });
    }

    if (monthQuery) {
        searchCriteria.$and = [
            {
                $expr: {
                    $eq: [{ $month: "$dateOfSale" }, parseInt(monthQuery)]
                }
            }
        ];
    }

    try {
        const totalItems = await Transaction.countDocuments(searchCriteria);
        const result = {};

        if ((pageNumber * pageSize) < totalItems) {
            result.next = {
                pageNumber: pageNumber + 1,
                pageSize: pageSize
            };
        }
        if (startIndex > 0) {
            result.previous = {
                pageNumber: pageNumber - 1,
                pageSize: pageSize
            };
        }

        result.result = await Transaction.find(searchCriteria).skip(startIndex).limit(pageSize);
        result.totalItems = totalItems;
        result.currentPage = pageNumber;
        result.totalPages = Math.ceil(totalItems / pageSize);

        res.json(result);
    } catch (error) {
        console.error('Error fetching transactions:', error.message);
        res.status(500).json({ error: error.message });
    }
};





//Statistics
exports.getStatistics = async (req, res) => {
    const monthParam = req.params.month;

    if (!monthParam) {
        return res.status(400).json({ error: 'Month is required' });
    }

    const month = parseInt(monthParam, 10);
    if (isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: 'Invalid month. Month should be between 01 and 12' });
    }

    try {
        const totalAmountResult = await Transaction.aggregate([
            { 
                $match: { 
                    sold: true,
                    $expr: { $eq: [{ $month: "$dateOfSale" }, month] }
                } 
            },
            { 
                $group: { 
                    _id: null, 
                    totalAmount: { $sum: "$price" } 
                } 
            }
        ]);

        const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

        const soldItems = await Transaction.countDocuments({
            sold: true,
            $expr: { $eq: [{ $month: "$dateOfSale" }, month] }
        });

        const notSoldItems = await Transaction.countDocuments({
            sold: false,
            $expr: { $eq: [{ $month: "$dateOfSale" }, month] }
        });

        res.json({
            totalAmount,
            soldItems,
            notSoldItems
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }

};


//BarChart
const getBarChartData = async (month) => {
    const parsedMonth = parseInt(month);

    const priceRanges = await Transaction.aggregate([
        {
            $match: {
                $expr: { $eq: [{ $month: "$dateOfSale" }, parsedMonth] }
            }
        },
        {
            $bucket: {
                groupBy: "$price",
                boundaries: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, Infinity],
                default: "901-above",
                output: {
                    count: { $sum: 1 }
                }
            }
        },
        {
            $project: {
                _id: 0,
                range: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$_id", 0] }, then: "0-100" },
                            { case: { $eq: ["$_id", 100] }, then: "101-200" },
                            { case: { $eq: ["$_id", 200] }, then: "201-300" },
                            { case: { $eq: ["$_id", 300] }, then: "301-400" },
                            { case: { $eq: ["$_id", 400] }, then: "401-500" },
                            { case: { $eq: ["$_id", 500] }, then: "501-600" },
                            { case: { $eq: ["$_id", 600] }, then: "601-700" },
                            { case: { $eq: ["$_id", 700] }, then: "701-800" },
                            { case: { $eq: ["$_id", 800] }, then: "801-900" },
                            { case: { $eq: ["$_id", 900] }, then: "901-above" }
                        ],
                        default: "901-above"
                    }
                },
                count: 1
            }
        }
    ]);

    const rangeMap = priceRanges.reduce((acc, { range, count }) => {
        acc[range] = count;
        return acc;
    }, {});

    const allRanges = [
        "0-100",
        "101-200",
        "201-300",
        "301-400",
        "401-500",
        "501-600",
        "601-700",
        "701-800",
        "801-900",
        "901-above"
    ];

    const completePriceRanges = allRanges.map(range => ({
        range,
        count: rangeMap[range] || 0
    }));

    return completePriceRanges;
};


// Pie Chart Data function
const getPieChartData = async (month) => {
    const parsedMonth = parseInt(month);

    const categoryData = await Transaction.aggregate([
        {
            $match: {
                $expr: { $eq: [{ $month: "$dateOfSale" }, parsedMonth] }
            }
        },
        {
            $group: {
                _id: "$category",
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                category: "$_id",
                count: 1
            }
        }
    ]);

    return categoryData;
};

// Combined Data for Bar and Pie Chart
exports.getCombinedData = async (req, res) => {
    const monthParam = req.params.month;

    if (!monthParam) {
        return res.status(400).json({ error: 'Month is required' });
    }

    const month = parseInt(monthParam);
    if (isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: 'Invalid month' });
    }

    try {
        const barChartData = await getBarChartData(monthParam);
        const pieChartData = await getPieChartData(monthParam);

        const combinedResponse = {
            barChartData,
            pieChartData
        };

        res.json(combinedResponse);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

