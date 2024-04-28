const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  name: String,
  description: String,
  price: Number,
  completed_jobs: String,
  start_date: Date,
  end_date: Date,
  isArchived: String,
  team: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      userName: String,
    },
  ],
});

module.exports = mongoose.model("Project", projectSchema, "projects");
