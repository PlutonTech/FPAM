/**
 * FPAM Asset Schema — matches fpam_scraper.py output exactly
 * Drop this into your AssetSpatial backend models folder
 * 
 * Usage:
 *   const Asset = require('./models/Asset');
 *   const assets = require('./output/assets.json');
 *   await Asset.insertMany(assets, { ordered: false });
 */

const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
  _id: { type: String },           // "asset_<md5[:10]>" — deterministic

  sn:      { type: Number },        // original serial number from Excel
  mda:     { type: String, index: true, required: true },
  purpose: { type: String, default: 'Office Building' },
  state:   { type: String, index: true },
  lga:     { type: String },
  address: { type: String },
  landmark:{ type: String },
  year_commissioned: { type: String },
  valuation:         { type: String },

  coordinates: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },

  // GeoJSON point — auto-populated from coordinates if both present
  location: {
    type: {
      type:        String,
      enum:        ['Point'],
      default:     'Point',
    },
    coordinates: {          // [lng, lat] — GeoJSON order
      type:    [Number],
      default: [0, 0],
    },
  },

  image: {
    filename:   { type: String, default: null }, // stored in /images/<filename>
    source_url: { type: String, default: null },
    width:      { type: Number, default: null },
    height:     { type: Number, default: null },
    scraped_at: { type: Date,   default: null },
  },

  metadata: {
    scraped_at:  { type: Date,    default: Date.now },
    geocoded:    { type: Boolean, default: false },
    image_found: { type: Boolean, default: false },
  },

}, {
  _id:        false,    // we supply our own _id
  timestamps: true,
  collection: 'assets',
});

// 2dsphere index for geo queries ($near, $geoWithin etc.)
AssetSchema.index({ location: '2dsphere' });
AssetSchema.index({ mda: 'text', address: 'text', landmark: 'text' });

// Auto-populate GeoJSON location from coordinates before save
AssetSchema.pre('save', function (next) {
  const { lat, lng } = this.coordinates || {};
  if (lat != null && lng != null) {
    this.location = { type: 'Point', coordinates: [lng, lat] };
  }
  next();
});

// Example geo query helper
AssetSchema.statics.findNear = function (lng, lat, maxMetres = 5000) {
  return this.find({
    location: {
      $near: {
        $geometry:    { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxMetres,
      },
    },
  });
};

module.exports = mongoose.model('Asset', AssetSchema);


/* ────────────────────────────────────────────────────────────────
   BULK IMPORT SNIPPET — run once to seed your database

   const Asset  = require('./models/Asset');
   const assets = require('./output/assets.json');

   async function seed() {
     await mongoose.connect(process.env.MONGODB_URI);
     const result = await Asset.insertMany(assets, { ordered: false });
     console.log(`Inserted ${result.length} assets`);
     process.exit(0);
   }
   seed().catch(console.error);
──────────────────────────────────────────────────────────────── */
