/**
 * @author naiteluo
 */

// init sockets
var socket = io.connect('http://127.0.0.1:3001');

// init strings
var LOG_TEMPLATE = '<li class="{typeClass}"><strong>{type}</strong><span>{msg}</span></li>';

var WAITING_TIME = 50000;
var PREPARE_TIME = 5000;

// user state
var CHAT = 0;
var GUESS = 1;
var DRAW = 2;

// brushType.type
var ERASE = 0;
var PEN = 1;
var CLEAR = 2

var currentWord;
var users;
var usersSize = 0;

var counterHandler;
var tipHandlerOne;
var tipHandlerTwo;

var user = {
  name : null,
  state : CHAT,
  score : 0,
  isLogin : false,
  isAnswered: false
}


// draw-pad
var canvas, ctx;
var drawPad = {
  isDrawing : false,
  startX : 0,
  startY : 0,
  brushType: {
    thickness: 2,
    color: '#000000',
    type: PEN
  }
};

$(function() {
  // init
  initCanvas();
  initToolsBar();
  initCLI();

  // chat msg listener
  chatMsgListener();
  // game msg listener
  gameMsgListener();
  // announce listener
  announcementListener();
  // refresh users list
  usersListListener();

});

function initCLI() {
  $('body').keydown(onEnterDownListener);
}

function onEnterDownListener(e) {
  if (e.keyCode == 13) {
    $('#message').focus();
    if ( getContent().length > 0 ) {
      command(getContent());
    }
    setTimeout(clearMessage, 100);
  }
}

function getContent() {
  return $('#message').attr('value');
}

function clearMessage() {
  $('#message').attr('value', '');
}

function command(str) {
  var words = str.split(' ');
  if (!user.isLogin && words[0] == '#login' && words.length == 2) {
    userLogin(words[1]);
  }
  else if (str == '#clear') {
    clearChatLogs();
  }
  else if (user.isLogin && str == '#start') {
    if (usersSize > 2) {
      startGame();
    } else {
      console.log("人数不足");
      setLog('announcement', 'system', '人数不足，无法开始');
    }
  }
  else if (!user.isLogin) {
    setInfos(':-) 输入 \"#login username\" 登录。');
  }
  else if (user.isLogin && str.substr(0, 1) == '#') {
    setInfos('\> \< 错误命令。');
  }
  else if (user.isLogin && str == currentWord) {
    sendMsg('chat msg', {
      type : 'answer',
      msg : str
    });
  }
  else if (user.isLogin && str.length > 0) {
    sendMsg('chat msg', {
      type : 'chat',
      msg : str
    });
  }
}

function sendMsg(type, data) {
  socket.emit(type, data);
}

function chatMsgListener() {
  socket.on('chat msg', function(data) {
    if (data.from == user.name)
      setLog('me', '我', data.msg);
    else
      setLog('others', data.from, data.msg);
  });
}

function gameMsgListener() {
  socket.on('game msg', function(data) {
    if (data.type == 'start') {
      setLog('announcement', 'game message', data.msg);
    } else if (data.type == 'queue') {
      currentWord = data.word;
      setLog('announcement', 'game message', data.msg);
      var t = Math.floor(WAITING_TIME / 1000) - 1;
      clearInterval(counterHandler);
      clearTimeout(tipHandlerOne);
      setCounter(t);
      if (user.name == data.currentUser) {
        setLog('announcement',
          'game message', 
          '你画的是' + '<span class="word">' + data.word + '</span>');
        clearDrawPad();
        resetDrawPad();
        enableDrawPad();
      } else {
        clearDrawPad();
        resetDrawPad();
        disableDrawPad();
        tipHandlerOne = setTimeout(function() {
          setLog('announcement', 'tips', '这个词有' + data.word.length + '个字。');
        });
      }
    } else if (data.type == 'draw') {
      drawPad = data.drawPad;
      controlDraw(data);
    } else if (data.type == 'over') {
      clearInterval(counterHandler);
      clearDrawPad();
      resetDrawPad();
      enableDrawPad();
      setLog('announcement', '游戏信息', data.msg);
      getResult(data.users);
    }
  });
}

function usersListListener() {
  socket.on('users list', function(data) {
    usersSize = getUsersSize(data);
    $('#users-list').empty();
    for(key in data) {
      $('<li>' + data[key].name + '(' + data[key].score + ')</li>').appendTo($('#users-list'));
    }
  });
}

function announcementListener() {
  socket.on('announcement', function(data) {
    setLog('announcement', data.type, data.msg);
  });
}

function setLog(typeClass, from, msg) {
  var template = LOG_TEMPLATE;
  $(template
    .replace('{typeClass}', typeClass)
    .replace('{type}', from, 'g')
    .replace('{msg}', msg, 'g')
  ).appendTo($('#messages')).hide().fadeIn(100);
  autoScroll();
}

function userLogin(name) {
  if(name.length > 1) {
    sendMsg('chat msg', {
      type : 'login',
      name : name
    });
    socket.on('login ack', function(data) {
      if(data.ok) {
        user.name = data.name;
        user.isLogin = true;
        setLoginState();
        setInfos('欢迎， ' + name);
      } else {
        setInfos('<span style="color:red;">对不起，用户名已被占用</span>');
      }
    });
  }
}

function setLoginState() {
  $('#login-info').removeClass('offline')
    .fadeTo(200, 0.2)
    .empty()
    .addClass('online')
    .html('Online')
    .fadeTo(200, 1);
}

function setInfos(str) {
  $('#infos').fadeIn();
  $('#infos span.info').html(str);
}

function autoScroll() {
  setTimeout(function() {
    $('#messages').scrollTop(
      document.getElementById('messages').scrollHeight + 100000
      );
    }, 100);
}

function clearChatLogs() {
  $('#messages').fadeTo(200, 0.1).empty().fadeTo(100, 1);
}

function getUsersSize(obj) {
  var size = 0;
  for(key in obj) {
    if (obj.hasOwnProperty(key)) {
      size ++;
    }
  }
  return size;
}

function setCounter(t) {
  $('#counter').html(t);
  t --;
  counterHandler = setInterval(function() {
    $('#counter').html(t);
    t --;
  }, 1000);
}

function getResult(users) {
  var arr = [];
  var result = '游戏结果如下，<br />';
  for(key in users) {
    arr.push({name : users[key].name, score : users[key].score});
  }
  for(var i = 0; i < arr.length - 1; i++) {
    for(var j = i + 1; j < arr.length; j ++) {
      if (arr[i].score < arr[j].socre) {
        var temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
      }
    }
  }
  for(var i = 0; i < arr.length; i ++) {
    result += (arr[i].name + ': ' + arr[i].score + '分<br />');
  }
  setLog('announcement', 'game result', result);
}
