$(document).ready(function () {
  var model = $('[data-model]').attr('data-model');
  $('dd[data-json] a').click(function(e) {
    var dd = $(this).closest('dd');
    var json = dd.attr('data-json');
    var content = $(this).html();
    dd.attr('data-json', content);
    $(this).html(json);
  });
  
  $('a.objectId').click(function(e) {
    var a = $(this),
    content = a.next('dl'),
    id = a.text();
    if (content.length > 0) {
      content.toggle();
    } else {
      $.get('/Models/getObject/' + model + '/' + id, null, function(html, status) {
        a.after(html);
      }, 'html');
    }
  });
  
  $('ul.col').columnizeList({cols:10,constrainWidth:1});
});






/*
Copyright (c) 2007 Christian yates
christianyates.com
chris [at] christianyates [dot] com
Licensed under the MIT License: 
http://www.opensource.org/licenses/mit-license.php
 
Inspired by work of Ingo Schommer
http://chillu.com/2007/9/30/jquery-columnizelist-plugin
*/
(function($){
  $.fn.columnizeList = function(settings){
    settings = $.extend({
      cols: 3,
      constrainWidth: 0
    }, settings);
    // var type=this.getNodeType();
    var container = this;
    if (container.length == 0) { return; }
    var prevColNum = 10000; // Start high to avoid appending to the wrong column
    var size = $('li',this).size();
    var percol = Math.ceil(size/settings.cols);
    var tag = container[0].tagName.toLowerCase();
    var classN = container[0].className;
    var colwidth = Math.floor($(container).width()/settings.cols);
    var maxheight = 0;
    // Prevent stomping on existing ids with pseudo-random string
    var rand = Math.floor(Math.random().toPrecision(6)*10e6);
    $('<ul id="container'+rand+'" class="'+classN+'"></ul>').css({width:$(container).width()+'px'}).insertBefore(container);
    $('li',this).each(function(i) {
      var currentColNum = Math.floor(i/percol);
      if(prevColNum != currentColNum) {
        if ($("#col" + rand + "-" + prevColNum).height() > maxheight) { maxheight = $("#col" + rand + "-" + prevColNum).height(); }
        $("#container"+rand).append('<li class="list-column-processed"><'+tag+' id="col'+rand+'-'+currentColNum+'"></'+tag+'></li>');
      }
      $(this).attr("value",i+1).appendTo("#col"+rand+'-'+currentColNum);
      prevColNum = currentColNum;
    });
    $("li.list-column-processed").css({
      'float':'left',
      'list-style':'none',
      'margin':0,
      'padding':0
    });
    if (settings.constrainWidth) {
      $(".list-column-processed").css({'width':colwidth + "px"});
    };
    $("#container"+rand).after('<div style="clear: both;"></div>');
    $("#container"+rand+" "+tag).height(maxheight);
    // Add CSS to columns
    this.remove();        
    return this;
  };
})(jQuery);