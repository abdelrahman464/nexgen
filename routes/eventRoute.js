const express = require('express');
const {
  getEventValidator,
  createEventValidator,
  updateEventValidator,
} = require('../utils/validators/eventValidator');
const {
  getEvent,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadImage,
  resizeImage,
} = require('../services/eventService');

const authServices = require('../services/authServices');

const router = express.Router();

router
  .route('/')
  .get(getEvents)
  .post(
    authServices.protect,
    authServices.allowedTo('admin'),
    uploadImage,
    resizeImage,
    createEventValidator,
    createEvent,
  );
router
  .route('/:id')
  .get(getEventValidator, getEvent)
  .put(
    authServices.protect,
    authServices.allowedTo('admin'),
    updateEventValidator,
    updateEvent,
  )
  .delete(
    authServices.protect,
    authServices.allowedTo('admin'),
    getEventValidator,
    deleteEvent,
  );

module.exports = router;
