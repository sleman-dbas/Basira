const otpGenerator = require('otp-generator');

module.exports.generateOTP = () => {
  const OTP = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    digits: true,
    lowerCaseAlphabets: false
  });

  return OTP;
};

 module.exports.localvariables=(req,res,next)=>{
  req.app.locals = {
    OTP : null,
    resetSesstion: false
  }
  next()
}

