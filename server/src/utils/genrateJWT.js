const jwt = require('jsonwebtoken');

module.exports= async(payload)=>{
   const token = await  jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {expiresIn:'7d'}
    );

   return token; 
}