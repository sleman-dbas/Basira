const express = require("express") ; 
const cors = require('cors')
const  mongoose  = require('mongoose');
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
server.use(cors(corsOptions));
server.use(express.urlencoded({ extended: true }));
server.use(express.json());



// Import routes
const studntRouts = require('./routes/Users_mangment/Students_mangment.router'); 



// Set up routes
// server.use('/api/students',studntRouts);



// Static file serving



// MongoDB connection

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