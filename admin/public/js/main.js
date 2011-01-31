$(document).ready(function () {
  var model = $('[data-model]').attr('data-model');
  $('dd[data-json] a').click(function(e) {
    var dd = $(this).closest('dd');
    var json = dd.attr('data-json');
    var content = $(this).html();
    dd.attr('data-json', content);
    $(this).html(json);
  });
  
  var getObjectDetails = function (type, e) {
    var a = type === 'object' ? $(this).find('a') : $(this),
    content = a.next('div.' + type),
    id = a.closest('[data-id]').attr('data-id');
    if (content.length > 0 && (type === 'relations' || e.target.nodeName !== 'A') ) {
      content.toggle();
    } else if (type !== 'object' || e.target.nodeName !== 'A') {
      relModel = model;
      if (!model) {
        // we're not on a model page
        var relModel = a.closest('[data-model-rel]').attr('data-model-rel');
      }
      var url = '/Models/get' + type.charAt(0).toUpperCase() + type.slice(1) + '/' + relModel + '/' + id;
      $.get(url, null, function(html, status) {
        a.after(html);
      }, 'html');
    }
  }
  $('a.objectId').closest('li').click(function(e) {
    getObjectDetails.apply(this, ['object', e]);
  });
  
  $('div.relations > a').live('click', function (e) {
    getObjectDetails.apply(this, ['relations', e]);
  });
  
  $('ul.columnize').columnizeList({cols:8,constrainWidth:1});
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
    if (container.length == 0) {return;}
    var prevColNum = 10000; // Start high to avoid appending to the wrong column
    var size = $('li',this).size();
    var percol = Math.ceil(size/settings.cols);
    var tag = container[0].tagName.toLowerCase();
    var classN = container[0].className;
    var colwidth = Math.floor($(container).width()/settings.cols);
    var maxheight = 10;
    // Prevent stomping on existing ids with pseudo-random string
    var rand = Math.floor(Math.random().toPrecision(6)*10e6);
    $('<ul id="container'+rand+'" class="'+classN+'"></ul>').css({width:$(container).width()+'px'}).insertBefore(container);
    $('li',this).each(function(i) {
      var currentColNum = Math.floor(i/percol);
      if(prevColNum != currentColNum) {
        if ($("#col" + rand + "-" + prevColNum).height() > maxheight) {maxheight = $("#col" + rand + "-" + prevColNum).height();}
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