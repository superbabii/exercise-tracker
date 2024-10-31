require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

// Exercise Model
const exerciseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Home route
app.get('/', (req, res) => {
  res.send('Welcome to the Exercise Tracker API');
});

// Create a new user
app.post(
  '/api/users',
  body('username').notEmpty().withMessage('Username is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const newUser = new User({ username: req.body.username });
      const savedUser = await newUser.save();
      res.json({ username: savedUser.username, _id: savedUser._id }); // This should match the required structure
    } catch (err) {
      console.error("Error saving user:", err);
      res.status(500).json({ error: 'Server error saving user' });
    }
  }
);


// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, { __v: 0 });
    res.json(users.map(user => ({ username: user.username, _id: user._id })));
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: 'Server error fetching users' });
  }
});

// Add an exercise to a user
app.post(
  '/api/users/:_id/exercises',
  [
    body('description').notEmpty().withMessage('Description is required'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('date').optional().isISO8601().toDate().withMessage('Date must be in valid format'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { description, duration, date } = req.body;
      const userId = req.params._id;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const exercise = new Exercise({
        userId,
        description,
        duration: parseInt(duration),
        date: date || new Date(),
      });

      const savedExercise = await exercise.save();
      res.json({
        username: user.username,
        description: savedExercise.description,
        duration: savedExercise.duration,
        date: savedExercise.date.toDateString(),
        _id: userId,
      });
    } catch (err) {
      console.error("Error adding exercise:", err);
      res.status(500).json({ error: 'Server error adding exercise' });
    }
  }
);


// Get a user's exercise log
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    const userId = req.params._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let filter = { userId };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    let exercises = Exercise.find(filter).select('-userId -__v');
    if (limit) exercises = exercises.limit(parseInt(limit));

    const exerciseLog = await exercises.exec();
    res.json({
      username: user.username,
      count: exerciseLog.length,
      _id: userId,
      log: exerciseLog.map(ex => ({
        description: ex.description,
        duration: ex.duration,
        date: ex.date.toDateString(),
      })),
    });
  } catch (err) {
    console.error("Error retrieving exercise log:", err);
    res.status(500).json({ error: 'Server error retrieving exercise log' });
  }
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
