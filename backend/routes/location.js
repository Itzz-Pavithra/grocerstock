import express from 'express';
import { searchLocation, reverseGeocode, getDirections } from '../controllers/locationController.js';

const router = express.Router();

router.get('/search', searchLocation);
router.get('/reverse', reverseGeocode);
router.get('/directions', getDirections);

export default router;
