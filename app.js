/**
 * Demo Chat with WebSockets
 * nodejs socket.io
 * v 2.0
 */

/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , sio = require('socket.io');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res) {
  res.render('index', {title: 'Draw And Guess'});
});

app.listen(3001);
console.log("Express server listening on port %d in %s mode", 
  app.address().port,
  app.settings.env);


// Connection in WebSockets with socket.io
var io = sio.listen(app);
// some const
var WAITING_TIME = 50000;
var PREPARE_TIME = 5000;
var MAX_ROUNDS = 3;
var WELCOME_MSG = "服务器连接成功，请先登录。"

// user state
var CHAT = 0;
var GUESS = 1;
var DRAW = 2;

// msg emit method
var ALL = 0;
var OTHERS = 1;
var SELF = 2;

// game
var game = {
  isStarted : false,
  round: 0,
  currentTurn : 0,
  currentWord : '',
  currentScore : 5,
  words : ['苹果','香蕉','春哥','飞机','蛋疼','菊紧',
          '猫叔','非主流少女','浏览器','微博','facebook',
          'android','奥巴马','五月天','牛奶','日本',
          '大爷','火影忍者','海贼王','路飞','博客',
          'vim','桌子','玫瑰花','天朝','曾轶可','长城',
          '火箭','太阳','月亮','交换机','路由器',
          'ipad','电池','编译器','SSD','google', 
          '奶茶','抹茶','抹茶蛋糕','麦当劳','日月神教'],
  gameLoopIntervalHandler : null,
}

// list of all user, {'name' : user object}
var users = {}

// basic methods defines
function getCurrentWord() {
  return game.currentWord;
}

function getNewWord() {
  game.currentWord = game.words[Math.floor(Math.random() * game.words.length - 1)];
  return game.currentWord;
}

function getCurrentTurn() {
  return game.currentTurn;
}

function setCurrentTurn() {
  game.currentTurn = (getCurrentTurn() + 1 < getUsersSize()) ? (getCurrentTurn() + 1) : 0;
}

game.getCurrentScore = function() {
  this.currentScore --;
  return (this.currentScore >= 0) ? (this.currentScore + 1) : 0;
}

game.resetCurrentScore = function() {
  this.currentScore = 5;
}

function isValid(name) {
  for(key in users) {
    if (users[key].name == name)
      return false;
  }
  return true;
}

function getUserId(name) {
  var id = 0;
  for(key in users) {
    if (name == users[key])
      return id;
    else
      id ++;
  }
  return null;
}

function getUserByTurn(turn) {
  var id = 0;
  for(key in users) {
    if(turn == id)
      return users[key];
    else
      id ++;
  }
  return null;
}

function getUserByName(name) {
  if (isValid(name))
    return null;
  else
    return users[name];
}

function getUsersSize() {
  var size = 0;
  for(key in users) {
    if (users.hasOwnProperty(key)) {
      size ++;
    }
  }
  return size;
}

function setUserScore(name, score) {
  users[name].score += score;
}

function resetAllIsAnswed() {
  for (key in users) {
    users[key].isAnswered = false;
  }
}

function resetAllScore() {
  for (key in users) {
    users[key].score = 0;
  }
}

// operations during connection
io.sockets.on('connection', function(socket) {
  socket.user = {
    name : null,
    state : CHAT,
    score : 0,
    isLogin : false,
    isAnswered: false
  }
  
  refreshUsersList();
  
  //chatMsgListener
  socket.on('chat msg', function(data) {
    if (data.type == 'login') {
      userLogin(data);
    }
    if (data.type == 'chat' && socket.user.isLogin) {
      // need more validate
      io.sockets.emit('chat msg', {
        from : socket.user.name,
        msg : data.msg});
    }
    if (data.type == 'answer') {
      processAnswer(data);
    }
    if (data.type == 'start') {
      startGame(data);
    }
  });
  
  // gameMsgListener
  socket.on('game msg', function(data) {
    if (data.type = 'draw') {
      socket.broadcast.emit('game msg', data);
    }
  });

  // disconncetListener
  socket.on('disconnect', function(){
    if (!socket.user.name) return;
    delete users[socket.user.name];
    io.sockets.emit('announcement', {
      type : 'system',
      msg : socket.user.name + '已下线'
    });
    refreshUsersList();
  });
  
  function userLogin(data) {
    if (!socket.user.name && isValid(data.name)) {
      socket.user.name = data.name;
      socket.user.isLogin = true;
      users[socket.user.name] = socket.user;
      console.log(users);
      socket.emit('login ack', {ok : true, name : data.name});
      socket.broadcast.emit('announcement', {
        type : 'system',
        msg : socket.user.name + '已上线'
      });
      refreshUsersList();
    } else {
      console.log('WARNNING, user name invalid');
      socket.emit('login ack', {ok : false});
    }
  }
  
  function processAnswer(data) {
    if (!users[socket.user.name].isAnswered && data.msg == getCurrentWord()) {
      setUserScore(socket.user.name, game.getCurrentScore());
      getUserByName(socket.user.name).isAnswered = true;
      io.sockets.emit('announcement', {
        type : 'game message', 
        msg : socket.user.name + '猜出来了， ' + ((game.currentScore != 0) ? (game.currentScore + 1) : 0)
      });
      socket.emit('announcement', {type : 'game message', msg : '恭喜你答对。'});
      refreshUsersList();
    }
  }
  
  function startGame(data) {
    io.sockets.emit('game msg', { 
        type : 'start',
        msg : data.from + '开始了游戏，当前人数为：' + getUsersSize()
    });
    resetAllScore();
    game.isStarted = true;
    setTimeout(gameLoop, PREPARE_TIME);
    game.gameLoopIntervalHandler = setInterval(gameLoop, WAITING_TIME);
  }
  
  function gameLoop() {
    resetAllIsAnswed();
    game.resetCurrentScore();
    users[getUserByTurn(getCurrentTurn()).name].isAnswered = true;
    refreshUsersList();
    if(checkRound()) {
      io.sockets.emit('game msg', {
        type : 'queue',
        currentUser : getUserByTurn(getCurrentTurn()).name,
        currentTurn : getCurrentTurn(),
        word : getNewWord(),
        msg : '轮到' + getUserByTurn(getCurrentTurn()).name + '画你们猜。'
      });
      setCurrentTurn();
    } else {
      return;
    }
  }
  
  function refreshUsersList() {
    io.sockets.emit('users list', users);
  }
  
  function checkRound() {
    if (game.currentTurn == 0) {
      game.round ++;
      if (game.round <= MAX_ROUNDS) {
        io.sockets.emit('announcement', {
          type : 'game message', 
          msg : '现在是第 ' + game.round +' 轮。'});
          return true;
      } else {
        clearInterval(game.gameLoopIntervalHandler);
        io.sockets.emit('game msg', {
          type : 'over', 
          msg : '游戏结束。',
          users : users});
        game.round = 0;
        return false;
      }
    }
    return true;
  }
});