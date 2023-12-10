// Load the district shapefile.
var districts = ee.FeatureCollection('users/m6sharma/district61');

// Load KVK points from CSV.
var kvkPointsCSV = ee.FeatureCollection('users/m6sharma/KVK_Locations_Master');
var kvkPoints = kvkPointsCSV.map(function(feature){
    var lon = feature.getNumber('longitude');
    var lat = feature.getNumber('latitude');
    var point = ee.Geometry.Point([lon, lat]);
    return ee.Feature(point);
});

// Load your 1991 shapefile data.
var data1991 = ee.FeatureCollection('users/m6sharma/rekvklocation').filterBounds(districts);

// 2. Calculate the area overlap of each feature with the district.
// If data1991 is in a grid format, compute overlap. Otherwise, it's the district's area.
var overlapAreas = data1991.map(function(feature) {
    return feature.set('overlap_area', feature.geometry().area());
});

// 3. Calculate the total area of each pixel/feature.
var totalAreas = overlapAreas.map(function(feature) {
    var geom = feature.geometry().simplify(1000);  // Simplify the geometry
    return ee.Feature(geom, {
        'overlap_area': feature.get('overlap_area'),
        'total_area': geom.area()
    });
});

// Displaying the results on the map
Map.centerObject(districts, 6);
Map.addLayer(totalAreas, {}, 'Total Area 1991');