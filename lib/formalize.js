var ComponentType = exports.ComponentType = {
    FORM: "form",
    GROUP: "group",
    STRING: "string",
    NUMBER: "number",
    DATE: "date",
    HIDDEN: "hidden",
    MONEY: "money",
	DECIMAL: "decimal",
	SINGLE_SELECTION: "single_selection",
	MULTIPLE_SELECTION: "multiple_selection"
};

var mustache = require("lib/mustache").to_html;
var log = function(msg) {
    if (typeof $ !== "undefined") {
    //    $.log(msg);
    }
}

function forIn(obj, fun) {
    var name;
    for (name in obj) {
        if (obj.hasOwnProperty(name)) {
            fun(name, obj[name]);
        }
    }
}

function funViaString(fun) {
    if (fun && fun.match && fun.match(/function/)) {
        eval("var f = " + fun);
        if (typeof f == "function") {
            return function() {
            try {
                return f.apply(this, arguments);
                } catch(e) {
                    // IF YOU SEE AN ERROR HERE IT HAPPENED WHEN WE TRIED TO RUN YOUR FUNCTION
                    log({"message": "Error in formalize function.", "error": e, "src" : fun});
                    throw(e);
                }
            };
        }
    }
    return fun;
}

function runIfFun(me, fun, args) {
    var f = funViaString(fun);
    if (typeof f == "function") {
        log("applying function in runIfFun");
        return f.apply(me, args);
    } else {
        return fun;
    }
}

/**
  Render a form based on its JSON specification
  @param {String} formMeta   Form specification JSON
**/
var formalize = exports.formalize = function(formMeta, options) {
    if (formMeta === undefined || formMeta === null || formMeta === "") {
        throw new Error("Argument can not be null or empty: formMeta");
    }
    
    options = options || {};
    
    if (options.strategies) {
        options.strategies = exports.strategies.concat(options.strategies);
    } else {
        options.strategies = exports.strategies;
    }
    
    log("strategies: " + options.strategies);
    
    var formalizer = new Formalizer(formMeta, options);
    return formalizer;
};

var Formalizer = function(formMeta, opts) {
    this.formMeta = formMeta;
    formMeta.type = ComponentType.FORM;
    
    opts = opts || {};
    this.strategies = function(val) {
        if (val === undefined) {
            return opts.strategies;
        }
        
        opts.strategies = val;
        return this;
    };
};

Formalizer.prototype.html = function(opts) {
    opts = opts || {};
    
    log("Formalizer#html");
    
    return html(this.formMeta, opts.strategies || this.strategies, opts);
};

function html(component, strategies, opts) {
    log("_html");
    var result;
    opts = opts || {};
    
    strategies = runIfFun(this, strategies);
    
    if (typeof strategies == "undefined") {
        throw new Error("Strategies must be defined");
    }
    
    if (component.components && component.components.length > 0) {
        component.components.forEach(function(component) {
            component.html = function() { return html(component, strategies, opts); };
        });
    }
    
    for (var i=0;i<strategies.length;++i) {
        strategy = strategies[i];
        if (typeof strategy != "function") {
            log("strategy " + i + " is not a function");
            throw new Error("Strategy " + i + " is not a function");
        }
        var vetoed = false;
        
        if (typeof opts.beforeStrategy == "function") {
            opts.beforeStrategy(strategy, function() { vetoed = true; });
            if (vetoed) {
                continue;
            }
        }
        
        result = strategy(component, { view: component });
        
        if (typeof opts.afterStrategy == "function") {
            opts.afterStrategy(strategy, result);
        }
        
        if (result !== undefined && result !== null) {
            log("html result: " + result);
            break; 
        }
    }
    
    if (typeof result == "undefined") {
        throw new Error("No strategies found that would render this component: " + component.type);
    }
    
    return result;
}

var Strategy = exports.Strategy = function(opts) {
    return function(component, args) {
        return opts.render.call(opts, component, args);
    }
}

