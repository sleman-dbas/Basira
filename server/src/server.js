const express = require("express") ; 
const cors = require('cors')
const mongoose = require('mongoose');
const admin = require("firebase-admin");
require('dotenv').config() ;

const PORT = process.env.PORT || 3000 ; 

const server =  express();


// Define CORS options
const corsOptions = {
    credentials: true,
    cors: {
      origin: [
        "https://localhost",
      ],
      methods: ["GET", "POST"]
    }
};

// Use CORS and JSON middleware
server.use(express.json());
server.use(cors(corsOptions));
server.use(express.urlencoded({ extended: true }));
server.use('/uploads', express.static('uploads'));

// إعداد Firebase Admin
const serviceAccount = require("./fireBase/firebase-service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Import routes
const studntRouts = require('./routes/Users_mangment/Students_mangment.router'); 
const userRoutes = require('./routes/Users_mangment/Users_mangment.router'); 
const volunteerRoutes = require('./routes/Users_mangment/Volunteers_mangment.router'); 
const studentsFileRoutes = require('./routes/Users_Files/Students_Files.routes'); 
const employeeFileRoutes = require('./routes/Employee_managment/employee.routes'); 
const dashboardRoutes = require('./routes/Dashboard/Dashboard.routes')


// Set up routes
server.use('/api/students',studntRouts);
server.use('/api/users',userRoutes);
server.use('/api/volunteers',volunteerRoutes);
server.use('/api/student-files',studentsFileRoutes);
server.use('/api/employee',employeeFileRoutes);
server.use('/api/dashboard',dashboardRoutes);



// Static file serving



// MongoDB connection

console.log(process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));



// Error handling middleware
server.use((error,req,res,next)=>{
    res.status(error.statusCode || 500).json({status:false ,message:error.message,errors:error.errors , data: null})
});

server.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`)
})