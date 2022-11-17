const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
require('dotenv').config();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ypkrnke.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req,res, next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message: "Unauthorized Access"});
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function( err,decoded){
    if(err){
      return res.status(403).send('Forbidden Access');
    }
    req.decoded = decoded;
    next();
  })

}

async function run(){
    try{
        const appointmentCollection = client.db('doctors-portal').collection('appointmentOptions');
        const bookingsCollection = client.db('doctors-portal').collection('bookings');
        const userCollection = client.db('doctors-portal').collection('users');

        app.get('/appointments', async(req,res)=>{
          //returns a particular date
          const date = req.query.date;
          const query = {};
          const cursor = appointmentCollection.find(query);
          const options = await cursor.toArray();
          //the date that matches query date
          const bookingQuery = { selectedDate : date};
          //returns all the bookings under the query date
          const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

          options.forEach(option => {
            // basically set of matched treatments
            const bookedOption = alreadyBooked.filter(
              (booked) => booked.treatment === option.name
            );
            const bookedSlots = bookedOption.map(
              (booked) => booked.selectedSlot
            );
            // available slots in a particular treatment 
            const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot));
            option.slots = remainingSlots;
          })
          res.send(options);
        })

        app.post('/bookings', async(req, res)=>{
            const query = req.body;
            // checks the selectedDate,treatment and email of a patient are common in bookings collection or not if there are similarities then is the query will be restricted
            const date = {
              selectedDate: query.selectedDate,
              treatment: query.treatment,
              email: query.email
            };
            const alreadyBooked = await bookingsCollection.find(date).toArray();
            if(alreadyBooked.length){
              const message = `You have booking on ${query.selectedDate}`;
              return res.send({ acknowledged: false, message });
            }
            const result = await bookingsCollection.insertOne(query);
            res.send(result);
            
        })

        app.get('/bookings',verifyJWT, async(req,res)=>{
          const query = req.query;
          if(req.decoded.email === query.email){
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
          }
          else{
            return res.status(403).send("Forbidden access");
          }
        })

        app.get('/jwt', async(req,res)=>{
          const email = req.query.email;
          
          const query = {email: email};
          const result = await userCollection.findOne(query);
          if(result){
            const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn:'1h'});
            return res.send({ accessToken: token });
          }
          res.status(403).send({accessToken: ''});
        })

        app.post('/users', async(req,res)=>{
          const query = req.body;
          const registered = await userCollection.insertOne(query);
          res.send(registered);
        })
    }
    finally{

    }
}

run().catch(error=> console.log(error))

app.get('/', (req, res)=>{
    res.send('Doctors Portal Running');
})

app.listen(port, ()=>{
    console.log('server running on port', port);
})