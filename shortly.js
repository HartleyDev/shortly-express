var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var hash = require('./node_modules/bcrypt-nodejs/bCrypt.js').hash;
var compare = require('./node_modules/bcrypt-nodejs/bCrypt.js').compare;

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.bodyParser())
  app.use(express.static(__dirname + '/public'));
});
app.use(express.bodyParser());
app.use(express.cookieParser('shhhhh'));
app.use(express.session());

app.use(function(req,res,next){
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if(err) res.locals.message = '<p class="msg error">' + err + '</p>'; 
  if(msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

app.get('/', checkUser, function(req, res) {
  res.render('index');
});

app.get('/create', checkUser, function(req, res) {
  res.render('index');
});

app.get('/links', checkUser, function(req, res) {
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
function checkUser(req, res, next){
  if(req.session.user){
    next();
  }else {
    req.session.error = 'Access Denied. Please Login';
    res.redirect('login');
  }
};

function authenticate(name, pass, next){
  new User({username: name}).fetch().then(function(found){
    var hash = found.attributes.password;
    console.log(hash);

    compare(pass, hash, function(err, outcome){
      if(outcome){
        next();
      }else{
        console.log(outcome);
      }
    });
  });
};

app.get('/login', function(req, res){
  res.render('login');
});

app.post('/login', function(req, res){
  var name = req.body.username;
  var pass = req.body.password;
  authenticate(name, pass, function(){
    res.render('index');
  });
});

app.get('/signup', function(req, res){
  res.render('signup');
});

app.post('/signup', function(req, res){
  //if no user 
    //create user
  hash(req.body.password, null, null, function(err, hash){
    new User({username: req.body.username, password: hash}).save().then(function(newUser){
      Users.add(newUser);
      res.render('index');
    });
  });
  //else
    // display errors
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
