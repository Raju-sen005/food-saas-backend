const mongoose = require("mongoose");
const Order = require("../models/Order");

const IST_OFFSET_MS = 19800000; // +5:30

exports.getDashboardStats = async (req, res) => {
  try {
    const rId = new mongoose.Types.ObjectId(req.user.restaurantId);
    const matchFilter = { restaurantId: rId, status: "ACCEPTED" };

    // 🔑 IST ke hisaab se "today" ki date string — hourlyStats ke calculation se consistent
    const todayIST = new Date(Date.now() + IST_OFFSET_MS)
      .toISOString()
      .split("T")[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 🔑 $facet: saari 5 aggregations ek hi DB round-trip mein — pehle 5 separate
    // queries thi, ab sirf ek. Collection scan bhi ek hi baar hota h.
    const [result] = await Order.aggregate([
      { $match: matchFilter },
      {
        $facet: {
          revenueStats: [
            {
              $group: {
                _id: null,
                today: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          {
                            $dateToString: {
                              format: "%Y-%m-%d",
                              date: "$createdAt",
                              timezone: "+05:30", // native mongo timezone conversion
                            },
                          },
                          todayIST,
                        ],
                      },
                      "$total",
                      0,
                    ],
                  },
                },
                totalRevenue: { $sum: "$total" },
                totalOrders: { $sum: 1 },
              },
            },
          ],
          topItems: [
            { $unwind: "$items" },
            { $group: { _id: "$items.name", count: { $sum: "$items.quantity" } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
          weeklyTrend: [
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$createdAt",
                    timezone: "+05:30",
                  },
                },
                sales: { $sum: "$total" },
              },
            },
            { $sort: { _id: 1 } },
          ],
          tableStats: [
            { $group: { _id: "$tableNumber", orderCount: { $sum: 1 } } },
          ],
          hourlyStats: [
            {
              $project: {
                hour: { $hour: { date: "$createdAt", timezone: "+05:30" } },
              },
            },
            { $group: { _id: "$hour", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        revenueStats: result.revenueStats[0] || {
          today: 0,
          totalRevenue: 0,
          totalOrders: 0,
        },
        tableStats: result.tableStats,
        topItems: result.topItems,
        weeklyTrend: result.weeklyTrend.map((item) => ({
          day: item._id,
          sales: item.sales,
        })),
        hourlyStats: result.hourlyStats,
      },
    });
  } catch (err) {
    console.error("Dashboard stats aggregation error:", err);
    res.status(500).json({ success: false, message: "Failed to compute dashboard analytics." });
  }
};
