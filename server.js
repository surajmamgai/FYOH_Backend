const Express = require("express")
const port = 5000
const server = Express()
const Cors = require("cors")
const body_parser = require("body-parser")
const cookie_parser = require('cookie-parser');
server.use(Cors({
    origin: 'https://findyourotherhalf.onrender.com',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    exposedHeaders: ['Access-Control-Allow-Credentials']
}));
server.use(body_parser.json())
server.use(cookie_parser());

const { user_signup, user_login, user_show, send_request, requests_show, logged_in_user, view_profile, update_user } = require("./user")

server.listen(port, function () {
    console.log("Server is running");
})

const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const token = req.cookies['token'];
    console.log(token)
    if (token == null) {
        return res.sendStatus(401);
    }

    jwt.verify(token, "MYKEY", (err, user) => {
        if (err) {
            console.log(err)
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}


server.post('/add-user', user_signup)
server.post('/update-user', update_user)
server.post('/login/', user_login)
server.post('/logged-in-user', authenticateToken, logged_in_user)
server.post('/user-show/', authenticateToken, user_show)
server.post('/view-profile/', authenticateToken, view_profile)
server.post('/send-request', authenticateToken, send_request)
server.post('/requests-show/', authenticateToken, requests_show)



