import express from 'express';
import { searchLocation, reverseGeocode, getDirections } from '../controllers/locationController.js';

const router = express.Router();

router.get('/', getDirections);
router.get('/directions', getDirections);
router.get('/search', searchLocation);
router.get('/reverse', reverseGeocode);

export default router;
