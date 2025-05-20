const mongoose = require('mongoose');
const validator = require("validator")
const Schema = mongoose.Schema;


const userSchema = new mongoose.Schema({

    username:{
        type: String,
        required: true
    },
    profile:{
        type: String,
        default:'uploads/profile.png'
    },
    email:{
        type: String,
        unique:true,
        required: true,
        validate:[validator.isEmail,'filed must be valid email adress']
    },
    password:{
        type: String,
        required: true
    },
    token:{
        type:String
    },
    mobile:{
        type: String,
        required: false
    },
    age:{
        type: Number,
        required: true
    },
    gender:{
        type: String,
        required: true
    },
    EducationLevel:{
        type: String,
        required: true
    },
    active: {
        type: Boolean,
        default: false,
    },
    role: {
        type: String, required: true, enum: ['superAdmin', 'admin', 'employee', 'user'] ,
        default:'user'
    },
    permissions: { type: [String], default: [] }, 

    isSuspended:{
        type:Boolean,
        default:false
    },
    suspendedUntil:{
        type:Date
    },
    studyField:{
        type:String
    },
    studyYear:{
        type:Number
    },
    isVolunteer: {
         type: Boolean,
         default: false
    }, 
});


let Users = mongoose.model('Users',userSchema,'users'); 
module.exports = Users ; 
