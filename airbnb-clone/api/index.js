const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const cookieParser = require("cookie-parser")
const download = require("image-downloader")
const multer = require("multer")
const fs = require("fs")
const User = require("./models/User")
const Place = require("./models/Place")
const Booking = require("./models/Booking")
const { resolve } = require("path")
require("dotenv").config()
const app = express()

const bcryptSalt = bcrypt.genSaltSync(10)//A salt is a random string. By hashing a plain text password plus a salt, the hash algorithm’s output is no longer predictable. The same password will no longer yield the same hash. The salt gets automatically included with the hash, so you do not need to store it in a database.Next, we set the saltRounds value. The higher the saltRounds value, the more time the hashing algorithm takes. You want to select a number that is high enough to prevent attacks, but not slower than potential user patience. In this example, we use the default value, 10.

const jwtSecret = "fffkfjfnkfnkfnewfwlfwfmfl";


app.use(express.json())//json parser
app.use(cookieParser())
app.use(cors({
  credentials:true, //The Access-Control-Allow-Credentials response header tells browsers whether the server allows cross-origin HTTP requests to include credentials. Credentials are cookies, TLS client certificates, or authentication headers containing a username and password.
  origin:""
}))
app.use("/uploads",express.static(__dirname+"/uploads"))

mongoose.connect(process.env.MONGO_URL)


function getUserDataFromToken(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.get("/test",(req,res)=>{
  res.json("test ok")
})

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt)
    });
    res.json(userDoc);
  } catch (error) {
    res.status(422).json(error);
  }
});

app.post("/login",async(req,res)=>{
  const {email,password} = req.body;
  const userDoc = await User.findOne({email})

  if (userDoc) {
    const passVerify = bcrypt.compare(password,userDoc.password)
    if(passVerify){
      jwt.verify({
        email:userDoc.email,
        id:userDoc._id,
        name:userDoc.name
      },jwtSecret,{},(err,token)=>{
        if(err) throw err;
        res.cookie("token",token).json(userDoc)
      })
    } else {
      res.status(422).json("Password not verified")
    }
    res.json("Found") 
  } else {
    res.json("Not found")
  }
})

app.get("/profile",(req,res)=>{
  const token = req.cookies
  if (token) {
    jwt.verify(token,jwtSecret,{},async(err,userData)=>{
      if (err) throw err;
      const {name,email,_id} = await User.findById(userData.id)
      res.json({name,email,_id})
    })
  } else {
    res.json(null)
  }
})

app.post("/logout",(req,res)=>{
  res.cookie("token","").json(true)
})

app.post("upload-by-link",async(req,res)=>{
  const{link} = req.body
  const newName = "photo" + Date.now() + ".jpg"
  await download.image({
    url:link,
    dest: __dirname + "/uploads" + newName
  })
  res.json(__dirname + "/uploads" + newName)
})

const photosMiddleware = multer({dest:"uploads"})

app.post("/upload",photosMiddleware.array("photos",100),(req,res)=>{
  const uploadedFiles = []
  for (let i = 0; i < files.length; i++){
    const {path,originalName} = req.files[i]
    const parts = originalName.split(".")
    const extension = parts[parts.length - 1]
    const newPath = path + "." + extension
    fs.renameSync(path,newPath)
    uploadedFiles.push(newPath.replace("uploaded","")) 
  }
  res.json(uploadedFiles)
})

app.post("/places",(req,res)=>{
  const {token} = req.cookies
  const { title,
    descripton,
    address,
    photos, 
    perks,
    extraInfo, 
    checkIn,
    checkOut, 
    maxGuests,
    price} = req.body
  jwt.verify(token,jwtSecret,{},async(err,userData)=>{
    if (err) throw err
    const placeDoc = await Place.create({
      owner:userData.id,
      title,
      descripton,
      address,
      photos, 
      perks,
      extraInfo, 
      checkIn,
      checkOut, 
      maxGuests,
      price
    })
    res.json(placeDoc)
  })
})

app.get("/places",(req,res)=>{
  const {token} = req.cookies
  jwt.verify(token,jwtSecret,{},async(err,userData)=>{
    const {id} = userData
    res.json(await Place.find({owner:id}))
  })
})

app.get("/places/:id",async(req,res)=>{
  const {id} = req.params;
  res.json(await Place.findById(id))
})

app.put("/places",async(req,res)=>{
  const {token} = req.cookies
  const {
    id, 
    title,
    descripton,
    address,
    photos, 
    perks,
    extraInfo, 
    checkIn,
    checkOut, 
    maxGuests,
    price
  } = req.body
  jwt.verify(token,jwtSecret,{},async(err,userData)=>{
    if (err) throw err
    const placeDoc = await Place.findById(id)
    if(userData.id == placeDoc.owner.toString()){
      placeDoc.set({
        title,
        descripton,
        address,
        photos, 
        perks,
        extraInfo, 
        checkIn,
        checkOut, 
        maxGuests,
        price
      })
      await placeDoc.save() //update
      res.json("ok")
    }
  })
})

app.put("/bookings",(req,res)=>{
  const userData = getUserDataFromToken(req)
  const {
    place,checkIn,checkOut,numberOfGuests,name,phone,price
  } = req.body
  Booking.create({
    place,checkIn,checkOut,numberOfGuests,name,phone,price
  }).then((doc)=>{
    res.json(doc)
  }).catch((err)=>{
    throw err
  })
})

app.get('/bookings', async (req,res) => {
  const userData = await getUserDataFromReq(req);
  res.json( await Booking.find({user:userData.id}).populate('place'))
})

app.listen(6000)