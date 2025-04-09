const appError = require('../utils/handelError')
const httpStatusText = require('../utils/utils')
const jwt = require('jsonwebtoken')
const vrifyToken = (req,res,next)=>{
    
    const authHeader = req.headers['Authorization'] || req.headers['authorization']
    if(!authHeader){
        const error = appError.create('token is required',401,httpStatusText.ERROR)
        return next(error);
    }

    const token = authHeader.split(' ')[1];
    try{
        const currentUser = jwt.verify(token,process.env.JWT_SECRET)
        req.currentUser = currentUser
        next() 
    }catch(err){
        const error = appError.create('ivalid token',401,httpStatusText.ERROR)
        return next(error)
    }
}
module.exports = vrifyToken;