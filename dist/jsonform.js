window.jsonform = {};

window.jsonform.helpers = {
  changed: function() {
    return jQuery.event.trigger('jf:change');
  },
  newField: function(jfObj) {
    var field, klass;
    klass = jsonform[jfObj.jfType];
    if (klass) {
      field = new jsonform[jfObj.jfType](jfObj);
      field.jel = $('<div class="jfField"></div>');
      field.el = field.jel[0];
      return field;
    } else {
      return console.error("jsonform field doesnt exist: " + jfObj.jfType);
    }
  }
};

jsonform.AjaxField = (function() {
  function AjaxField(config) {
    this.config = config;
    this.tmpl = JST["fields/ajax"];
  }

  AjaxField.prototype.render = function() {
    var timeout;
    timeout = void 0;
    this.jel.html(this.tmpl(this.config));
    return this.jel.find(".chosen-select").chosen({
      width: "300px",
      allow_single_deselect: true,
      no_results_text: 'Searching for'
    }).on('chosen:no_results', (function(_this) {
      return function(e) {
        clearTimeout(timeout);
        return timeout = setTimeout(function() {
          return _this.loadAjax(e);
        }, 800);
      };
    })(this)).change(jsonform.helpers.changed);
  };

  AjaxField.prototype.getValue = function() {
    return this.jel.find(".chosen-select").val();
  };

  AjaxField.prototype.loadAjax = function(e) {
    var chosen, query, searchVal;
    chosen = this.jel.find(".chosen-container");
    query = {};
    searchVal = chosen.find(".chosen-search input").val();
    query[this.config.jfQueryParam] = searchVal;
    return $.ajax({
      url: this.config.jfUrl,
      data: query,
      type: 'GET',
      success: (function(_this) {
        return function(data) {
          var results, select;
          results = _this.config.jfParse(data);
          if (results.length === 0) {
            return chosen.find("chosen-results").html("<li class=\"no-results\">No results matched \"<span>" + searchVal + "</span>\"</li>");
          } else {
            select = _this.jel.find(".chosen-select");
            _.each(results, function(result) {
              return select.append('<option value="' + result[0] + '">' + result[1] + '</option>');
            });
            select.trigger("chosen:updated");
            return chosen.find(".chosen-search input").val(searchVal);
          }
        };
      })(this),
      error: function(data) {
        return console.log("error baby");
      }
    });
  };

  return AjaxField;

})();

jsonform.BooleanField = (function() {
  function BooleanField(config) {
    this.config = config;
    this.tmpl = JST["fields/boolean"];
  }

  BooleanField.prototype.render = function() {
    this.jel.html(this.tmpl(this.config));
    return this.jel.find(".chosen-select").chosen({
      disable_search_threshold: 5,
      width: "300px"
    }).change(jsonform.helpers.changed);
  };

  BooleanField.prototype.getValue = function() {
    return this.jel.find(".chosen-select").val() === "true";
  };

  return BooleanField;

})();

jsonform.FieldCollectionDel = (function() {
  function FieldCollectionDel(field) {
    this.deltmpl = JST["fields/fieldcollection-del"];
    this.field = field;
  }

  FieldCollectionDel.prototype.render = function() {};

  return FieldCollectionDel;

})();

jsonform.FieldCollection = (function() {
  function FieldCollection(config) {
    this.config = config;
    this.tmpl = JST["fields/fieldcollection"];
    this.deltmpl = JST["fields/fieldcollection-del"];
    this.jel = $("<div></div>");
    this.el = this.jel[0];
    this.fields = [];
  }

  FieldCollection.prototype.render = function() {
    this.jel.html(this.tmpl(this.config));
    return this.jel.find(".jfAdd").click((function(_this) {
      return function(e) {
        if ($(_this).is("[disabled]")) {
          return;
        }
        e.preventDefault();
        return _this.addOne();
      };
    })(this));
  };

  FieldCollection.prototype.getValue = function() {
    var results;
    results = _.map(this.fields, function(field) {
      return field.getValue();
    });
    return _.compact(results);
  };

  FieldCollection.prototype.addOne = function() {
    var del, field, fieldConfig;
    fieldConfig = _.extend({}, this.config);
    delete fieldConfig.jfTitle;
    field = jsonform.helpers.newField(fieldConfig);
    this.fields.push(field);
    this.jel.append(field.el);
    field.render();
    del = $(this.deltmpl());
    field.jel.append(del);
    del.click((function(_this) {
      return function() {
        del.remove();
        field.jel.remove();
        _this.fields = _.without(_this.fields, field);
        _this.checkAddState();
        return jsonform.helpers.changed();
      };
    })(this));
    this.checkAddState();
    return jsonform.helpers.changed();
  };

  FieldCollection.prototype.checkAddState = function() {
    if (this.config.jfMax) {
      if (this.fields.length >= this.config.jfMax) {
        return this.jel.find(".jfAdd").attr("disabled", "disabled");
      } else {
        return this.jel.find(".jfAdd").removeAttr("disabled");
      }
    }
  };

  return FieldCollection;

})();

