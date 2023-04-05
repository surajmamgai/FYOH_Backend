const { MongoClient } = require("mongodb")
require('dotenv').config();
const url = process.env.MONGODB_URL;
const client = new MongoClient(url);
const dbName = 'matrimonial';
client.connect();
const db = client.db(dbName);
const jwt = require('jsonwebtoken');

// Register to the platform
exports.user_signup = async function (req, res) {
    try {
        const profile_completeness = calculateProfileCompleteness(req.body);
        var result = await db.collection('users').find({ username: req.body.username }).toArray()
        if (result.length != 0)
        { 
            res.status(400)
            res.send({ "message": "Username Already Taken" })
        }
        else{
        await db.collection('users').insertOne({
            ...req.body,
            profile_completeness: profile_completeness,
            viewers: []
        }, function (err) {
            if (err) {
                res.send({ 'message': JSON.stringify(err) })
            }
        });
           res.send({ 'message': "Data Inserted Successfully!" })
        }
    } catch (e) {
        console.log(e)
        res.send({ 'message': JSON.stringify(e) })
    }
}


// Login to the platform
exports.user_login = async function (req, res) {
    try {
        
        var result = await db.collection('users').findOne({ username: req.body.username, password: req.body.password })
        if (!result) res.status(401).send({ "message": "No user Found" })
        else {
            const token = generateAccessToken({ username: req.body.username });
            res.cookie('token', token, {
            expires: new Date(Date.now() + 3600000), // expires in 1 hour
            httpOnly: true,
            secure: true,
            sameSite: 'none' // set the sameSite option to 'none' for cross-site requests
          });
            res.send({ 'message': "User Found!", "token": token })
        }

    }
    catch (e) {
        console.log(e)
        res.send({ "message": JSON.stringify(e) })
    }
}


// show users of opposite gender based on filter
exports.user_show = async function (req, res) {
    try {
      var filter = {};
      if (req.body.gender == "male") {
        filter.gender = "female";
      }
      else {
        filter.gender = "male";
      }
  
      if (req.body.age) {
        if(req.body.age_filter_type == "gt")
          filter.age = { $gt: req.body.age };
        else
          filter.age = { $lt : req.body.age};
      }
  
      if (req.body.height) {
        if(req.body.height_filter_type == "gt")
          filter.height = { $gt: req.body.height };
        else
          filter.height = { $lt : req.body.height};
      }
  
      if (req.body.religion) {
        filter.religion = req.body.religion;
      }
  
      if (req.body.education) {
        filter.education = { $in : req.body.education};
      }
  
      if (req.body.occupation) {
        filter.occupation = { $in : req.body.occupation};
      }
  
      const ineligible_users = await db.collection('requests').find(
        { 
          sender_username: req.body.viewer_username
        },
        { 
          projection: { 
            _id: 0, 
            receiver_username: 1 
          } 
        }
      ).toArray();
      const ineligible_user_usernames = ineligible_users.map(user => user.receiver_username);
      
      filter.username = { $nin: ineligible_user_usernames };
  
      const eligible_users = await db.collection('users').find(filter).toArray();
      res.send({ "data": eligible_users });
    } catch(err) {
      console.log(err);
      res.status(500)
      res.send("Internal Server Error");
    }
  }
  


// send request to a user
exports.send_request = async function (req, res) {
    try {
        await db.collection('requests').insertOne(req.body, function (err, res) {
            if (err) {
                res.send({ 'message': JSON.stringify(err) })
            }
        })
        res.send({ 'message': "Request Sent Successfully!" })
    }
    catch (e) {
        console.log(e)
        res.send({ "message": JSON.stringify(e) })
    }
}


// show requests received to you
exports.requests_show = async function (req, res) {
    try {
        var result = await db.collection('requests').find({ recevier_username: req.user.username }).toArray();
        res.send({ "data": result })
    }
    catch (e) {
        console.log(e)
        res.send({ "message": JSON.stringify(e) })
    }
}

// view a user's profile
exports.view_profile = async function (req, res) {
    try {
        const profileUsername = req.body.profile_username;
        const viewerUsername = req.body.viewer_username;
        if (profileUsername != viewerUsername) {
            await db.collection('users').updateOne(
                { username: profileUsername },
                { $addToSet: { viewers: viewerUsername } },
            );
        }

        const numViewers = await db.collection('users').aggregate([
            { $match: { username: profileUsername } },
            { $project: { _id: 0, number_of_viewers: { $size: '$viewers' } } },
        ]).toArray();

        await db.collection('users').updateOne(
            { username: profileUsername },
            { $set: { number_of_viewers: numViewers[0].number_of_viewers } }
        );

        const result = await db.collection('users').findOne({ username: profileUsername });
        res.send({ data: result });
    } catch (e) {
        console.log(e);
        res.send({ message: JSON.stringify(e) });
    }
};



const config = require('./profile_config.json');

function calculateProfileCompleteness(profile) {
    let completeness = 0;
    for (const field of Object.keys(config.fields)) {
        const weight = config.fields[field].weight;
        const value = profile[field];
        if (value && value != "" && value != null) {
            completeness += weight;
        }
    }
    return completeness;
}

// Updates the user's profile
exports.update_user = async function (req, res) {
    try {
        await db.collection('users').updateOne(
            { username: req.body.username },
            {
                $set: {
                    name: req.body.name,
                    education: req.body.education,
                    occupation: req.body.occupation,
                    height: req.body.height,
                    location: req.body.location,
                    photo: req.body.photo
                }
            });
        var result = await db.collection('users').find({ username: req.body.username }).toArray();

        const profile_completeness = calculateProfileCompleteness(result[0]);
    
        await db.collection('users').updateOne(
            { username: req.body.username },
            {
                $set: {
                    profile_completeness: profile_completeness
                }
            });
        res.send({ 'message': "Data Inserted Successfully!" })
    } catch (e) {
        console.log(e)
        res.send({ 'message': JSON.stringify(e) })
    }
}














// generate jwt token
function generateAccessToken(username) {
    return jwt.sign(username, "MYKEY");
}

exports.logged_in_user = async function get_logged_in_user_details(req, res) {
    console.log(req)
    try {
        console.log("suraj")
        var result = await db.collection('users').findOne({ username: req.user.username })
        res.send(result)
    }
    catch (e) {
        console.log(e)
        res.send({ "message": JSON.stringify(e) })
    }
}










