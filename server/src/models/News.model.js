const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const newsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    photo: {
        type: String,
        default: null
    }
});
const News =  mongoose.model("News", newsSchema, "news");
module.exports = News;