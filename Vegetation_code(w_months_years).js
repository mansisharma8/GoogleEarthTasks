// Add Start Date
var d1 = ee.Date('1981-07-01');
var m1 = d1.get('month');
var table = ee.FeatureCollection("users/m6sharma/district61"),
    boundaries_11 = ee.FeatureCollection("users/m6sharma/corrected_wgs_61");

// Add Mapping Scheme
var ndviVis = {
  min: -1000.0,
  max: 5000.0,
  palette: [
    'ffffff', 'ce7e45', 'fcd163', 'c6ca02', '22cc04', '99b718', '207401',
    '012e01'
  ],
};

// Start and End Date
var Date_Start = ee.Date('1981-07-01');
var Date_End = ee.Date('1990-12-31');
var Date_window = ee.Number(30);

// Create list of dates for time series
var n_months = Date_End.difference(Date_Start, 'month').round();
var dates = ee.List.sequence(0, n_months, 1);
var make_datelist = function(n) {
  return Date_Start.advance(n, 'month');
};
dates = dates.map(make_datelist);

print(dates, 'list of dates');

// Initialize an empty list to store results
var resultList = [];

// Define batch size and number of batches
var batchSize = 5;
var numBatches = Math.ceil(dates.length().getInfo() / batchSize);

for (var i = 0; i < numBatches; i++) {
  var startIdx = i * batchSize;
  var endIdx = (i + 1) * batchSize;
  
  // Get a subset of dates for the current batch
  var batchDates = dates.slice(startIdx, endIdx);
  print('Processing batch ' + (i+1) + ' of ' + numBatches);
  // Process the batch of dates
  var batchImages = batchDates.map(function(d1) {
    var start = ee.Date(d1);
    var end = ee.Date(d1).advance(1, 'month');
    var date_range = ee.DateRange(start, end);
    
    // Extracting year and month
    var year = start.get('year');
    var month = start.get('month');

    var iterData = ee.ImageCollection('NOAA/CDR/AVHRR/NDVI/V5')
      .filterDate(date_range)
      .select('NDVI')
      .filterBounds(table)
      .map(function(image){return image.clip(table)});
    var reducedData = iterData.reduce(ee.Reducer.max());

    var stats = iterData.reduce(ee.Reducer.mean().combine(ee.Reducer.median(), '', true)
                                                 .combine(ee.Reducer.variance(), '', true));
    var firstDayValue = iterData.first().reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: table,
      scale: 500,
      crs: 'EPSG:32644',
      maxPixels: 1e13,
      bestEffort: true
    });
    
    var lastDayValue = iterData.sort('system:time_start', false).first().reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: table,
      scale: 500,
      crs: 'EPSG:32644',
      maxPixels: 1e13,
      bestEffort: true
    });

    var firstNDVI = ee.Number(firstDayValue.get('NDVI'));
    var lastNDVI = ee.Number(lastDayValue.get('NDVI'));
    firstNDVI = ee.Algorithms.If(ee.Algorithms.IsEqual(firstNDVI, null), 0, firstNDVI);
    lastNDVI = ee.Algorithms.If(ee.Algorithms.IsEqual(lastNDVI, null), 0, lastNDVI);
    var range = ee.Number(lastNDVI).subtract(ee.Number(firstNDVI));

    return reducedData.set('mean', stats.get('mean_NDVI'))
                      .set('median', stats.get('median_NDVI'))
                      .set('variance', stats.get('variance_NDVI'))
                      .set('range', range)
                      .set('year', year)  // Added year column
                      .set('month', month) // Added month column
                      .set('monthly_variance', stats.get('variance_NDVI')); // Added variance within each month
  });

  var batchImageCollection = ee.ImageCollection.fromImages(batchImages);

  var reprojectedCollection = batchImageCollection.map(function(image) {
    return image.reproject('EPSG:4326', null, 500);
  });

  var reducer = function(image){
    var results = image.reduceRegions({
      collection: boundaries_11,
      reducer: ee.Reducer.mean(),
      scale: 500,
      crs: 'EPSG:32644'
    });
    return(results);
  };

  var final = reprojectedCollection.map(reducer);
  var final = final.flatten();
  resultList.push(final);
}

var finalTable = ee.FeatureCollection(resultList).flatten();

var em = Export.table.toDrive({
  collection: finalTable,
  description: '81_91_summary_single_csv',
  folder: 'm6sharma/vegetation_research/NOAA',
  fileFormat: 'CSV',
});

print('Exporting 81_91_summary_single_csv');
