const multer = require("multer");
const sharp = require("sharp");
const Tour = require("../models/tour-models");
const catchAsync = require("../util/catchAsync");
const handlerFactory = require("./handlerFactory");
const AppError = require("../util/appError");

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("The file you uploaded is not image", 404), false);
  }
};
const upload = multer({ storage: multerStorage, filter: multerFilter });

const uploadTourImages = upload.fields([
  { name: "imageCover", maxCount: 1 },
  { name: "images", maxCount: 3 },
]);

const resizeTourImages = catchAsync(async (req, res, next) => {
  // if (!req.files.imageCover || !req.files.images) {
  //   return next();
  // }

  //Cover Image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat("JPEG")
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  req.body.images = [];

  // 2) Images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat("jpeg")
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );

  next();
});

async function topTours(req, res, next) {
  req.query.limit = "3";
  req.query.sort = "-ratingAverage,price";
  next();
}
// EXECUTE QUERY //

const getAllTours = handlerFactory.getAll(Tour);

const CreateNewTour = handlerFactory.createOne(Tour);

const updateTour = handlerFactory.updateOne(Tour);

const deleteTour = handlerFactory.deleteOne(Tour);

const getTour = handlerFactory.getOne(Tour, { path: "reviews" });

const getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 3 } },
    },
    {
      $group: {
        _id: "$difficulty",
        number: { $sum: 1 },
        avgRating: { $avg: "$ratingsAverage" },
        avgPrice: { $avg: "$price" },
        minPrice: { $min: "$price" },
        maxPrice: { $max: "$price" },
      },
    },
  ]);

  res.status(200).json({
    status: "succes",
    data: {
      stats,
    },
  });
});

const getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    {
      $unwind: "$startDates",
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: "$startDates" },
        numberOfToursStarts: { $sum: 1 },
        tours: { $push: "$name" },
      },
    },
    {
      $addFields: { month: "$_id" },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { month: 1 },
    },
  ]);
  res.status(200).json({
    status: "succes",
    data: {
      plan,
    },
  });
});

const getToursWithIn = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(",");
  if (!lat || !lng) {
    next(new AppError("please latitude and longitude", 400));
  }
  const radius = unit === "mi" ? distance / 3963.2 : distance / 6378.1;

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });
  res
    .status(200)
    .json({ status: "OK", results: tours.length, data: { data: tours } });
});

const getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(",");
  const multiplier = unit === "mi" ? 0.000621371192 : 0.0001;
  if (!lat || !lng) {
    next(new AppError("please latitude and longitude", 400));
  }

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng * 1, lat * 1] },
        distanceField: "distance",
        distanceMultiplier: multiplier,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);
  res.status(200).json({
    status: "succes",
    data: {
      data: distances,
    },
  });
});

module.exports = {
  createNewTour: CreateNewTour,
  getAllTours: getAllTours,
  getTour: getTour,
  updateTour: updateTour,
  deleteTour: deleteTour,
  topTours: topTours,
  getTourStats: getTourStats,
  getMonthlyPlan: getMonthlyPlan,
  getToursWithIn: getToursWithIn,
  getDistances: getDistances,
  uploadTourImages: uploadTourImages,
  resizeTourImages: resizeTourImages,
};
