const mongoose = require("mongoose");
const Order = require("../models/Order");

// exports.getDashboardStats = async (req, res) => {
//   try {
//     // 1. Debugging: Check karo ki req.user.restaurantId aa raha hai ya nahi
//     console.log("Restaurant ID from req:", req.user.restaurantId);

//     // Mongoose ObjectId convert karein
//     const rId = new mongoose.Types.ObjectId(req.user.restaurantId);

//     // 2. Aggregate Pipeline
//     const stats = await Order.aggregate([
//       { $match: { restaurantId: rId } }, // Yahan match ho raha hai
//       { $group: {
//           _id: null,
//           today: {
//             $sum: {
//               $cond: [
//                 { $eq: [{ $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, new Date().toISOString().split("T")[0]] },
//                 "$total",
//                 0
//               ]
//             }
//           },
//           totalRevenue: { $sum: "$total" },
//           totalOrders: { $sum: 1 }
//       }}
//     ]);

//     // 3. Table Stats
//     const tableStats = await Order.aggregate([
//       { $match: { restaurantId: rId } },
//       { $group: { _id: "$tableNumber", orderCount: { $sum: 1 } } }
//     ]);

//     // 4. Debug: Check karo ki total stats kya mile
//     console.log("Aggregation Result:", stats);

//     res.status(200).json({
//       success: true,
//       data: {
//         revenueStats: stats[0] || { today: 0, totalRevenue: 0, totalOrders: 0 },
//         tableStats,
//         topItems: [], // Test ke liye khali rakha hai, pehle revenue fix karein
//         weeklyTrend: []
//       }
//     });
//   } catch (err) {
//     console.error("Aggregation Error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

exports.getDashboardStats = async (req, res) => {
  try {
    const rId = new mongoose.Types.ObjectId(req.user.restaurantId);

    // 1. Stats (Revenue & Total Orders)
    const stats = await Order.aggregate([
      { $match: { restaurantId: rId } },
      {
        $group: {
          _id: null,
          today: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    {
                      $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    },
                    new Date().toISOString().split("T")[0],
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
    ]);

    // 2. Top Selling Items
    const topItems = await Order.aggregate([
      { $match: { restaurantId: rId } },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", count: { $sum: "$items.quantity" } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // 3. Weekly Trend (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyTrend = await Order.aggregate([
      { $match: { restaurantId: rId, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sales: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 4. Table Stats
    const tableStats = await Order.aggregate([
      { $match: { restaurantId: rId } },
      { $group: { _id: "$tableNumber", orderCount: { $sum: 1 } } },
    ]);

    // 5. NEW: Hourly Stats (India Timezone: +5.5 hours = 19800000ms)
    const hourlyStats = await Order.aggregate([
      { $match: { restaurantId: rId } },
      {
        $project: {
          // Timezone adjustment for IST
          hour: { $hour: { $add: ["$createdAt", 19800000] } },
        },
      },
      {
        $group: {
          _id: "$hour",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        revenueStats: stats[0] || { today: 0, totalRevenue: 0, totalOrders: 0 },
        tableStats,
        topItems,
        weeklyTrend: weeklyTrend.map((item) => ({
          day: item._id,
          sales: item.sales,
        })),
        hourlyStats,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
