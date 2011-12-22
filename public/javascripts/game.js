/**
 * @author naiteluo
 */

function initCanvas() {
  // canvas context
  canvas = document.getElementById("draw-pad");
  ctx = canvas.getContext('2d');
}

// tools bar
function initToolsBar() {
  // movable
  setToolsBarMovable(); 
  // set hide
  setToolHide();
}

var setToolsBarMovable = function() {
  var canMove = false;
  var x = parseInt($('#tools-bar').css('left'));
  var y = parseInt($('#tools-bar').css('top'));
  return function() {
    $('#tools-bar').mousedown(function(e) {
      canMove = true;
      x = e.layerX || 0;
      y = e.layerY || 0;
    });
    $('#tools-bar').mousemove(function(e) {
      if(canMove) {
        var mouseX = e.layerX || 0;
        var mouseY = e.layerY || 0;
        $('#tools-bar').css({
          left: parseInt($('#tools-bar').css('left')) + (mouseX - x),
          top: parseInt($('#tools-bar').css('top')) + (mouseY - y)
        });
      }
    });
    $('#tools-bar').mouseup(function() {
      canMove = false;
    });
  }
}();

function setToolHide() {
  $('#tools-bar-title').toggle(function() {
    $('.tool').children('ul').slideDown();
  }, function() {
    $('.tool').children('ul').slideUp();
  });
  $('.tool strong').toggle(function() {
    $(this).next('ul').slideDown();
  }, function() {
    $(this).next('ul').slideUp();
  });
}

function initTool() {
  $('.tool ul#thickness li').click(function() {
    var thickness = 1;
    if($(this).attr('class') == 'thickness_1') thickness = 1;
    if($(this).attr('class') == 'thickness_2') thickness = 2;
    if($(this).attr('class') == 'thickness_3') thickness = 3;
    drawPad.brushType.type = PEN;
    drawPad.brushType.thickness = thickness;
  });
  
  $('.tool ul#erase li').click(function() {
    var thickness = 1;
    if($(this).attr('class') == 'thickness_1') thickness = 1;
    if($(this).attr('class') == 'thickness_2') thickness = 2;
    if($(this).attr('class') == 'thickness_3') thickness = 3;
    drawPad.brushType.type = ERASE;
    drawPad.brushType.thickness = thickness;
  });
  
  $('.tool ul#colors li').click(function() {
    drawPad.brushType.color = $(this).attr('class');
  });
  
  $('#clear').click(function() {
    clearDrawPad();
    // send draw-pad data
    drawPad.brushType.type = CLEAR;
    sendMsg('game msg',
      { type : 'draw',
        drawPad: drawPad});
    resetDrawPad();
  });
}

function disableTool() {
  $('.tool ul#thickness li').unbind();
  $('.tool ul#erase li').unbind();
  $('.tool ul#colors li').unbind();
}

function onMouseDownListener(e) {
  var mouseX = e.layerX || 0;
  var mouseY = e.layerY || 0;
  drawPad.startX = mouseX;
  drawPad.startY = mouseY;
  drawPad.isDrawing = true;
}

function onMouseMoveListener(e) {
  if (drawPad.isDrawing) {
    var mouseX = e.layerX || 0;
    var mouseY = e.layerY || 0;
    if (!(mouseX == drawPad.startX && 
      mouseY == drawPad.startY)) {

      draw(ctx, mouseX, mouseY);
      // send draw-pad data
      sendMsg('game msg',
        { type : 'draw',
          startX : drawPad.startX,
          startY : drawPad.startY,
          endX : mouseX,
          endY : mouseY,
          drawPad: drawPad});
      drawPad.startX = mouseX;
      drawPad.startY = mouseY;
    }
  }
}

function onMouseUpListener() {
  drawPad.isDrawing = false;
}

function draw(ctx, x, y) {
  switch(drawPad.brushType.type){
    case PEN : 
      drawLine(ctx, drawPad.startX, drawPad.startY, x, y, drawPad.brushType.thickness);
      break;
    case ERASE :
      erase(ctx, x, y, drawPad.brushType.thickness);
      break;
    default :
      drawLine(ctx, drawPad.startX, drawPad.startY, x, y, drawPad.brushType.thickness);
      break;
  }
}

function drawLine(ctx, x1, y1, x2, y2, thickness) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = thickness;
  ctx.strokeStyle = drawPad.brushType.color;
  ctx.stroke();
}

function erase(ctx, x, y, thickness) {
  ctx.clearRect(x, y, (x + thickness / 100), (y + thickness / 100));
}

function clearDrawPad() {
  ctx.clearRect(0, 0, 560, 480);
}

function controlDraw(data) {
  if(data.drawPad.brushType.type == CLEAR) {
      clearDrawPad();
    } else {
      drawPad = data.drawPad;
      draw(ctx, data.endX, data.endY);
    }
}

function enableDrawPad() {
  $('#draw-pad').mousedown(onMouseDownListener);
  $('#draw-pad').mousemove(onMouseMoveListener);
  $('#draw-pad').mouseup(onMouseUpListener);
  // init tools function
  initTool();
}

function disableDrawPad() {
  $('#draw-pad').unbind();
  disableTool();
}

function startGame() {
  socket.emit('chat msg', {type : 'start', from: user.name});
}

function resetDrawPad() {
  drawPad.isDrawing = false;
  drawPad.startX = 0;
  drawPad.startY = 0;
  drawPad.brushType = {
    tickness: 2,
    color: '#000000',
    type: PEN
  };
}