jsonform.Form = (function() {
  function Form(txtArea, jsonConfig) {
    this.jel = $('<div class="jfForm"></div>');
    this.jtxt = $(txtArea);
    this.jtxt.hide();
    this.fields = [];
    this.jsonConfig = jsonConfig;
    this.parseJsonConfig(this.jsonConfig);
    _.each(this.fields, (function(_this) {
      return function(field) {
        _this.jel.append(field.el);
        return field.render();
      };
    })(this));
    $(document).bind('jf:change', (function(_this) {
      return function() {
        var json;
        json = _this.generateJson(_this.jsonConfig);
        return _this.jtxt.val(JSON.stringify(json));
      };
    })(this));
    this.jtxt.after(this.jel);
  }

  Form.prototype.generateJson = function(obj) {
    var newObj;
    if (_.isArray(obj)) {
      if (obj.length === 1 && obj[0].jfField) {
        return obj[0].jfField.getValue();
      } else {
        return _.map(obj, (function(_this) {
          return function(v) {
            return _this.generateJson(v);
          };
        })(this));
      }
    } else {
      if (obj.jfField) {
        return obj.jfField.getValue();
      } else {
        if (_.isObject(obj)) {
          newObj = {};
          _.each(obj, (function(_this) {
            return function(v, k) {
              return newObj[k] = _this.generateJson(v);
            };
          })(this));
          return newObj;
        } else {
          return obj;
        }
      }
    }
  };

  Form.prototype.parseJsonConfig = function(obj) {
    if (_.isArray(obj)) {
      if (obj.length === 1 && obj[0].jfType) {
        obj[0].jfField = new jsonform.FieldCollection(obj[0]);
        return this.fields.push(obj[0].jfField);
      } else {
        return _.each(obj, (function(_this) {
          return function(v) {
            return _this.parseJsonConfig(v);
          };
        })(this));
      }
    } else {
      if (obj.jfType) {
        obj.jfField = jsonform.helpers.newField(obj);
        return this.fields.push(obj.jfField);
      } else {
        return _.each(obj, (function(_this) {
          return function(v, k) {
            if (_.isObject(v)) {
              return _this.parseJsonConfig(v);
            }
          };
        })(this));
      }
    }
  };

  return Form;

})();

this.JST = {"fields/ajax": function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if(typeof(jfTitle)!== 'undefined') { ;
__p += '<span class="jfTitle">' +
((__t = ( jfTitle )) == null ? '' : __t) +
'</span>';
 } ;
__p += '\n\n<select class="chosen-select">\n  <option value=""></option>\n</select>';

}
return __p
},
"fields/boolean": function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if(typeof(jfTitle)!== 'undefined') { ;
__p += '<span class="jfTitle">' +
((__t = ( jfTitle )) == null ? '' : __t) +
'</span>';
 } ;
__p += '\n\n<select class="chosen-select">\n  <option value="true">true</option>\n  <option value="false">false</option>\n</select>';

}
return __p
},
"fields/fieldcollection-del": function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<a href="#" class="jfDel jfBtn">-</a>';

}
return __p
},
"fields/fieldcollection": function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if(typeof(jfTitle)!== 'undefined') { ;
__p += '<span class="jfTitle">' +
((__t = ( jfTitle )) == null ? '' : __t) +
'</span>';
 } ;
__p += '\n\n<a href="#" class="jfAdd jfBtn">+</a>';

}
return __p
}};