exports.strategy = {
    formStrategy: Strategy({
        template: "<form>{{#components}}{{{html}}}{{/components}}<p><input type='submit' value='Save' /></p></form>",
        partials: {},
        view: {},
        render: function(component, opts) {
            log("formStrategy render");
            if (component.type != ComponentType.FORM) {
                log(JSON.stringify(component));
                return;
            }
            
            opts = opts || {};
                
            return mustache(this.template, opts.view || this.view, opts.partials || this.partials);
        }
    }),
    fieldGroupStrategy: Strategy({
       template: "<fieldset><legend>{{title}}</legend>{{#components}}{{{html}}}{{/components}}</fieldset>",
       partials: {},
       view: {},
       render: function(component, opts) {
           log("fieldGroupStrategy render");
           
           if (component.type != ComponentType.GROUP) {
               return;
           }
           
           opts = opts || {};
           
           var res = mustache(this.template, opts.view || this.view, opts.partials || this.partials);           
           return res;
       }
    }),
    groupStrategy: Strategy({
        template: "<div id='{{name}}'>{{#title}}<h3>{{title}}</h3>{{/title}}{{#components}}{{{html}}}{{/components}}</div>",
        partials: {},
        view: {},
        render: function(component, opts) {
            log("groupStrategy render");
            if (component.type != ComponentType.GROUP) {
                return;
            }
                
            opts = opts || {};
            
            return mustache(this.template, opts.view || this.view, opts.partials || this.partials);
        }
    }),
    textboxFieldStrategy: Strategy({
        template: "<p class='field-wrapper'><label for='{{name}}'>{{title}}</label><input type='text' name='{{name}}' id='{{name}}' value='{{value}}' {{#klass}}class='{{/klass}}{{klass}}{{#klass}}'{{/klass}} /></p>",
        partials: {},
        view: {},
        render: function(component, opts) {
            var view;
            
            log("textboxFieldStrategy render");
            if (component.type != ComponentType.STRING) {
                return;
            }
                
            opts = opts || {};
            view = opts.view || this.view;
            
            if (component.max_length && component.max_length < 15) {
                view.klass = "small";
            }
            
            return mustache(this.template, view, opts.partials || this.partials);
        }
    }),
    numberStrategy: Strategy({
        template: "<p class='number-field field-wrapper'><label for='{{name}}'>{{title}}</label><input type='text' name='{{name}}' id='{{name}}' value='{{value}}' /></p>",
        partials: {},
        view: {},
        render: function(component, opts) {
            log("numberStrategy render");
            if (component.type != ComponentType.NUMBER) {
                return;
            }
            
            opts = opts || {};
            
            return mustache(this.template, opts.view || this.view, opts.partials || this.partials);
        }
    }),
	decimalStrategy: Strategy({
        template: "<p class='decimal-field field-wrapper'><label for='{{name}}'>{{title}}</label><input type='text' name='{{name}}' id='{{name}}' /></p>",
        partials: {},
        view: {},
        render: function(component, opts) {
            log("decimaStrategy render");
            if (component.type != ComponentType.DECIMAL) {
                return;
            }
            
            opts = opts || {};
            
            return mustache(this.template, opts.view || this.view, opts.partials || this.partials);
        }
    }),
    dateStrategy: Strategy({
        template: "<p class='date-field field-wrapper'><label for='{{name}}'>{{title}}</label><input type='text' name='{{name}}' id='{{name}}' class='dtp' /></p>",
        partials: {},
        view: {},
        render: function(component, opts) {
            log("dateStrategy render");
            if (component.type != ComponentType.DATE) {
                return;
            }
            
            opts = opts || {};
            
            return mustache(this.template, opts.view || this.view, opts.partials || this.partials);
        }
    }),
    moneyStrategy: Strategy({
        template: "<p class='money-field field-wrapper'><label for='{{name}}'>{{title}}</label><input type='text' name='{{name}}' id='{{name}}' /></p>",
        partials: {},
        view: {},
        render: function(component, opts) {
            log("moneyStrategy render");
            if (component.type != ComponentType.MONEY) {
                return;
            }
            
            opts = opts || {};
            
            return mustache(this.template, opts.view || this.view, opts.partials || this.partials);
        }
    }),
    hiddenFieldConventionStrategy: Strategy({
        template: "<input type='hidden' name='{{name}}' id='{{name}}' value='{{value}}' />",
        partials: {},
        view: {},
        render: function(component, opts) {
            log("hiddenFieldConventionStrategy render");
            if (component.type != ComponentType.HIDDEN) {
                return;
            }
            
            opts = opts || {};
            
            return mustache(this.template, opts.view || this.view, opts.partials || this.partials);
        }
    }),
    singleSelectionStrategy: Strategy({
        selectTemplate: "<p class='field-wrapper'><label for='{{name}}'>{{title}}</label><select id='{{name}}' name='{{name}}'>{{#options}}<option value='{{value}}' group='{{name}}'>{{text}}</option>{{/options}}</select></p>",
        radioListTemplate: "<p class='field-wrapper'><label>{{title}}</label>{{#options}}<label class='radio-label'>{{text}}<input type='radio' {{#checked}}checked='{{checked}}'{{/checked}} name='{{name}}' value='{{value}}' group='{{name}}'/></label>{{/options}}</p>",
        partials: {},
        view: {},
        render: function(component, opts) {
            var template;
            
            log("singleSelectionStrategy render");
            if (component.type != ComponentType.SINGLE_SELECTION) {
                return;
            }
            
            opts = opts || {};
            
            if (component.options.length < 4) {
                template = this.radioListTemplate;
                component.options.forEach(function(x) { x.name = component.name });
            } else {
                template = this.selectTemplate;
            }
            
            return mustache(template, opts.view || this.view, opts.partials || this.partials);
        }
    }),
    multipleSelectionStrategy: Strategy({
        template: "<ul class='field-wrapper multiple-select'>{{#options}}<li><label><input type='checkbox' name='{{{name}}}' value='{{{value}}}'/>{{{text}}}</label></li>{{/options}}</ul> ",
        partials: {},
        view: {},
        render: function(component, opts) {
            log("multipleSelectionStrategy render");
            
            if (component.type != ComponentType.MULTIPLE_SELECTION) {
                return;
            }
            
            opts = opts || {};
            
            component.options.forEach(function(option) {
                option.name = component.name;
            });
            
            return mustache(this.template, opts.view || this.view, opts.partials || this.partials);
        }
    })
};

exports.strategies = [ 
    exports.strategy.hiddenFieldConventionStrategy,
    exports.strategy.formStrategy, 
    exports.strategy.fieldGroupStrategy, 
    exports.strategy.groupStrategy, 
    exports.strategy.textboxFieldStrategy, 
    exports.strategy.numberStrategy,
    exports.strategy.dateStrategy,
    exports.strategy.moneyStrategy,
    exports.strategy.singleSelectionStrategy,
    exports.strategy.multipleSelectionStrategy
];

exports.implyGroups = function(form_schema_node) {
    if (form_schema_node.components && form_schema_node.components.forEach) {
        form_schema_node.components.forEach(function(component) {
            var field = {};
            if (component.type !== ComponentType.GROUP) {
                forIn(component, function(name, val) { field[name] = val; });
                component.type = ComponentType.GROUP;
                component.name = field.name + "_group";
                component.components = [ field ];
            }
        });
    }
}